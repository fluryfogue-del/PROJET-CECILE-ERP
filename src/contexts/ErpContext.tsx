import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  apiRequest,
  clearAllWorkspaceTokens,
  getSessionToken,
  getWorkspaceToken,
  setSessionToken,
  setWorkspaceToken,
  subscribeDataMutation,
} from '../lib/apiClient';
import { getTranslations, LanguageCode } from '../i18n/translations';
import { getCatalogModule, MODULE_CATALOG } from '../data/moduleCatalog';
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

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  email: string;
  password: string;
  accountType: AccountType;
}

interface WorkspaceBundleResponse {
  bundle: {
    members?: CompanyMember[];
    departments?: Department[];
    roles?: RoleDefinition[];
    auditLogs?: AuditLog[];
    leads?: Lead[];
    customers?: Customer[];
    opportunities?: Opportunity[];
    interactions?: Interaction[];
    categories?: Category[];
    warehouses?: Warehouse[];
    products?: Product[];
    stockMovements?: StockMovement[];
    quotes?: Quote[];
    salesOrders?: SalesOrder[];
    invoices?: Invoice[];
    suppliers?: Supplier[];
    purchaseRequests?: PurchaseRequest[];
    purchaseOrders?: PurchaseOrder[];
    supplierInvoices?: SupplierInvoice[];
    accounts?: Account[];
    journalEntries?: JournalEntry[];
    treasuryAccounts?: TreasuryAccount[];
    payments?: Payment[];
    employees?: Employee[];
    leaves?: LeaveRequest[];
    payrolls?: Payroll[];
    notifications?: NotificationItem[];
    moduleRecords?: ModuleRecord[];
    customModules?: CustomModule[];
  };
}

