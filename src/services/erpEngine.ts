import { apiRequest, setWorkspaceToken } from '../lib/apiClient';
import { round2 } from '../lib/format';
import {
  Account,
  AccountingStandard,
  AccountType,
  CurrencyCode,
  DocumentLine,
  Invoice,
  JournalLine,
  Lead,
  ModuleId,
  Payroll,
  Product,
  PurchaseOrder,
  Quote,
  SalesOrder,
  SupplierInvoice,
  TreasuryAccount,
} from '../types/erp';
import { MODULE_CATALOG } from '../catalog/moduleCatalog';

export const ALL_MODULES: ModuleId[] = [
  'launcher',
  'appstore',
  'dashboard',
  'crm',
  'sales',
  'purchases',
  'inventory',
  'accounting',
  'treasury',
  'hr',
  'reporting',
  'admin',
  'docs',
  'dynamic_module',
];

export const OHADA_DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  classNumber: number;
  type: 'actif' | 'passif' | 'charge' | 'produit';
}> = [
  { code: '101', name: 'Capital social', classNumber: 1, type: 'passif' },
  { code: '121', name: 'Report à nouveau créditeur', classNumber: 1, type: 'passif' },
  { code: '241', name: 'Matériel et outillage industriel', classNumber: 2, type: 'actif' },
  { code: '244', name: 'Matériel et mobilier de bureau', classNumber: 2, type: 'actif' },
  { code: '311', name: 'Stocks de marchandises', classNumber: 3, type: 'actif' },
  { code: '401', name: 'Fournisseurs, dettes en compte', classNumber: 4, type: 'passif' },
  { code: '411', name: 'Clients, créances en compte', classNumber: 4, type: 'actif' },
  { code: '422', name: 'Personnel, rémunérations dues', classNumber: 4, type: 'passif' },
  { code: '443', name: 'État, TVA facturée (collectée)', classNumber: 4, type: 'passif' },
  { code: '445', name: 'État, TVA récupérable', classNumber: 4, type: 'actif' },
  { code: '521', name: 'Banques locales', classNumber: 5, type: 'actif' },
  { code: '571', name: 'Caisse siège', classNumber: 5, type: 'actif' },
  { code: '601', name: 'Achats de marchandises', classNumber: 6, type: 'charge' },
  { code: '624', name: 'Entretien, réparations et maintenance', classNumber: 6, type: 'charge' },
  { code: '661', name: 'Rémunérations directes versées au personnel', classNumber: 6, type: 'charge' },
  { code: '701', name: 'Ventes de marchandises', classNumber: 7, type: 'produit' },
  { code: '706', name: 'Services vendus', classNumber: 7, type: 'produit' },
];

