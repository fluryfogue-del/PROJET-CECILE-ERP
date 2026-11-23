export type TimestampLike = string | { seconds: number; nanoseconds?: number } | null;

export type AccountType = 'entreprise' | 'particulier';

export type ModuleId =
  | 'launcher'
  | 'appstore'
  | 'dashboard'
  | 'crm'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'accounting'
  | 'treasury'
  | 'hr'
  | 'reporting'
  | 'admin'
  | 'docs'
  | 'dynamic_module';

export type RoleCode =
  | 'admin'
  | 'direction'
  | 'commercial'
  | 'comptable'
  | 'magasinier'
  | 'rh'
  | 'lecture';

export type CurrencyCode = 'XAF' | 'XOF' | 'EUR' | 'USD';
export type AccountingStandard = 'OHADA' | 'GENERAL';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  defaultCompanyId?: string;
  language?: 'fr' | 'en';
  accountType?: AccountType;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Company {
  id: string;
  name: string;
  accountType?: AccountType;
  ownerFirstName?: string;
  ownerLastName?: string;
  sector?: string;
  city?: string;
  legalForm?: string;
  taxId?: string;
  rccm?: string;
  currency: CurrencyCode;
  accountingStandard: AccountingStandard;
  address?: string;
  phone?: string;
  email?: string;
  invoicePrefix?: string;
  invoicePaymentTerms?: string;
  invoiceNotesDefault?: string;
  hasPassword?: boolean;
  passwordSalt?: string;
  passwordHash?: string;
  enabledModules?: string[];
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface CompanyMember {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  roleCode: RoleCode;
  departmentName?: string;
  allowedModules: ModuleId[];
  canWrite: boolean;
  canValidate: boolean;
  canDelete: boolean;
  active: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  managerName?: string;
  budget?: number;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  allowedModules: ModuleId[];
  canWrite: boolean;
  canValidate: boolean;
  canDelete: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  ownerId: string;
  memberUids: string[];
  createdAt?: TimestampLike;
}

export interface Lead {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: 'nouveau' | 'contacte' | 'qualifie' | 'converti' | 'perdu';
  estimatedValue: number;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  segment: 'B2B' | 'B2C' | 'Administration';
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  creditLimit?: number;
  balanceDue: number;
  leadId?: string;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Opportunity {
  id: string;
  title: string;
  customerId?: string;
  customerName?: string;
  stage: 'prospection' | 'qualification' | 'proposition' | 'negociation' | 'gagnee' | 'perdue';
  amount: number;
  probability: number;
  expectedCloseDate?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Interaction {
  id: string;
  entityType: 'lead' | 'customer' | 'opportunity';
  entityId: string;
  entityName?: string;
  channel: 'appel' | 'email' | 'reunion' | 'note';
  summary: string;
  date: string;
  authorEmail?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  managerName?: string;
  isDefault?: boolean;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  unit?: string;
  purchasePrice: number;
  salePrice: number;
  taxRate?: number;
  stockQty: number;
  minStock: number;
  warehouseStocks?: Record<string, number>;
  trackStock?: boolean;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  warehouseId: string;
  warehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  type: 'entree' | 'sortie' | 'transfert' | 'inventaire';
  quantity: number;
  unitCost?: number;
  totalValue: number;
  referenceType?: string;
  referenceNumber?: string;
  note?: string;
  date: string;
  authorEmail?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
}

export interface DocumentLine {
  productId: string;
  sku: string;
  name: string;
  categoryName?: string;
  qty: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  lineTotal: number;
}

export interface Quote {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  date: string;
  validUntil?: string;
  status: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'converti';
  lines: DocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
  salesOrderId?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface SalesOrder {
  id: string;
  number: string;
  quoteId?: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  date: string;
  status: 'brouillon' | 'validee' | 'livree' | 'facturee' | 'annulee';
  lines: DocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  invoiceId?: string;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Invoice {
  id: string;
  number: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxId?: string;
  sellerName?: string;
  sellerLegalForm?: string;
  sellerTaxId?: string;
  sellerRccm?: string;
  sellerAddress?: string;
  sellerPhone?: string;
  sellerEmail?: string;
  currency?: CurrencyCode;
  paymentTerms?: string;
  date: string;
  dueDate?: string;
  status: 'brouillon' | 'emise' | 'partielle' | 'payee' | 'en_retard' | 'annulee';
  lines: DocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms?: string;
  balancePayable: number;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  requesterName: string;
  departmentName?: string;
  date: string;
  status: 'en_attente' | 'approuvee' | 'rejetee' | 'commandee';
  lines: DocumentLine[];
  estimatedTotal: number;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  date: string;
  expectedDate?: string;
  status: 'brouillon' | 'envoyee' | 'receptionnee' | 'facturee' | 'annulee';
  lines: DocumentLine[];
  subtotal: number;
  taxTotal: number;
  total: number;
  receivedAt?: string;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface SupplierInvoice {
  id: string;
  number: string;
  purchaseOrderId?: string;
  supplierId: string;
  supplierName: string;
  date: string;
  dueDate?: string;
  status: 'en_attente' | 'partielle' | 'payee';
  total: number;
  paidAmount: number;
  balanceDue: number;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  classNumber: number;
  type: 'actif' | 'passif' | 'charge' | 'produit';
  balanceDebit: number;
  balanceCredit: number;
  isSystem?: boolean;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  journalCode: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
  reference?: string;
  label: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  sourceModule?: string;
  sourceId?: string;
  status?: 'validee';
  authorEmail?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  type: 'banque' | 'caisse';
  bankName?: string;
  iban?: string;
  accountCode: string;
  balance: number;
  currency?: CurrencyCode;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Payment {
  id: string;
  number: string;
  direction: 'encaissement' | 'decaissement';
  partnerType: 'client' | 'fournisseur' | 'autre';
  partnerId?: string;
  partnerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  treasuryAccountId: string;
  treasuryAccountName?: string;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  amount: number;
  date: string;
  reference?: string;
  note?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
}

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  departmentName: string;
  position: string;
  contractType: 'CDI' | 'CDD' | 'Stage' | 'Consultant';
  hireDate?: string;
  baseSalary: number;
  status: 'actif' | 'en_conge' | 'suspendu' | 'sorti';
  history?: string[];
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'conge_paye' | 'maladie' | 'absence' | 'exceptionnel';
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: 'en_attente' | 'approuve' | 'refuse';
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface Payroll {
  id: string;
  period: string;
  employeeId: string;
  employeeName: string;
  departmentName?: string;
  baseSalary: number;
  bonuses?: number;
  deductions?: number;
  netSalary: number;
  status: 'brouillon' | 'validee' | 'payee';
  paidAt?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  module: string;
  read: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: TimestampLike;
}

export interface ModuleRecord {
  id: string;
  moduleId: string;
  title: string;
  reference?: string;
  partnerName?: string;
  category?: string;
  amount?: number;
  quantity?: number;
  status: 'brouillon' | 'en_cours' | 'valide' | 'termine' | 'annule';
  date: string;
  notes?: string;
  ownerId: string;
  memberUids: string[];
  isDemo: boolean;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}

export interface CustomModule {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  iconName?: string;
  accentColor?: string;
  active: boolean;
  ownerId: string;
  memberUids: string[];
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
}