interface ErpContextValue {
  user: UserProfile | null;
  profile: UserProfile | null;
  authReady: boolean;
  companiesLoaded: boolean;
  pendingAccountType: AccountType;
  setPendingAccountType: (type: AccountType) => void;
  pendingPersonalInfo: PendingPersonalInfo;
  setPendingPersonalInfo: (info: PendingPersonalInfo) => void;
  updateUserAccountType: (type: AccountType) => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  registerAccount: (payload: RegisterPayload) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
  refreshCompanies: () => Promise<void>;
  refreshWorkspaceData: (companyId?: string) => Promise<void>;
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

const EMPTY_PERSONAL: PendingPersonalInfo = {
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(true);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  const [pendingAccountType, setPendingAccountType] = useState<AccountType>('entreprise');
  const [pendingPersonalInfo, setPendingPersonalInfo] = useState<PendingPersonalInfo>(EMPTY_PERSONAL);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [unlockedCompanyIds, setUnlockedCompanyIds] = useState<string[]>([]);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleId>('launcher');
  const [activeCatalogModuleId, setActiveCatalogModuleId] = useState<string>('mod_dashboard');

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [language, setLanguageState] = useState<LanguageCode>('fr');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Workspace collections (loaded only after password unlock + valid X-Workspace-Token)
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

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      setLanguageState(lang);
      if (getSessionToken()) {
        void apiRequest('/api/auth/profile', {
          method: 'PATCH',
          body: { language: lang },
        }).catch(() => {});
      }
    },
    []
  );

  const refreshCompanies = useCallback(async () => {
    if (!getSessionToken()) return;
    try {
      const res = await apiRequest<{ companies: Company[] }>('/api/companies');
      const list = res.companies || [];
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
    } catch (err) {
      setCompaniesLoaded(true);
      console.error('Failed to fetch companies:', err);
    }
  }, [profile?.defaultCompanyId]);

  const refreshWorkspaceData = useCallback(
    async (targetCompanyId?: string) => {
      const cid = targetCompanyId || activeCompanyId;
      if (!cid || !getSessionToken() || !getWorkspaceToken(cid)) {
        return;
      }
      try {
        const res = await apiRequest<WorkspaceBundleResponse>(`/api/companies/${cid}/bundle`, {
          companyId: cid,
        });
        const b = res.bundle || {};
        setMembers(b.members || []);
        setDepartments(b.departments || []);
        setRoles(b.roles || []);
        setAuditLogs(b.auditLogs || []);
        setLeads(b.leads || []);
        setCustomers(b.customers || []);
        setOpportunities(b.opportunities || []);
        setInteractions(b.interactions || []);
        setCategories(b.categories || []);
        setWarehouses(b.warehouses || []);
        setProducts(b.products || []);
        setStockMovements(b.stockMovements || []);
        setQuotes(b.quotes || []);
        setSalesOrders(b.salesOrders || []);
        setInvoices(b.invoices || []);
        setSuppliers(b.suppliers || []);
        setPurchaseRequests(b.purchaseRequests || []);
        setPurchaseOrders(b.purchaseOrders || []);
        setSupplierInvoices(b.supplierInvoices || []);
        setAccounts(b.accounts || []);
        setJournalEntries(b.journalEntries || []);
        setTreasuryAccounts(b.treasuryAccounts || []);
        setPayments(b.payments || []);
        setEmployees(b.employees || []);
        setLeaves(b.leaves || []);
        setPayrolls(b.payrolls || []);
        setNotifications(b.notifications || []);
        setModuleRecords(b.moduleRecords || []);
        setCustomModules(b.customModules || []);
      } catch (err) {
        console.error('Workspace bundle refresh failed:', err);
      }
    },
    [activeCompanyId]
  );

  // Sync after every API mutation
  useEffect(() => {
    const unsub = subscribeDataMutation((mutatedCompanyId) => {
      void refreshCompanies();
      if (mutatedCompanyId === activeCompanyId) {
        void refreshWorkspaceData(mutatedCompanyId);
      }
    });
    return unsub;
  }, [activeCompanyId, refreshCompanies, refreshWorkspaceData]);

  const loginWithCredentials = useCallback(
    async (email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
          method: 'POST',
          body: { email: email.trim(), password },
        });
        setSessionToken(res.token);
        setUser(res.user);
        setProfile(res.user);
        setPendingAccountType(res.user.accountType || 'entreprise');
        setPendingPersonalInfo({
          firstName: res.user.firstName || '',
          lastName: res.user.lastName || '',
          phone: res.user.phone || '',
          address: res.user.address || '',
        });
        if (res.user.language === 'en' || res.user.language === 'fr') {
          setLanguageState(res.user.language);
        }
        setCompaniesLoaded(false);
        const compRes = await apiRequest<{ companies: Company[] }>('/api/companies');
        const list = compRes.companies || [];
        setCompanies(list);
        if (list.length > 0) {
          const defaultId =
            res.user.defaultCompanyId && list.some((c) => c.id === res.user.defaultCompanyId)
              ? res.user.defaultCompanyId
              : list[0].id;
          setActiveCompanyId(defaultId);
        } else {
          setActiveCompanyId('');
        }
        setCompaniesLoaded(true);
        setAuthReady(true);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur de connexion.';
        return { ok: false, error: msg };
      }
    },
    []
  );

  const registerAccount = useCallback(
    async (payload: RegisterPayload): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/register', {
          method: 'POST',
          body: payload,
        });
        setSessionToken(res.token);
        setUser(res.user);
        setProfile(res.user);
        setPendingAccountType(res.user.accountType || payload.accountType);
        setPendingPersonalInfo({
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          phone: payload.phone.trim(),
          address: payload.address.trim(),
        });
        setCompanies([]);
        setActiveCompanyId('');
        setCompaniesLoaded(true);
        setAuthReady(true);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur lors de la création du compte.';
        return { ok: false, error: msg };
      }
    },
    []
  );

  const updateUserAccountType = useCallback(async (type: AccountType) => {
    setPendingAccountType(type);
    if (!getSessionToken()) return;
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: { accountType: type },
      });
      setUser(res.user);
      setProfile(res.user);
    } catch (err) {
      console.error('Failed to update accountType:', err);
    }
  }, []);

  const markWorkspaceUnlocked = useCallback(
    (companyId: string) => {
      setUnlockedCompanyIds((prev) => (prev.includes(companyId) ? prev : [...prev, companyId]));
      void refreshCompanies();
      void refreshWorkspaceData(companyId);
    },
    [refreshCompanies, refreshWorkspaceData]
  );

  const lockWorkspace = useCallback(
    (companyId?: string) => {
      if (companyId) {
        setWorkspaceToken(companyId, null);
        setUnlockedCompanyIds((prev) => prev.filter((id) => id !== companyId));
      } else {
        clearAllWorkspaceTokens();
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
      try {
        const res = await apiRequest<{ workspaceToken: string; company: Company }>(
          `/api/companies/${companyId}/unlock`,
          {
            method: 'POST',
            body: { password },
          }
        );
        setWorkspaceToken(companyId, res.workspaceToken);
        setUnlockedCompanyIds((prev) => (prev.includes(companyId) ? prev : [...prev, companyId]));
        await refreshWorkspaceData(companyId);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Mot de passe incorrect. Accès refusé.',
        };
      }
    },
    [refreshWorkspaceData]
  );

  const initializeLegacyWorkspacePassword = useCallback(
    async (companyId: string, password: string) => {
      const res = await apiRequest<{ workspaceToken: string; company: Company }>(
        `/api/companies/${companyId}/setup-password`,
        {
          method: 'POST',
          body: { password },
        }
      );
      setWorkspaceToken(companyId, res.workspaceToken);
      setUnlockedCompanyIds((prev) => (prev.includes(companyId) ? prev : [...prev, companyId]));
      await refreshCompanies();
      await refreshWorkspaceData(companyId);
    },
    [refreshCompanies, refreshWorkspaceData]
  );

  const logout = useCallback(async () => {
    try {
      if (getSessionToken()) {
        await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } finally {
      setSessionToken(null);
      clearAllWorkspaceTokens();
      setUser(null);
      setProfile(null);
      setCompanies([]);
      setCompaniesLoaded(false);
      setActiveCompanyId('');
      setUnlockedCompanyIds([]);
      clearCollections();
      setCreateWorkspaceOpen(false);
      setActiveModule('launcher');
    }
  }, [clearCollections]);

  const isWorkspaceUnlocked = Boolean(
    activeCompanyId && unlockedCompanyIds.includes(activeCompanyId) && getWorkspaceToken(activeCompanyId)
  );

  useEffect(() => {
    clearCollections();
    if (user && activeCompanyId && isWorkspaceUnlocked) {
      void refreshWorkspaceData(activeCompanyId);
    }
  }, [user, activeCompanyId, isWorkspaceUnlocked, clearCollections, refreshWorkspaceData]);

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
      if (activeCompany.ownerId === user.uid) return true;
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
        loginWithCredentials,
        registerAccount,
        logout,
        companies,
        activeCompany,
        setActiveCompanyId,
        refreshCompanies,
        refreshWorkspaceData,
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