export function computeDocumentTotals(lines: DocumentLine[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let total = 0;

  const normalized = lines.map((line) => {
    const gross = line.qty * line.unitPrice;
    const disc = gross * ((line.discountPct || 0) / 100);
    const netHt = gross - disc;
    const tax = netHt * ((line.taxRate || 0) / 100);
    const lineTotal = round2(netHt + tax);

    subtotal += gross;
    discountTotal += disc;
    taxTotal += tax;
    total += lineTotal;

    return {
      ...line,
      lineTotal,
    };
  });

  return {
    lines: normalized,
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxTotal: round2(taxTotal),
    total: round2(total),
  };
}

export async function logAudit(params: {
  companyId: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  summary: string;
}) {
  try {
    await apiRequest(`/api/companies/${params.companyId}/data/auditLogs`, {
      method: 'POST',
      companyId: params.companyId,
      body: {
        userId: params.uid,
        userEmail: params.email,
        action: params.action,
        module: params.module,
        entityType: params.entityType || '',
        entityId: params.entityId || '',
        summary: params.summary.slice(0, 490),
      },
      emitMutation: true,
    });
  } catch (error) {
    console.warn('Audit log skipped:', error);
  }
}

export async function pushNotification(params: {
  companyId: string;
  ownerId: string;
  memberUids: string[];
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  module: string;
}) {
  try {
    await apiRequest(`/api/companies/${params.companyId}/data/notifications`, {
      method: 'POST',
      companyId: params.companyId,
      body: {
        title: params.title.slice(0, 130),
        message: params.message.slice(0, 380),
        severity: params.severity,
        module: params.module,
        read: false,
      },
      emitMutation: true,
    });
  } catch (error) {
    console.warn('Notification write skipped:', error);
  }
}

export async function createCompanyWorkspace(params: {
  uid: string;
  email: string;
  displayName: string;
  ownerFirstName: string;
  ownerLastName: string;
  phone?: string;
  address?: string;
  city?: string;
  sector?: string;
  legalForm?: string;
  taxId?: string;
  rccm?: string;
  name: string;
  accountType?: AccountType;
  currency: CurrencyCode;
  accountingStandard: AccountingStandard;
  password?: string;
  enabledModules?: string[];
  withDemoData?: boolean;
}): Promise<string> {
  const resolvedModules =
    params.enabledModules && params.enabledModules.length > 0
      ? params.enabledModules
      : MODULE_CATALOG.map((m) => m.id);

  const res = await apiRequest<{
    company: { id: string } | null;
    workspaceToken: string;
  }>('/api/companies', {
    method: 'POST',
    body: {
      name: params.name.trim(),
      accountType: params.accountType || 'entreprise',
      ownerFirstName: params.ownerFirstName.trim(),
      ownerLastName: params.ownerLastName.trim(),
      sector: (params.sector || '').trim(),
      city: (params.city || '').trim(),
      legalForm: (params.legalForm || '').trim(),
      taxId: (params.taxId || '').trim(),
      rccm: (params.rccm || '').trim(),
      currency: params.currency,
      accountingStandard: params.accountingStandard,
      address: (params.address || '').trim(),
      phone: (params.phone || '').trim(),
      email: params.email.trim(),
      password: params.password || '',
      enabledModules: resolvedModules,
    },
  });

  if (!res.company?.id) {
    throw new Error('Impossible de créer l’espace de travail.');
  }

  setWorkspaceToken(res.company.id, res.workspaceToken);
  return res.company.id;
}

export async function createOrOpenDemoWorkspace(reset = false): Promise<{
  companyId: string;
  workspaceToken: string;
}> {
  const res = await apiRequest<{
    company: { id: string } | null;
    workspaceToken: string;
  }>('/api/companies/demo', {
    method: 'POST',
    body: { reset },
  });

  if (!res.company?.id || !res.workspaceToken) {
    throw new Error('Impossible d’ouvrir l’espace de démonstration.');
  }

  setWorkspaceToken(res.company.id, res.workspaceToken);
  return { companyId: res.company.id, workspaceToken: res.workspaceToken };
}

export async function updateWorkspaceEnabledModules(companyId: string, enabledModules: string[]) {
  await apiRequest(`/api/companies/${companyId}/modules`, {
    method: 'PATCH',
    companyId,
    body: { enabledModules },
    emitMutation: true,
  });
}

export async function updateWorkspaceSettings(
  companyId: string,
  settings: {
    name: string;
    ownerLastName?: string;
    ownerFirstName?: string;
    sector?: string;
    city?: string;
    taxId?: string;
    rccm?: string;
    address: string;
    phone: string;
    email?: string;
    currency: CurrencyCode;
    accountingStandard: AccountingStandard;
    invoicePrefix?: string;
    invoicePaymentTerms?: string;
    invoiceNotesDefault?: string;
  }
) {
  await apiRequest(`/api/companies/${companyId}/settings`, {
    method: 'PATCH',
    companyId,
    body: settings,
    emitMutation: true,
  });
}

export async function updateWorkspacePassword(
  companyId: string,
  currentPassword: string,
  newPassword: string
) {
  await apiRequest(`/api/companies/${companyId}/password`, {
    method: 'PATCH',
    companyId,
    body: { currentPassword, newPassword },
    emitMutation: true,
  });
}

export async function addWorkspaceMember(
  companyId: string,
  member: {
    email: string;
    displayName: string;
    roleCode: string;
    departmentName: string;
  }
) {
  await apiRequest(`/api/companies/${companyId}/members`, {
    method: 'POST',
    companyId,
    body: member,
    emitMutation: true,
  });
}

export async function purgeDemoData(params: {
  companyId: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}): Promise<number> {
  const res = await apiRequest<{ deletedCount: number }>(
    `/api/companies/${params.companyId}/actions/purge-demo`,
    {
      method: 'POST',
      companyId: params.companyId,
      emitMutation: true,
    }
  );
  return res.deletedCount || 0;
}

export async function convertLeadToCustomer(params: {
  companyId: string;
  lead: Lead;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/convert-lead`, {
    method: 'POST',
    companyId: params.companyId,
    body: { leadId: params.lead.id },
    emitMutation: true,
  });
}

export async function convertQuoteToSalesOrder(params: {
  companyId: string;
  quote: Quote;
  warehouseId: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/convert-quote`, {
    method: 'POST',
    companyId: params.companyId,
    body: { quoteId: params.quote.id, warehouseId: params.warehouseId },
    emitMutation: true,
  });
}

export async function validateSalesOrderWithStock(params: {
  companyId: string;
  order: SalesOrder;
  warehouseName: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/validate-order`, {
    method: 'POST',
    companyId: params.companyId,
    body: { orderId: params.order.id, warehouseName: params.warehouseName },
    emitMutation: true,
  });
}

export async function createInvoiceFromOrder(params: {
  companyId: string;
  order: SalesOrder;
  customerEmail?: string;
  paymentTerms?: string;
  dueDate?: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/invoice-from-order`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      orderId: params.order.id,
      paymentTerms: params.paymentTerms,
      dueDate: params.dueDate,
    },
    emitMutation: true,
  });
}

