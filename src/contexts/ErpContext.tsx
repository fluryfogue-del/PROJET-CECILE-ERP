import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
import { createCompanyWorkspace } from '../services/erpEngine';
import {
  Account,
  AuditLog,
  Category,
  Company,
  CompanyMember,
  Customer,
  Department,
  Employee,
  Interaction,
  Invoice,
  JournalEntry,
  Lead,
  LeaveRequest,
  ModuleId,
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

interface ErpContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  bootstrapping: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;

  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  currentMember: CompanyMember | null;
  hasModuleAccess: (moduleId: ModuleId) => boolean;

  activeModule: ModuleId;
  setActiveModule: (m: ModuleId) => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: ReturnType<typeof getTranslations>;

  toasts: ToastMessage[];
  notify: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Live collections
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
}

const ErpContext = createContext<ErpContextValue | null>(null);

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');

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

  const autoSeededForUid = useRef<string | null>(null);

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

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de connexion Google';
      notify(msg, 'error');
    }
  }, [notify]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setCompanies([]);
    setActiveCompanyId('');
    setProfile(null);
  }, []);

  // Auth listener & User profile sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (!fbUser) {
        setAuthReady(true);
        setProfile(null);
        return;
      }

      try {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const newProf: UserProfile = {
            uid: fbUser.uid,
            email: fbUser.email || 'utilisateur@nexus-erp.local',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Utilisateur',
            language: 'fr',
          };
          await setDoc(userRef, {
            ...newProf,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfile(newProf);
        } else {
          const data = snap.data() as UserProfile;
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
  }, []);

  // Companies listener + auto-demo bootstrap if user has 0 companies
  useEffect(() => {
    if (!authReady || !user) return;

    const q = query(
      collection(db, 'companies'),
      where('memberUids', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
        setCompanies(list);

        if (list.length === 0 && autoSeededForUid.current !== user.uid) {
          autoSeededForUid.current = user.uid;
          setBootstrapping(true);
          try {
            const newId = await createCompanyWorkspace({
              uid: user.uid,
              email: user.email || 'admin@nexus-erp.local',
              displayName: user.displayName || 'Administrateur',
              name: 'CECILE Distribution SARL',
              currency: 'XAF',
              accountingStandard: 'OHADA',
              withDemoData: true,
            });
            setActiveCompanyId(newId);
            notify('Environnement de démonstration CECILE (OHADA) initialisé.', 'success');
          } catch (err) {
            console.error('Bootstrap failed:', err);
          } finally {
            setBootstrapping(false);
          }
          return;
        }

        if (list.length > 0) {
          setActiveCompanyId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev;
            if (profile?.defaultCompanyId && list.some((c) => c.id === profile.defaultCompanyId)) {
              return profile.defaultCompanyId;
            }
            return list[0].id;
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'companies');
      }
    );

    return () => unsub();
  }, [authReady, user, profile?.defaultCompanyId, notify]);

  // Subscribe to all subcollections of activeCompanyId
  useEffect(() => {
    if (!authReady || !user || !activeCompanyId) return;

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
  }, [authReady, user, activeCompanyId]);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;
  const currentMember = members.find((m) => m.uid === user?.uid) || null;

  const hasModuleAccess = useCallback(
    (moduleId: ModuleId) => {
      if (!activeCompany || !user) return false;
      if (activeCompany.ownerId === user.uid || user.email === 'fluryfogue@gmail.com') return true;
      if (!currentMember) return true;
      return currentMember.active && currentMember.allowedModules.includes(moduleId);
    },
    [activeCompany, user, currentMember]
  );

  const t = getTranslations(language);

  return (
    <ErpContext.Provider
      value={{
        user,
        profile,
        authReady,
        bootstrapping,
        signInWithGoogle,
        logout,
        companies,
        activeCompany,
        setActiveCompanyId,
        currentMember,
        hasModuleAccess,
        activeModule,
        setActiveModule,
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
