import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { getTranslations, LanguageCode } from '../i18n/translations';
import { getCatalogModule, MODULE_CATALOG } from '../data/moduleCatalog';
import { hashWorkspacePassword, verifyWorkspacePassword } from '../lib/security';
import { updateWorkspacePassword } from '../services/erpEngine';
import {
  Account,
  AccountType,
  AuditLog,
  Category,
  Company,
  CompanyMember,
  Customer,
  CustomModule,
  Department,
  Employee,
  Interaction,
  Invoice,
  JournalEntry,
  Lead,
  LeaveRequest,
  ModuleId,
  ModuleRecord,
  NotificationItem,
  Opportunity,
  Payment,
  Payroll,
  Product,
  PurchaseOrder,
  PurchaseRequest,
  Quote,
  RoleDefinition,
  SalesOrder,
  StockMovement,
  Supplier,
  SupplierInvoice,
  TreasuryAccount,
  UserProfile,
  Warehouse,
} from '../types/erp';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface PendingPersonalInfo {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
}

interface ErpContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  companiesLoaded: boolean;
  pendingAccountType: AccountType;
  setPendingAccountType: (type: AccountType) => void;
  pendingPersonalInfo: PendingPersonalInfo;
  setPendingPersonalInfo: (info: PendingPersonalInfo) => void;
  updateUserAccountType: (type: AccountType) => Promise<void>;
  signInWithGoogle: (selectedType?: AccountType, personal?: PendingPersonalInfo) => Promise<void>;
  logout: () => Promise<void>;

  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  isWorkspaceUnlocked: boolean;
  unlockedCompanyIds: string[];
  markWorkspaceUnlocked: (companyId: string) => void;
  unlockWorkspace: (companyId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  initializeLegacyWorkspacePassword: (companyId: string, password: string) => Promise<void>;
  lockWorkspace: (companyId?: string) => void;

  createWorkspaceOpen: boolean;
  setCreateWorkspaceOpen: (open: boolean) => void;
  currentMember: CompanyMember | null;
  hasModuleAccess: (moduleId: ModuleId) => boolean;

  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;
  activeCatalogModuleId: string;
  setActiveCatalogModuleId: (id: string) => void;
  openCatalogModule: (catalogOrCustomId: string) => void;
  enabledCatalogIds: string[];

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: ReturnType<typeof getTranslations>;

  toasts: ToastMessage[];
  notify: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Live collections (only populated after workspace password unlock)
  members: CompanyMember[];
  departments: Department[];
  roles: RoleDefinition[];
  auditLogs: AuditLog[];
  leads: Lead[];
  customers: Customer[];
  opportunities: Opportunity[];
  interactions: Interaction[];
  categories: Category[];
  warehouses: Warehouse[];
  products: Product[];
  stockMovements: StockMovement[];
  quotes: Quote[];
  salesOrders: SalesOrder[];
  invoices: Invoice[];
  suppliers: Supplier[];
  purchaseRequests: PurchaseRequest[];
  purchaseOrders: PurchaseOrder[];
  supplierInvoices: SupplierInvoice[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  treasuryAccounts: TreasuryAccount[];
  payments: Payment[];
  employees: Employee[];
  leaves: LeaveRequest[];
  payrolls: Payroll[];
  notifications: NotificationItem[];
  moduleRecords: ModuleRecord[];
  customModules: CustomModule[];
}

const ErpContext = createContext<ErpContextValue | null>(null);

const PENDING_ACCOUNT_TYPE_KEY = 'furex_pending_account_type';
const PENDING_PERSONAL_INFO_KEY = 'furex_pending_personal_info';

const EMPTY_PERSONAL: PendingPersonalInfo = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  const [pendingAccountType, setPendingAccountTypeState] = useState<AccountType>(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_ACCOUNT_TYPE_KEY);
      return saved === 'particulier' ? 'particulier' : 'entreprise';
    } catch {
      return 'entreprise';
    }
  });

  const [pendingPersonalInfo, setPendingPersonalInfoState] = useState<PendingPersonalInfo>(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_PERSONAL_INFO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PendingPersonalInfo>;
        return {
          firstName: parsed.firstName || '',
          lastName: parsed.lastName || '',
          phone: parsed.phone || '',
          address: parsed.address || '',
        };
      }
    } catch {
      // ignore
    }
    return EMPTY_PERSONAL;
  });

  const setPendingAccountType = useCallback((type: AccountType) => {
    setPendingAccountTypeState(type);
    try {
      sessionStorage.setItem(PENDING_ACCOUNT_TYPE_KEY, type);
    } catch {
      // ignore
    }
  }, []);

  const setPendingPersonalInfo = useCallback((info: PendingPersonalInfo) => {
    setPendingPersonalInfoState(info);
    try {
      sessionStorage.setItem(PENDING_PERSONAL_INFO_KEY, JSON.stringify(info));
    } catch {
      // ignore
    }
  }, []);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [unlockedCompanyIds, setUnlockedCompanyIds] = useState<string[]>([]);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>('launcher');
  const [activeCatalogModuleId, setActiveCatalogModuleId] = useState<string>('mod_dashboard');

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguage] = useState<LanguageCode>('fr');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Collections
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccount[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [moduleRecords, setModuleRecords] = useState<ModuleRecord[]>([]);
  const [customModules, setCustomModules] = useState<CustomModule[]>([]);

  const clearCollections = useCallback(() => {
    setMembers([]);
    setDepartments([]);
    setRoles([]);
    setAuditLogs([]);
    setLeads([]);
    setCustomers([]);
    setOpportunities([]);
    setInteractions([]);
    setCategories([]);
    setWarehouses([]);
    setProducts([]);
    setStockMovements([]);
    setQuotes([]);
    setSalesOrders([]);
    setInvoices([]);
    setSuppliers([]);
    setPurchaseRequests([]);
    setPurchaseOrders([]);
    setSupplierInvoices([]);
    setAccounts([]);
    setJournalEntries([]);
    setTreasuryAccounts([]);
    setPayments([]);
    setEmployees([]);
    setLeaves([]);
    setPayrolls([]);
    setNotifications([]);
    setModuleRecords([]);
    setCustomModules([]);
  }, []);

  const notify = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  const signInWithGoogle = useCallback(
    async (selectedType?: AccountType, personal?: PendingPersonalInfo) => {
      if (selectedType) {
        setPendingAccountType(selectedType);
      }
      if (personal) {
        setPendingPersonalInfo(personal);
      }
      try {
        await signInWithPopup(auth, googleAuthProvider);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Échec de connexion Google';
        notify(msg, 'error');
      }
    },
    [notify, setPendingAccountType, setPendingPersonalInfo]
  );

  const updateUserAccountType = useCallback(
    async (type: AccountType) => {
      setPendingAccountType(type);
      if (!user) return;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          accountType: type,
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) => (prev ? { ...prev, accountType: type } : prev));
      } catch (err) {
        console.error('Failed to update accountType:', err);
      }
    },
    [user, setPendingAccountType]
  );

  const markWorkspaceUnlocked = useCallback((companyId: string) => {
    setUnlockedCompanyIds((prev) => (prev.includes(companyId) ? prev : [...prev, companyId]));
  }, []);

  const lockWorkspace = useCallback(
    (companyId?: string) => {
      if (companyId) {
        setUnlockedCompanyIds((prev) => prev.filter((id) => id !== companyId));
      } else {
        setUnlockedCompanyIds([]);
      }
      clearCollections();
    },
    [clearCollections]
  );

  const unlockWorkspace = useCallback(
    async (companyId: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      if (!password || password.trim().length === 0) {
        return { ok: false, error: 'Veuillez saisir un mot de passe non vide.' };
      }
      const target = companies.find((c) => c.id === companyId);
      if (!target) {
        return { ok: false, error: 'Espace de travail introuvable.' };
      }
      if (!target.passwordSalt || !target.passwordHash) {
        return { ok: false, error: 'Mot de passe de sécurité non encore initialisé.' };
      }
      const valid = await verifyWorkspacePassword(password, target.passwordSalt, target.passwordHash);
      if (!valid) {
        return { ok: false, error: 'Mot de passe incorrect. Accès refusé.' };
      }
      markWorkspaceUnlocked(companyId);
      return { ok: true };
    },
    [companies, markWorkspaceUnlocked]
  );

  const initializeLegacyWorkspacePassword = useCallback(
    async (companyId: string, password: string) => {
      const { salt, hash } = await hashWorkspacePassword(password);
      await updateWorkspacePassword(companyId, salt, hash);
      markWorkspaceUnlocked(companyId);
    },
    [markWorkspaceUnlocked]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setCompanies([]);
    setCompaniesLoaded(false);
    setActiveCompanyId('');
    setUnlockedCompanyIds([]);
    clearCollections();
    setProfile(null);
    setCreateWorkspaceOpen(false);
    setActiveModule('launcher');
  }, [clearCollections]);

  // Auth listener & User profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setAuthReady(true);
        setCompaniesLoaded(false);
        setUnlockedCompanyIds([]);
        clearCollections();
        setProfile(null);
        return;
      }

      let preferredType: AccountType = 'entreprise';
      let storedPersonal: PendingPersonalInfo = EMPTY_PERSONAL;
      try {
        const saved = sessionStorage.getItem(PENDING_ACCOUNT_TYPE_KEY);
        if (saved === 'particulier') preferredType = 'particulier';
        const rawInfo = sessionStorage.getItem(PENDING_PERSONAL_INFO_KEY);
        if (rawInfo) {
          const p = JSON.parse(rawInfo) as Partial<PendingPersonalInfo>;
          storedPersonal = {
            firstName: (p.firstName || '').trim(),
            lastName: (p.lastName || '').trim(),
            phone: (p.phone || '').trim(),
            address: (p.address || '').trim(),
          };
        }
      } catch {
        // ignore
      }

      const combinedName =
        `${storedPersonal.firstName} ${storedPersonal.lastName}`.trim() ||
        fbUser.displayName ||
        fbUser.email?.split('@')[0] ||
        'Utilisateur';

      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const newProf: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || 'utilisateur@furex-erp.com',
            displayName: combinedName,
            firstName: storedPersonal.firstName,
            lastName: storedPersonal.lastName,
            phone: storedPersonal.phone,
            address: storedPersonal.address,
            language: 'fr',
            accountType: preferredType,
          };
          await setDoc(userRef, {
            ...newProf,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfile(newProf);
        } else {
          const data = snap.data() as UserProfile;
          const updates: Record<string, unknown> = {};
          if (!data.accountType) {
            updates.accountType = preferredType;
            data.accountType = preferredType;
          } else {
            setPendingAccountType(data.accountType);
          }
          if (storedPersonal.firstName && !data.firstName) {
            updates.firstName = storedPersonal.firstName;
            data.firstName = storedPersonal.firstName;
          }
          if (storedPersonal.lastName && !data.lastName) {
            updates.lastName = storedPersonal.lastName;
            data.lastName = storedPersonal.lastName;
          }
          if (storedPersonal.phone && !data.phone) {
            updates.phone = storedPersonal.phone;
            data.phone = storedPersonal.phone;
          }
          if (storedPersonal.address && !data.address) {
            updates.address = storedPersonal.address;
            data.address = storedPersonal.address;
          }
          if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, {
              ...updates,
              updatedAt: serverTimestamp(),
            });
          }
          setProfile(data);
          if (data.language === 'en' || data.language === 'fr') {
            setLanguage(data.language);
          }
        }
      } catch (err) {
        console.error('Profile sync error:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [setPendingAccountType, clearCollections]);

  // Companies listener
  useEffect(() => {
    if (!authReady || !user) return;
    setCompaniesLoaded(false);

    const q = query(
      collection(db, 'companies'),
      where('memberUids', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
        setCompanies(list);
        setCompaniesLoaded(true);

        if (list.length > 0) {
          setActiveCompanyId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            if (profile?.defaultCompanyId && list.some((c) => c.id === profile.defaultCompanyId)) {
              return profile.defaultCompanyId;
            }
            return list[0].id;
          });
        } else {
          setActiveCompanyId('');
        }
      },
      (error) => {
        setCompaniesLoaded(true);
        handleFirestoreError(error, OperationType.LIST, 'companies');
      }
    );

    return () => unsub();
  }, [authReady, user, profile?.defaultCompanyId]);

  const isWorkspaceUnlocked = Boolean(
    activeCompanyId && unlockedCompanyIds.includes(activeCompanyId)
  );

  // Subscribe to all subcollections ONLY when the workspace is unlocked by password
  useEffect(() => {
    clearCollections();
    if (!authReady || !user || !activeCompanyId || !isWorkspaceUnlocked) {
      return;
    }

    const subMap: Array<{
      name: string;
      setter: React.Dispatch<React.SetStateAction<any[]>>;
    }> = [
      { name: 'members', setter: setMembers },
      { name: 'departments', setter: setDepartments },
      { name: 'roles', setter: setRoles },
      { name: 'auditLogs', setter: setAuditLogs },
      { name: 'leads', setter: setLeads },
      { name: 'customers', setter: setCustomers },
      { name: 'opportunities', setter: setOpportunities },
      { name: 'interactions', setter: setInteractions },
      { name: 'categories', setter: setCategories },
      { name: 'warehouses', setter: setWarehouses },
      { name: 'products', setter: setProducts },
      { name: 'stockMovements', setter: setStockMovements },
      { name: 'quotes', setter: setQuotes },
      { name: 'salesOrders', setter: setSalesOrders },
      { name: 'invoices', setter: setInvoices },
      { name: 'suppliers', setter: setSuppliers },
      { name: 'purchaseRequests', setter: setPurchaseRequests },
      { name: 'purchaseOrders', setter: setPurchaseOrders },
      { name: 'supplierInvoices', setter: setSupplierInvoices },
      { name: 'accounts', setter: setAccounts },
      { name: 'journalEntries', setter: setJournalEntries },
      { name: 'treasuryAccounts', setter: setTreasuryAccounts },
      { name: 'payments', setter: setPayments },
      { name: 'employees', setter: setEmployees },
      { name: 'leaves', setter: setLeaves },
      { name: 'payrolls', setter: setPayrolls },
      { name: 'notifications', setter: setNotifications },
      { name: 'moduleRecords', setter: setModuleRecords },
      { name: 'customModules', setter: setCustomModules },
    ];

    const unsubs = subMap.map(({ name, setter }) => {
      const path = `companies/${activeCompanyId}/${name}`;
      const q = query(
        collection(db, path),
        where('memberUids', 'array-contains', user.uid)
      );
      return onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setter(items);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user, activeCompanyId, isWorkspaceUnlocked, clearCollections]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;
  const currentMember = members.find((m) => m.uid === user?.uid) || null;

  const enabledCatalogIds = useMemo(() => {
    if (activeCompany?.enabledModules && activeCompany.enabledModules.length > 0) {
      return activeCompany.enabledModules;
    }
    return MODULE_CATALOG.map((m) => m.id);
  }, [activeCompany?.enabledModules]);

  const hasModuleAccess = useCallback(
    (moduleId: ModuleId) => {
      if (!activeCompany || !user || !isWorkspaceUnlocked) return false;
      if (moduleId === 'launcher' || moduleId === 'appstore' || moduleId === 'dynamic_module') return true;
      if (activeCompany.ownerId === user.uid || user.email === 'fluryfogue@gmail.com') return true;
      if (!currentMember) return true;
      return currentMember.active && currentMember.allowedModules.includes(moduleId);
    },
    [activeCompany, user, currentMember, isWorkspaceUnlocked]
  );

  const openCatalogModule = useCallback((catalogOrCustomId: string) => {
    const builtIn = getCatalogModule(catalogOrCustomId);
    if (builtIn) {
      setActiveCatalogModuleId(builtIn.id);
      if (builtIn.targetModule === 'dynamic_module') {
        setActiveModule('dynamic_module');
      } else {
        setActiveModule(builtIn.targetModule);
      }
      return;
    }
    setActiveCatalogModuleId(catalogOrCustomId);
    setActiveModule('dynamic_module');
  }, []);

  const t = getTranslations(language);

  return (
    <ErpContext.Provider
      value={{
        user,
        profile,
        authReady,
        companiesLoaded,
        pendingAccountType,
        setPendingAccountType,
        pendingPersonalInfo,
        setPendingPersonalInfo,
        updateUserAccountType,
        signInWithGoogle,
        logout,
        companies,
        activeCompany,
        setActiveCompanyId,
        isWorkspaceUnlocked,
        unlockedCompanyIds,
        markWorkspaceUnlocked,
        unlockWorkspace,
        initializeLegacyWorkspacePassword,
        lockWorkspace,
        createWorkspaceOpen,
        setCreateWorkspaceOpen,
        currentMember,
        hasModuleAccess,
        activeModule,
        setActiveModule,
        activeCatalogModuleId,
        setActiveCatalogModuleId,
        openCatalogModule,
        enabledCatalogIds,
        theme,
        toggleTheme,
        language,
        setLanguage,
        t,
        toasts,
        notify,
        dismissToast,
        members,
        departments,
        roles,
        auditLogs,
        leads,
        customers,
        opportunities,
        interactions,
        categories,
        warehouses,
        products,
        stockMovements,
        quotes,
        salesOrders,
        invoices,
        suppliers,
        purchaseRequests,
        purchaseOrders,
        supplierInvoices,
        accounts,
        journalEntries,
        treasuryAccounts,
        payments,
        employees,
        leaves,
        payrolls,
        notifications,
        moduleRecords,
        customModules,
      }}
    >
      {children}
    </ErpContext.Provider>
  );
};

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp doit être utilisé dans ErpProvider');
  return ctx;
}