export async function createDirectInvoice(params: {
  companyId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  warehouseId?: string;
  warehouseName?: string;
  lines: DocumentLine[];
  dueDate?: string;
  paymentTerms?: string;
  notes?: string;
  deductStock: boolean;
  status?: 'brouillon' | 'emise';
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}): Promise<{ id: string; number: string }> {
  return apiRequest<{ id: string; number: string }>(
    `/api/companies/${params.companyId}/actions/direct-invoice`,
    {
      method: 'POST',
      companyId: params.companyId,
      body: {
        customerId: params.customerId,
        warehouseId: params.warehouseId,
        warehouseName: params.warehouseName,
        lines: params.lines,
        dueDate: params.dueDate,
        paymentTerms: params.paymentTerms,
        notes: params.notes,
        deductStock: params.deductStock,
        status: params.status || 'emise',
      },
      emitMutation: true,
    }
  );
}

export async function updateInvoiceStatus(
  companyId: string,
  invoiceId: string,
  status: 'emise' | 'annulee'
) {
  await apiRequest(`/api/companies/${companyId}/actions/invoice-status`, {
    method: 'PATCH',
    companyId,
    body: { invoiceId, status },
    emitMutation: true,
  });
}

export async function recordCustomerInvoicePayment(params: {
  companyId: string;
  invoice: Invoice;
  treasuryAccount: TreasuryAccount;
  amount: number;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  reference?: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/customer-payment`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      invoiceId: params.invoice.id,
      treasuryAccountId: params.treasuryAccount.id,
      amount: params.amount,
      method: params.method,
      reference: params.reference,
    },
    emitMutation: true,
  });
}

export async function receivePurchaseOrderWithStock(params: {
  companyId: string;
  po: PurchaseOrder;
  warehouseName: string;
  autoInvoice: boolean;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/receive-po`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      poId: params.po.id,
      warehouseName: params.warehouseName,
      autoInvoice: params.autoInvoice,
    },
    emitMutation: true,
  });
}

export async function recordSupplierInvoicePayment(params: {
  companyId: string;
  supplierInvoice: SupplierInvoice;
  treasuryAccount: TreasuryAccount;
  amount: number;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  reference?: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/supplier-payment`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      supplierInvoiceId: params.supplierInvoice.id,
      treasuryAccountId: params.treasuryAccount.id,
      amount: params.amount,
      method: params.method,
      reference: params.reference,
    },
    emitMutation: true,
  });
}

export async function executeStockMovement(params: {
  companyId: string;
  product: Product;
  warehouseId: string;
  warehouseName: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  type: 'entree' | 'sortie' | 'transfert' | 'inventaire';
  quantity: number;
  note?: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/stock-movement`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      productId: params.product.id,
      warehouseId: params.warehouseId,
      warehouseName: params.warehouseName,
      toWarehouseId: params.toWarehouseId,
      toWarehouseName: params.toWarehouseName,
      type: params.type,
      quantity: params.quantity,
      note: params.note,
    },
    emitMutation: true,
  });
}

export async function postManualJournalEntry(params: {
  companyId: string;
  journalCode: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
  date: string;
  reference?: string;
  label: string;
  lines: JournalLine[];
  accounts: Account[];
  sourceModule?: string;
  sourceId?: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/journal-entry`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      journalCode: params.journalCode,
      date: params.date,
      reference: params.reference,
      label: params.label,
      lines: params.lines,
      sourceModule: params.sourceModule,
      sourceId: params.sourceId,
    },
    emitMutation: true,
  });
}

export async function recordDirectTreasuryMovement(params: {
  companyId: string;
  direction: 'encaissement' | 'decaissement';
  partnerName: string;
  treasuryAccountId: string;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  amount: number;
  note?: string;
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/treasury-move`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      direction: params.direction,
      partnerName: params.partnerName,
      treasuryAccountId: params.treasuryAccountId,
      method: params.method,
      amount: params.amount,
      note: params.note,
    },
    emitMutation: true,
  });
}

export async function payEmployeePayroll(params: {
  companyId: string;
  payroll: Payroll;
  treasuryAccount: TreasuryAccount;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await apiRequest(`/api/companies/${params.companyId}/actions/pay-payroll`, {
    method: 'POST',
    companyId: params.companyId,
    body: {
      payrollId: params.payroll.id,
      treasuryAccountId: params.treasuryAccount.id,
    },
    emitMutation: true,
  });
}

export async function exportCompanyBackup(companyId: string, _uid?: string) {
  return apiRequest<Record<string, unknown>>(`/api/companies/${companyId}/actions/backup`, {
    method: 'GET',
    companyId,
  });
}

export async function createErpDoc(
  companyId: string,
  collectionName: string,
  data: Record<string, unknown>,
  _ownerId: string,
  _memberUids: string[]
) {
  const res = await apiRequest<{ id: string }>(
    `/api/companies/${companyId}/data/${collectionName}`,
    {
      method: 'POST',
      companyId,
      body: data,
      emitMutation: true,
    }
  );
  return res.id;
}

export async function updateErpDoc(
  companyId: string,
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  _withUpdatedAt = true
) {
  await apiRequest(`/api/companies/${companyId}/data/${collectionName}/${docId}`, {
    method: 'PATCH',
    companyId,
    body: data,
    emitMutation: true,
  });
}

export async function deleteErpDoc(
  companyId: string,
  collectionName: string,
  docId: string
) {
  await apiRequest(`/api/companies/${companyId}/data/${collectionName}/${docId}`, {
    method: 'DELETE',
    companyId,
    emitMutation: true,
  });
}
