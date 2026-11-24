import { Hono, Context } from 'hono';
import { DbClient, DbPreparedStatement } from './db/types.ts';
import {
  generateId,
  hashSecret,
  issueSignedToken,
  resolveSessionSecret,
  SessionTokenPayload,
  verifySecret,
  verifySignedToken,
  WorkspaceTokenPayload,
} from './lib/crypto.ts';
import { seedFullDemoWorkspace } from './demoSeed.ts';

export interface WorkerEnv {
  DB: DbClient;
  SESSION_SECRET?: string;
}

interface UserRow {
  uid: string;
  email: string;
  password_salt: string;
  password_hash: string;
  display_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  account_type: 'entreprise' | 'particulier';
  default_company_id: string;
  language: 'fr' | 'en';
  created_at: string;
  updated_at: string;
}

interface CompanyRow {
  id: string;
  name: string;
  account_type: 'entreprise' | 'particulier';
  owner_first_name: string;
  owner_last_name: string;
  sector: string;
  city: string;
  legal_form: string;
  tax_id: string;
  rccm: string;
  currency: string;
  accounting_standard: string;
  address: string;
  phone: string;
  email: string;
  invoice_prefix: string;
  invoice_payment_terms: string;
  invoice_notes_default: string;
  password_salt: string;
  password_hash: string;
  enabled_modules_json: string;
  owner_id: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  company_id: string;
  uid: string;
  email: string;
  display_name: string;
  role_code: string;
  department_name: string;
  allowed_modules_json: string;
  can_write: number;
  can_validate: number;
  can_delete: number;
  active: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceRow {
  id: string;
  company_id: string;
  number: string;
  sales_order_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_tax_id: string;
  seller_snapshot_json: string;
  currency: string;
  payment_terms: string;
  date: string;
  due_date: string;
  status: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  notes: string;
  owner_id: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  company_id: string;
  line_order: number;
  product_id: string;
  sku: string;
  name: string;
  category_name: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  tax_rate: number;
  line_total: number;
}

interface ErpRecordRow {
  company_id: string;
  collection_name: string;
  id: string;
  owner_id: string;
  is_demo: number;
  data_json: string;
  created_at: string;
  updated_at: string;
}

interface DocLine {
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

interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

type Variables = {
  user: UserRow;
  company: CompanyRow;
  member: MemberRow;
};

const ALL_MODULES = [
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

const OHADA_DEFAULT_ACCOUNTS = [
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

const ALLOWED_RECORD_COLLECTIONS = new Set([
  'departments',
  'roles',
  'auditLogs',
  'leads',
  'customers',
  'opportunities',
  'interactions',
  'categories',
  'warehouses',
  'products',
  'stockMovements',
  'quotes',
  'salesOrders',
  'suppliers',
  'purchaseRequests',
  'purchaseOrders',
  'supplierInvoices',
  'accounts',
  'journalEntries',
  'treasuryAccounts',
  'payments',
  'employees',
  'leaves',
  'payrolls',
  'notifications',
  'moduleRecords',
  'customModules',
]);

const IMPORT_COLLECTIONS = new Set([
  'products',
  'customers',
  'leads',
  'suppliers',
  'employees',
  'accounts',
  'moduleRecords',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function sanitizeText(value: unknown, maxLen = 500): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLen);
}

function computeDocumentTotals(lines: DocLine[]) {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let total = 0;

  const normalized = lines.map((line) => {
    const qty = Math.max(0, Number(line.qty) || 0);
    const unitPrice = Math.max(0, Number(line.unitPrice) || 0);
    const discountPct = Math.min(100, Math.max(0, Number(line.discountPct) || 0));
    const taxRate = Math.min(100, Math.max(0, Number(line.taxRate) || 0));
    const gross = qty * unitPrice;
    const disc = gross * (discountPct / 100);
    const netHt = gross - disc;
    const tax = netHt * (taxRate / 100);
    const lineTotal = round2(netHt + tax);

    subtotal += gross;
    discountTotal += disc;
    taxTotal += tax;
    total += lineTotal;

    return {
      productId: sanitizeText(line.productId, 60),
      sku: sanitizeText(line.sku, 60),
      name: sanitizeText(line.name, 200),
      categoryName: sanitizeText(line.categoryName, 120),
      qty,
      unitPrice,
      discountPct,
      taxRate,
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

function mapUserDto(row: UserRow) {
  return {
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    address: row.address,
    accountType: row.account_type === 'particulier' ? 'particulier' : 'entreprise',
    defaultCompanyId: row.default_company_id || '',
    language: row.language === 'en' ? 'en' : 'fr',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompanyDto(row: CompanyRow, memberUids: string[] = []) {
  return {
    id: row.id,
    name: row.name,
    accountType: row.account_type === 'particulier' ? 'particulier' : 'entreprise',
    ownerFirstName: row.owner_first_name,
    ownerLastName: row.owner_last_name,
    sector: row.sector,
    city: row.city,
    legalForm: row.legal_form,
    taxId: row.tax_id,
    rccm: row.rccm,
    currency: row.currency,
    accountingStandard: row.accounting_standard,
    address: row.address,
    phone: row.phone,
    email: row.email,
    invoicePrefix: row.invoice_prefix || 'FAC',
    invoicePaymentTerms: row.invoice_payment_terms || 'Paiement à 30 jours net',
    invoiceNotesDefault: row.invoice_notes_default || '',
    hasPassword: Boolean(row.password_hash && row.password_salt),
    enabledModules: safeJsonParse<string[]>(row.enabled_modules_json, []),
    ownerId: row.owner_id,
    memberUids: memberUids.length > 0 ? memberUids : [row.owner_id],
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMemberDto(row: MemberRow, memberUids: string[]) {
  return {
    id: row.id,
    uid: row.uid,
    email: row.email,
    displayName: row.display_name,
    roleCode: row.role_code,
    departmentName: row.department_name,
    allowedModules: safeJsonParse<string[]>(row.allowed_modules_json, []),
    canWrite: Boolean(row.can_write),
    canValidate: Boolean(row.can_validate),
    canDelete: Boolean(row.can_delete),
    active: Boolean(row.active),
    ownerId: row.owner_id,
    memberUids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceDto(row: InvoiceRow, lines: InvoiceLineRow[], memberUids: string[]) {
  const seller = safeJsonParse<Record<string, string>>(row.seller_snapshot_json, {});
  return {
    id: row.id,
    number: row.number,
    salesOrderId: row.sales_order_id || undefined,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    customerAddress: row.customer_address || '',
    customerTaxId: row.customer_tax_id || '',
    sellerName: seller.name || '',
    sellerLegalForm: seller.legalForm || '',
    sellerTaxId: seller.taxId || '',
    sellerRccm: seller.rccm || '',
    sellerAddress: seller.address || '',
    sellerPhone: seller.phone || '',
    sellerEmail: seller.email || '',
    currency: row.currency || 'XAF',
    paymentTerms: row.payment_terms || 'Paiement à 30 jours net',
    date: row.date,
    dueDate: row.due_date || '',
    status: row.status,
    lines: lines.map((l) => ({
      productId: l.product_id,
      sku: l.sku,
      name: l.name,
      categoryName: l.category_name,
      qty: l.qty,
      unitPrice: l.unit_price,
      discountPct: l.discount_pct,
      taxRate: l.tax_rate,
      lineTotal: l.line_total,
    })),
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    taxTotal: row.tax_total,
    total: row.total,
    paidAmount: row.paid_amount,
    balanceDue: row.balance_due,
    notes: row.notes || '',
    ownerId: row.owner_id,
    memberUids,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildSellerSnapshot(company: CompanyRow): string {
  return JSON.stringify({
    name: company.name,
    legalForm: company.legal_form,
    taxId: company.tax_id,
    rccm: company.rccm,
    address: company.address,
    phone: company.phone,
    email: company.email,
    city: company.city,
  });
}

async function getCompanyMemberUids(db: DbClient, companyId: string): Promise<string[]> {
  const res = await db
    .prepare('SELECT uid FROM company_members WHERE company_id = ? AND active = 1')
    .bind(companyId)
    .all<{ uid: string }>();
  return res.results.map((r) => r.uid);
}

async function nextSequenceNumber(db: DbClient, companyId: string, prefix: string): Promise<string> {
  const cleanPrefix = (prefix || 'DOC').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'DOC';
  const year = new Date().getFullYear();
  const existing = await db
    .prepare('SELECT last_seq FROM invoice_sequences WHERE company_id = ? AND prefix = ? AND year = ?')
    .bind(companyId, cleanPrefix, year)
    .first<{ last_seq: number }>();

  const nextSeq = (existing?.last_seq || 0) + 1;
  if (existing) {
    await db
      .prepare('UPDATE invoice_sequences SET last_seq = ? WHERE company_id = ? AND prefix = ? AND year = ?')
      .bind(nextSeq, companyId, cleanPrefix, year)
      .run();
  } else {
    await db
      .prepare('INSERT INTO invoice_sequences (company_id, prefix, year, last_seq) VALUES (?, ?, ?, ?)')
      .bind(companyId, cleanPrefix, year, nextSeq)
      .run();
  }
  return `${cleanPrefix}-${year}-${String(nextSeq).padStart(4, '0')}`;
}

async function getRecord<T extends Record<string, unknown>>(
  db: DbClient,
  companyId: string,
  collectionName: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const row = await db
    .prepare('SELECT * FROM erp_records WHERE company_id = ? AND collection_name = ? AND id = ?')
    .bind(companyId, collectionName, id)
    .first<ErpRecordRow>();
  if (!row) return null;
  const parsed = safeJsonParse<T>(row.data_json, {} as T);
  return {
    ...parsed,
    id: row.id,
    ownerId: row.owner_id,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCollection<T extends Record<string, unknown>>(
  db: DbClient,
  companyId: string,
  collectionName: string
): Promise<Array<T & { id: string }>> {
  const res = await db
    .prepare('SELECT * FROM erp_records WHERE company_id = ? AND collection_name = ? ORDER BY created_at DESC')
    .bind(companyId, collectionName)
    .all<ErpRecordRow>();
  return res.results.map((row) => ({
    ...safeJsonParse<T>(row.data_json, {} as T),
    id: row.id,
    ownerId: row.owner_id,
    isDemo: Boolean(row.is_demo),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function buildInsertRecordStmt(
  db: DbClient,
  companyId: string,
  collectionName: string,
  id: string,
  ownerId: string,
  payload: Record<string, unknown>,
  isDemo = false,
  ts = nowIso()
): DbPreparedStatement {
  const cleanPayload = { ...payload };
  delete cleanPayload.id;
  delete cleanPayload.ownerId;
  delete cleanPayload.memberUids;
  delete cleanPayload.createdAt;
  delete cleanPayload.updatedAt;
  return db
    .prepare(
      `INSERT INTO erp_records (company_id, collection_name, id, owner_id, is_demo, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(companyId, collectionName, id, ownerId, isDemo ? 1 : 0, JSON.stringify(cleanPayload), ts, ts);
}

function buildUpdateRecordStmt(
  db: DbClient,
  companyId: string,
  collectionName: string,
  id: string,
  payload: Record<string, unknown>,
  ts = nowIso()
): DbPreparedStatement {
  const cleanPayload = { ...payload };
  delete cleanPayload.id;
  delete cleanPayload.ownerId;
  delete cleanPayload.memberUids;
  delete cleanPayload.createdAt;
  delete cleanPayload.updatedAt;
  return db
    .prepare(
      `UPDATE erp_records SET data_json = ?, updated_at = ?
       WHERE company_id = ? AND collection_name = ? AND id = ?`
    )
    .bind(JSON.stringify(cleanPayload), ts, companyId, collectionName, id);
}

async function appendAuditStmt(
  db: DbClient,
  params: {
    companyId: string;
    uid: string;
    email: string;
    ownerId: string;
    action: string;
    module: string;
    entityType?: string;
    entityId?: string;
    summary: string;
  }
): Promise<DbPreparedStatement> {
  return buildInsertRecordStmt(
    db,
    params.companyId,
    'auditLogs',
    generateId(),
    params.ownerId,
    {
      userId: params.uid,
      userEmail: params.email,
      action: params.action,
      module: params.module,
      entityType: params.entityType || '',
      entityId: params.entityId || '',
      summary: sanitizeText(params.summary, 490),
    },
    false
  );
}

async function appendNotificationStmt(
  db: DbClient,
  params: {
    companyId: string;
    ownerId: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'success' | 'error';
    module: string;
  }
): Promise<DbPreparedStatement> {
  return buildInsertRecordStmt(
    db,
    params.companyId,
    'notifications',
    generateId(),
    params.ownerId,
    {
      title: sanitizeText(params.title, 130),
      message: sanitizeText(params.message, 380),
      severity: params.severity,
      module: params.module,
      read: false,
    },
    false
  );
}

async function buildJournalPostingStmts(
  db: DbClient,
  params: {
    companyId: string;
    journalCode: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
    date?: string;
    reference?: string;
    label: string;
    lines: JournalLine[];
    sourceModule?: string;
    sourceId?: string;
    email: string;
    ownerId: string;
  }
): Promise<DbPreparedStatement[]> {
  const totalDebit = round2(params.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(params.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error('Écriture comptable déséquilibrée : Total Débit doit égaler Total Crédit.');
  }

  const entryNumber = await nextSequenceNumber(db, params.companyId, params.journalCode);
  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    buildInsertRecordStmt(db, params.companyId, 'journalEntries', generateId(), params.ownerId, {
      number: entryNumber,
      date: params.date || todayIso(),
      journalCode: params.journalCode,
      reference: params.reference || '',
      label: sanitizeText(params.label, 230),
      lines: params.lines,
      totalDebit,
      totalCredit,
      sourceModule: params.sourceModule || '',
      sourceId: params.sourceId || '',
      status: 'validee',
      authorEmail: params.email,
    })
  );

  const accounts = await listCollection<{
    code: string;
    name: string;
    classNumber: number;
    type: string;
    balanceDebit: number;
    balanceCredit: number;
  }>(db, params.companyId, 'accounts');

  const deltas = new Map<string, { debit: number; credit: number }>();
  for (const line of params.lines) {
    const cur = deltas.get(line.accountCode) || { debit: 0, credit: 0 };
    deltas.set(line.accountCode, {
      debit: round2(cur.debit + (Number(line.debit) || 0)),
      credit: round2(cur.credit + (Number(line.credit) || 0)),
    });
  }

  deltas.forEach((delta, code) => {
    const acc = accounts.find((a) => a.code === code);
    if (acc) {
      stmts.push(
        buildUpdateRecordStmt(db, params.companyId, 'accounts', acc.id, {
          ...acc,
          balanceDebit: round2((acc.balanceDebit || 0) + delta.debit),
          balanceCredit: round2((acc.balanceCredit || 0) + delta.credit),
        })
      );
    }
  });

  return stmts;
}

function isOwnerOrAdmin(member: MemberRow, company: CompanyRow): boolean {
  return member.uid === company.owner_id || member.role_code === 'admin';
}

function canWrite(member: MemberRow, company: CompanyRow): boolean {
  return isOwnerOrAdmin(member, company) || Boolean(member.can_write);
}

function canDelete(member: MemberRow, company: CompanyRow): boolean {
  return isOwnerOrAdmin(member, company) || Boolean(member.can_delete);
}

const SESSION_COOKIE_NAME = 'jessi_session';
const DEVICE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parseCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      const val = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return '';
}

function isHttpsRequest(c: Context): boolean {
  const fwdProto = c.req.header('x-forwarded-proto');
  if (fwdProto) {
    const first = fwdProto.split(',')[0].trim().toLowerCase();
    if (first === 'https') return true;
  }
  try {
    return new URL(c.req.url).protocol === 'https:';
  } catch {
    return false;
  }
}

function setSessionCookie(c: Context, token: string, rememberDevice = true) {
  const secure = isHttpsRequest(c);
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
  ];
  if (rememberDevice) {
    attrs.push(`Max-Age=${Math.floor(DEVICE_SESSION_TTL_MS / 1000)}`);
  }
  if (secure) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  c.header('Set-Cookie', attrs.join('; '), { append: true });
}

function clearSessionCookie(c: Context) {
  const secure = isHttpsRequest(c);
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (secure) {
    attrs.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  c.header('Set-Cookie', attrs.join('; '), { append: true });
}

function verifyMutationCsrf(c: Context): boolean {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  if (c.req.header('X-Requested-With') === 'XMLHttpRequest') {
    return true;
  }
  const origin = c.req.header('Origin');
  const host = c.req.header('X-Forwarded-Host') || c.req.header('Host');
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return false;
}

async function resolveAuthenticatedUser(
  c: Context<{ Bindings: WorkerEnv; Variables: Variables }>,
  requireCsrfOnCookieMutation = true
): Promise<{ user: UserRow; token: string } | null> {
  const authHeader = c.req.header('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const cookieToken = parseCookieValue(c.req.header('Cookie'), SESSION_COOKIE_NAME);
  const token = bearerToken || cookieToken;
  if (!token) return null;

  if (!bearerToken && cookieToken && requireCsrfOnCookieMutation && !verifyMutationCsrf(c)) {
    return null;
  }

  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const payload = await verifySignedToken<SessionTokenPayload>(token, secret, 'user');
  if (!payload) return null;

  const userRow = await c.env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(payload.uid).first<UserRow>();
  if (!userRow) return null;
  return { user: userRow, token };
}

async function listUserCompaniesAndTokens(db: DbClient, uid: string, secret: string) {
  const rows = await db
    .prepare(
      `SELECT c.* FROM companies c
       INNER JOIN company_members cm ON cm.company_id = c.id
       WHERE cm.uid = ? AND cm.active = 1
       ORDER BY c.created_at DESC`
    )
    .bind(uid)
    .all<CompanyRow>();

  const workspaceTokens: Record<string, string> = {};
  const companies = await Promise.all(
    rows.results.map(async (comp) => {
      const mUids = await getCompanyMemberUids(db, comp.id);
      workspaceTokens[comp.id] = await issueSignedToken<WorkspaceTokenPayload>(
        {
          kind: 'workspace',
          uid,
          companyId: comp.id,
          iat: Date.now(),
          exp: Date.now() + WORKSPACE_TOKEN_TTL_MS,
        },
        secret
      );
      return mapCompanyDto(comp, mUids);
    })
  );

  return { companies, workspaceTokens };
}

export const apiApp = new Hono<{ Bindings: WorkerEnv; Variables: Variables }>();

apiApp.onError((err, c) => {
  console.error('JESSI API error:', err);
  const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
  return c.json({ error: msg }, 400);
});

apiApp.get('/api/health', async (c) => {
  let dbStatus = 'unavailable';
  if (c.env?.DB) {
    try {
      await c.env.DB.prepare('SELECT 1 as ok').first();
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }
  return c.json({
    ok: dbStatus === 'connected',
    service: 'jessi-api',
    database: dbStatus,
    timestamp: nowIso(),
  });
});

// ==================== AUTH ROUTES ====================

apiApp.post('/api/auth/register', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const firstName = sanitizeText(body.firstName, 80);
  const lastName = sanitizeText(body.lastName, 80);
  const phone = sanitizeText(body.phone, 40);
  const address = sanitizeText(body.address, 250);
  const email = sanitizeText(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const accountType = body.accountType === 'particulier' ? 'particulier' : 'entreprise';
  const rememberDevice = body.rememberDevice !== false;

  if (lastName.length < 2) return c.json({ error: 'Le nom est obligatoire (minimum 2 caractères).' }, 400);
  if (firstName.length < 2) return c.json({ error: 'Le ou les prénoms sont obligatoires (minimum 2 caractères).' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Adresse e-mail invalide.' }, 400);
  if (password.trim().length < 6) {
    return c.json({ error: 'Le mot de passe du compte doit contenir au moins 6 caractères.' }, 400);
  }

  const db = c.env.DB;
  const existing = await db.prepare('SELECT uid FROM users WHERE email = ?').bind(email).first<{ uid: string }>();
  if (existing) {
    return c.json({ error: 'Un compte utilisateur existe déjà avec cette adresse e-mail.' }, 409);
  }

  const { salt, hash } = await hashSecret(password, 6);
  const uid = generateId();
  const ts = nowIso();
  const displayName = `${firstName} ${lastName}`.trim();

  await db
    .prepare(
      `INSERT INTO users (
        uid, email, password_salt, password_hash, display_name,
        first_name, last_name, phone, address, account_type, default_company_id, language, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'fr', ?, ?)`
    )
    .bind(uid, email, salt, hash, displayName, firstName, lastName, phone, address, accountType, ts, ts)
    .run();

  const userRow = await db.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first<UserRow>();
  if (!userRow) return c.json({ error: 'Erreur lors de la création du profil.' }, 500);

  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const ttl = rememberDevice ? DEVICE_SESSION_TTL_MS : 24 * 60 * 60 * 1000;
  const token = await issueSignedToken<SessionTokenPayload>(
    {
      kind: 'user',
      uid,
      email,
      iat: Date.now(),
      exp: Date.now() + ttl,
    },
    secret
  );

  setSessionCookie(c, token, rememberDevice);
  return c.json({ token, user: mapUserDto(userRow) }, 201);
});

apiApp.post('/api/auth/login', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const email = sanitizeText(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const rememberDevice = body.rememberDevice !== false;

  if (!email || !password.trim()) {
    return c.json({ error: 'L’adresse e-mail et le mot de passe sont obligatoires.' }, 400);
  }

  const db = c.env.DB;
  const userRow = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!userRow) {
    return c.json({ error: 'Identifiants invalides : compte introuvable ou mot de passe incorrect.' }, 401);
  }

  const valid = await verifySecret(password, userRow.password_salt, userRow.password_hash);
  if (!valid) {
    return c.json({ error: 'Identifiants invalides : compte introuvable ou mot de passe incorrect.' }, 401);
  }

  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const ttl = rememberDevice ? DEVICE_SESSION_TTL_MS : 24 * 60 * 60 * 1000;
  const token = await issueSignedToken<SessionTokenPayload>(
    {
      kind: 'user',
      uid: userRow.uid,
      email: userRow.email,
      iat: Date.now(),
      exp: Date.now() + ttl,
    },
    secret
  );

  setSessionCookie(c, token, rememberDevice);
  const { companies, workspaceTokens } = await listUserCompaniesAndTokens(db, userRow.uid, secret);
  return c.json({ token, user: mapUserDto(userRow), companies, workspaceTokens });
});

apiApp.get('/api/auth/session', async (c) => {
  const resolved = await resolveAuthenticatedUser(c, false);
  if (!resolved) {
    return c.json({ authenticated: false });
  }
  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const { companies, workspaceTokens } = await listUserCompaniesAndTokens(c.env.DB, resolved.user.uid, secret);
  return c.json({
    authenticated: true,
    token: resolved.token,
    user: mapUserDto(resolved.user),
    companies,
    workspaceTokens,
  });
});

// Middleware: Require authenticated user session (Bearer token or HttpOnly session cookie + CSRF check)
const requireAuthUser = async (
  c: Context<{ Bindings: WorkerEnv; Variables: Variables }>,
  next: () => Promise<void>
) => {
  const resolved = await resolveAuthenticatedUser(c, true);
  if (!resolved) {
    return c.json({ error: 'Session expirée ou non authentifiée.' }, 401);
  }
  c.set('user', resolved.user);
  await next();
};

apiApp.use('/api/auth/me', requireAuthUser);
apiApp.use('/api/auth/profile', requireAuthUser);
apiApp.use('/api/companies', requireAuthUser);
apiApp.use('/api/companies/demo', requireAuthUser);

apiApp.use('/api/companies/:companyId/*', async (c, next) => {
  if (c.req.path === '/api/companies/demo') {
    await next();
    return;
  }
  const resolved = await resolveAuthenticatedUser(c, true);
  if (!resolved) return c.json({ error: 'Session expirée ou non authentifiée.' }, 401);
  c.set('user', resolved.user);

  const companyId = c.req.param('companyId');
  if (!companyId) return c.json({ error: 'Identifiant espace manquant.' }, 400);

  const comp = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first<CompanyRow>();
  if (!comp) return c.json({ error: 'Espace de travail introuvable.' }, 404);
  const member = await c.env.DB
    .prepare('SELECT * FROM company_members WHERE company_id = ? AND uid = ? AND active = 1')
    .bind(companyId, resolved.user.uid)
    .first<MemberRow>();
  if (!member) return c.json({ error: 'Accès refusé à cet espace de travail.' }, 403);
  c.set('company', comp);
  c.set('member', member);
  await next();
});

apiApp.get('/api/auth/me', (c) => {
  return c.json({ user: mapUserDto(c.get('user')) });
});

apiApp.patch('/api/auth/profile', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const firstName = body.firstName !== undefined ? sanitizeText(body.firstName, 80) : user.first_name;
  const lastName = body.lastName !== undefined ? sanitizeText(body.lastName, 80) : user.last_name;
  const phone = body.phone !== undefined ? sanitizeText(body.phone, 40) : user.phone;
  const address = body.address !== undefined ? sanitizeText(body.address, 250) : user.address;
  const accountType =
    body.accountType === 'particulier' || body.accountType === 'entreprise'
      ? body.accountType
      : user.account_type;
  const language = body.language === 'en' || body.language === 'fr' ? body.language : user.language;
  const defaultCompanyId =
    body.defaultCompanyId !== undefined ? sanitizeText(body.defaultCompanyId, 60) : user.default_company_id;
  const displayName = `${firstName} ${lastName}`.trim() || user.display_name;
  const ts = nowIso();

  await c.env.DB
    .prepare(
      `UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, display_name = ?,
       account_type = ?, language = ?, default_company_id = ?, updated_at = ? WHERE uid = ?`
    )
    .bind(firstName, lastName, phone, address, displayName, accountType, language, defaultCompanyId, ts, user.uid)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(user.uid).first<UserRow>();
  return c.json({ user: mapUserDto(updated || user) });
});

apiApp.post('/api/auth/logout', (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

// ==================== COMPANIES & WORKSPACE LOCK ROUTES ====================

apiApp.get('/api/companies', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB
    .prepare(
      `SELECT c.* FROM companies c
       INNER JOIN company_members cm ON cm.company_id = c.id
       WHERE cm.uid = ? AND cm.active = 1
       ORDER BY c.created_at DESC`
    )
    .bind(user.uid)
    .all<CompanyRow>();

  const companies = await Promise.all(
    rows.results.map(async (comp) => {
      const mUids = await getCompanyMemberUids(c.env.DB, comp.id);
      return mapCompanyDto(comp, mUids);
    })
  );
  return c.json({ companies });
});

apiApp.post('/api/companies/demo', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const forceReset = Boolean(body.reset);

  const existingDemo = await c.env.DB
    .prepare('SELECT * FROM companies WHERE owner_id = ? AND is_demo = 1 ORDER BY created_at DESC LIMIT 1')
    .bind(user.uid)
    .first<CompanyRow>();

  let demoCompanyId = existingDemo?.id || '';
  if (existingDemo && !forceReset) {
    const recCount = await c.env.DB
      .prepare('SELECT COUNT(*) as cnt FROM erp_records WHERE company_id = ?')
      .bind(existingDemo.id)
      .first<{ cnt: number }>();
    if (!recCount || Number(recCount.cnt) < 30) {
      demoCompanyId = '';
    }
  } else if (existingDemo && forceReset) {
    await c.env.DB.prepare('DELETE FROM companies WHERE id = ?').bind(existingDemo.id).run();
    demoCompanyId = '';
  }

  if (!demoCompanyId) {
    demoCompanyId = await seedFullDemoWorkspace({
      db: c.env.DB,
      userUid: user.uid,
      userEmail: user.email,
      userDisplayName: user.display_name,
      userFirstName: user.first_name,
      userLastName: user.last_name,
      userPhone: user.phone,
      userAddress: user.address,
    });
  }

  const demoRow = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(demoCompanyId).first<CompanyRow>();
  const mUids = await getCompanyMemberUids(c.env.DB, demoCompanyId);
  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const workspaceToken = await issueSignedToken<WorkspaceTokenPayload>(
    {
      kind: 'workspace',
      uid: user.uid,
      companyId: demoCompanyId,
      iat: Date.now(),
      exp: Date.now() + WORKSPACE_TOKEN_TTL_MS,
    },
    secret
  );

  return c.json(
    {
      company: demoRow ? mapCompanyDto(demoRow, mUids) : null,
      workspaceToken,
    },
    existingDemo && !forceReset ? 200 : 201
  );
});

apiApp.post('/api/companies', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));

  const name = sanitizeText(body.name, 160);
  const ownerFirstName = sanitizeText(body.ownerFirstName, 80) || user.first_name;
  const ownerLastName = sanitizeText(body.ownerLastName, 80) || user.last_name;
  const phone = sanitizeText(body.phone, 40) || user.phone;
  const address = sanitizeText(body.address, 250) || user.address;
  const city = sanitizeText(body.city, 120);
  const sector = sanitizeText(body.sector, 120);
  const accountType = body.accountType === 'particulier' ? 'particulier' : 'entreprise';
  const legalForm =
    sanitizeText(body.legalForm, 80) || (accountType === 'particulier' ? 'Particulier / Indépendant' : 'SARL');
  const taxId = sanitizeText(body.taxId, 80);
  const rccm = sanitizeText(body.rccm, 80);
  const currency = ['XAF', 'XOF', 'EUR', 'USD'].includes(String(body.currency)) ? String(body.currency) : 'XAF';
  const accountingStandard = String(body.accountingStandard) === 'GENERAL' ? 'GENERAL' : 'OHADA';
  const email = sanitizeText(body.email, 160) || user.email;
  const rawPassword = typeof body.password === 'string' ? body.password : '';
  const enabledModules = Array.isArray(body.enabledModules)
    ? body.enabledModules.map((m) => sanitizeText(m, 60)).filter(Boolean)
    : ['mod_dashboard'];

  if (name.length < 2) return c.json({ error: 'Le nom de l’espace est obligatoire.' }, 400);

  let salt = '';
  let hash = '';
  if (rawPassword.trim().length > 0) {
    if (rawPassword.trim().length < 4) {
      return c.json({ error: 'Le code de verrouillage doit contenir au moins 4 caractères.' }, 400);
    }
    const hashed = await hashSecret(rawPassword, 4);
    salt = hashed.salt;
    hash = hashed.hash;
  }

  const companyId = generateId();
  const ts = nowIso();
  const displayName = `${ownerFirstName} ${ownerLastName}`.trim() || user.display_name;

  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    c.env.DB
      .prepare(
        `INSERT INTO companies (
          id, name, account_type, owner_first_name, owner_last_name, sector, city, legal_form,
          tax_id, rccm, currency, accounting_standard, address, phone, email,
          invoice_prefix, invoice_payment_terms, invoice_notes_default,
          password_salt, password_hash, enabled_modules_json, owner_id, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAC', 'Paiement à 30 jours net', 'Règlement par virement bancaire, chèque ou Mobile Money.', ?, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        companyId,
        name,
        accountType,
        ownerFirstName,
        ownerLastName,
        sector,
        city,
        legalForm,
        taxId,
        rccm,
        currency,
        accountingStandard,
        address,
        phone,
        email,
        salt,
        hash,
        JSON.stringify(enabledModules),
        user.uid,
        ts,
        ts
      )
  );

  stmts.push(
    c.env.DB
      .prepare(
        `INSERT INTO company_members (
          id, company_id, uid, email, display_name, role_code, department_name,
          allowed_modules_json, can_write, can_validate, can_delete, active, owner_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'admin', 'Direction Générale', ?, 1, 1, 1, 1, ?, ?, ?)`
      )
      .bind(generateId(), companyId, user.uid, email, displayName, JSON.stringify(ALL_MODULES), user.uid, ts, ts)
  );

  stmts.push(
    c.env.DB
      .prepare(
        `UPDATE users SET first_name = ?, last_name = ?, phone = ?, address = ?, display_name = ?,
         account_type = ?, default_company_id = ?, updated_at = ? WHERE uid = ?`
      )
      .bind(ownerFirstName, ownerLastName, phone, address, displayName, accountType, companyId, ts, user.uid)
  );

  const roleSeeds = [
    { code: 'admin', name: 'Administrateur Système', description: 'Accès complet à tous les modules et à la sécurité.', allowedModules: ALL_MODULES, canWrite: true, canValidate: true, canDelete: true },
    { code: 'direction', name: 'Direction Générale', description: 'Pilotage stratégique, validations et analytics.', allowedModules: ['launcher', 'appstore', 'dashboard', 'crm', 'sales', 'purchases', 'inventory', 'accounting', 'treasury', 'hr', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
    { code: 'commercial', name: 'Responsable Commercial', description: 'Gestion CRM, devis, commandes clients et facturation.', allowedModules: ['launcher', 'dashboard', 'crm', 'sales', 'inventory', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
    { code: 'comptable', name: 'Chef Comptable OHADA', description: 'Comptabilité générale, journaux, trésorerie et bilans.', allowedModules: ['launcher', 'dashboard', 'sales', 'purchases', 'accounting', 'treasury', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
    { code: 'magasinier', name: 'Gestionnaire de Stocks', description: 'Entrepôts, réceptions, transferts et inventaires.', allowedModules: ['launcher', 'dashboard', 'inventory', 'purchases', 'sales', 'docs', 'dynamic_module'], canWrite: true, canValidate: false, canDelete: false },
    { code: 'rh', name: 'Responsable RH', description: 'Dossiers employés, congés, absences et paie.', allowedModules: ['launcher', 'dashboard', 'hr', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
  ];

  for (const r of roleSeeds) {
    stmts.push(buildInsertRecordStmt(c.env.DB, companyId, 'roles', generateId(), user.uid, r, false, ts));
  }

  const deptSeeds = [
    { code: 'DIR', name: 'Direction Générale', managerName: displayName, budget: 0 },
    { code: 'COM', name: 'Ventes & CRM', managerName: '', budget: 0 },
    { code: 'FIN', name: 'Finance & Comptabilité', managerName: '', budget: 0 },
    { code: 'LOG', name: 'Logistique & Stocks', managerName: '', budget: 0 },
    { code: 'RH', name: 'Ressources Humaines', managerName: '', budget: 0 },
  ];
  for (const d of deptSeeds) {
    stmts.push(buildInsertRecordStmt(c.env.DB, companyId, 'departments', generateId(), user.uid, d, false, ts));
  }

  for (const acc of OHADA_DEFAULT_ACCOUNTS) {
    stmts.push(
      buildInsertRecordStmt(
        c.env.DB,
        companyId,
        'accounts',
        generateId(),
        user.uid,
        { ...acc, balanceDebit: 0, balanceCredit: 0, isSystem: true },
        false,
        ts
      )
    );
  }

  stmts.push(
    buildInsertRecordStmt(
      c.env.DB,
      companyId,
      'warehouses',
      generateId(),
      user.uid,
      {
        code: 'ENT-01',
        name: 'Entrepôt Central',
        location: city || 'Siège Principal',
        managerName: displayName,
        isDefault: true,
      },
      false,
      ts
    )
  );

  stmts.push(
    buildInsertRecordStmt(
      c.env.DB,
      companyId,
      'treasuryAccounts',
      generateId(),
      user.uid,
      {
        name: 'Compte Bancaire Principal',
        type: 'banque',
        bankName: 'Banque Principale',
        iban: '',
        accountCode: '521',
        balance: 0,
        currency,
      },
      false,
      ts
    )
  );

  stmts.push(
    buildInsertRecordStmt(
      c.env.DB,
      companyId,
      'treasuryAccounts',
      generateId(),
      user.uid,
      {
        name: 'Caisse Principale Siège',
        type: 'caisse',
        bankName: 'Caisse interne',
        iban: '',
        accountCode: '571',
        balance: 0,
        currency,
      },
      false,
      ts
    )
  );

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId,
      uid: user.uid,
      email,
      ownerId: user.uid,
      action: 'CREATE',
      module: 'admin',
      entityType: 'company',
      entityId: companyId,
      summary: `Création de l'espace vierge ${name} (${enabledModules.length} modules actifs).`,
    })
  );

  await c.env.DB.batch(stmts);

  const createdRow = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first<CompanyRow>();
  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const workspaceToken = await issueSignedToken<WorkspaceTokenPayload>(
    {
      kind: 'workspace',
      uid: user.uid,
      companyId,
      iat: Date.now(),
      exp: Date.now() + WORKSPACE_TOKEN_TTL_MS,
    },
    secret
  );

  return c.json(
    {
      company: createdRow ? mapCompanyDto(createdRow, [user.uid]) : null,
      workspaceToken,
    },
    201
  );
});

apiApp.get('/api/companies/:companyId', async (c) => {
  const company = c.get('company');
  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  return c.json({ company: mapCompanyDto(company, mUids) });
});

apiApp.post('/api/companies/:companyId/unlock', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const password = typeof body.password === 'string' ? body.password : '';

  if (!password.trim()) {
    return c.json({ error: 'Le mot de passe est obligatoire. Les champs vides sont refusés.' }, 400);
  }

  let valid = false;
  if (company.password_hash && company.password_salt) {
    valid = await verifySecret(password, company.password_salt, company.password_hash);
  } else {
    valid = await verifySecret(password, user.password_salt, user.password_hash);
  }

  if (!valid) {
    return c.json({ error: 'Mot de passe incorrect. Accès refusé.' }, 401);
  }

  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const workspaceToken = await issueSignedToken<WorkspaceTokenPayload>(
    {
      kind: 'workspace',
      uid: user.uid,
      companyId: company.id,
      iat: Date.now(),
      exp: Date.now() + WORKSPACE_TOKEN_TTL_MS,
    },
    secret
  );

  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  return c.json({ workspaceToken, company: mapCompanyDto(company, mUids) });
});

apiApp.post('/api/companies/:companyId/setup-password', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) {
    return c.json({ error: 'Seul le propriétaire ou administrateur peut définir le mot de passe.' }, 403);
  }
  if (company.password_hash && company.password_salt) {
    return c.json({ error: 'Un mot de passe est déjà configuré sur cet espace.' }, 400);
  }

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  const { salt, hash } = await hashSecret(password, 4);
  const ts = nowIso();

  await c.env.DB
    .prepare('UPDATE companies SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(salt, hash, ts, company.id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(company.id).first<CompanyRow>();
  const secret = resolveSessionSecret(c.env.SESSION_SECRET);
  const workspaceToken = await issueSignedToken<WorkspaceTokenPayload>(
    {
      kind: 'workspace',
      uid: user.uid,
      companyId: company.id,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    },
    secret
  );

  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  return c.json({ workspaceToken, company: updated ? mapCompanyDto(updated, mUids) : null });
});

// Require valid X-Workspace-Token for ALL protected workspace sub-routes below
const PROTECTED_COMPANY_PATHS = [
  '/api/companies/:companyId/settings',
  '/api/companies/:companyId/modules',
  '/api/companies/:companyId/password',
  '/api/companies/:companyId/members',
  '/api/companies/:companyId/bundle',
  '/api/companies/:companyId/data/*',
  '/api/companies/:companyId/actions/*',
];

for (const routePattern of PROTECTED_COMPANY_PATHS) {
  apiApp.use(routePattern, async (c, next) => {
    const user = c.get('user');
    const company = c.get('company');
    const wsToken = c.req.header('X-Workspace-Token') || '';
    const secret = resolveSessionSecret(c.env.SESSION_SECRET);
    const payload = await verifySignedToken<WorkspaceTokenPayload>(wsToken, secret, 'workspace');
    if (!payload || payload.uid !== user.uid || payload.companyId !== company.id) {
      return c.json({ error: 'Espace verrouillé : veuillez saisir le mot de passe de l’espace.' }, 403);
    }
    await next();
  });
}

// ==================== WORKSPACE SETTINGS & MEMBERS ====================

apiApp.patch('/api/companies/:companyId/settings', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Permission insuffisante.' }, 403);

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const name = sanitizeText(body.name, 160) || company.name;
  const ownerLastName = body.ownerLastName !== undefined ? sanitizeText(body.ownerLastName, 80) : company.owner_last_name;
  const ownerFirstName = body.ownerFirstName !== undefined ? sanitizeText(body.ownerFirstName, 80) : company.owner_first_name;
  const sector = body.sector !== undefined ? sanitizeText(body.sector, 120) : company.sector;
  const city = body.city !== undefined ? sanitizeText(body.city, 120) : company.city;
  const taxId = body.taxId !== undefined ? sanitizeText(body.taxId, 80) : company.tax_id;
  const rccm = body.rccm !== undefined ? sanitizeText(body.rccm, 80) : company.rccm;
  const address = sanitizeText(body.address, 250) || company.address;
  const phone = sanitizeText(body.phone, 40) || company.phone;
  const email = body.email !== undefined ? sanitizeText(body.email, 160) : company.email;
  const currency = ['XAF', 'XOF', 'EUR', 'USD'].includes(String(body.currency)) ? String(body.currency) : company.currency;
  const accountingStandard = String(body.accountingStandard) === 'GENERAL' ? 'GENERAL' : company.accounting_standard;
  const invoicePrefix =
    body.invoicePrefix !== undefined
      ? sanitizeText(body.invoicePrefix, 10).toUpperCase() || 'FAC'
      : company.invoice_prefix;
  const invoicePaymentTerms =
    body.invoicePaymentTerms !== undefined
      ? sanitizeText(body.invoicePaymentTerms, 120)
      : company.invoice_payment_terms;
  const invoiceNotesDefault =
    body.invoiceNotesDefault !== undefined
      ? sanitizeText(body.invoiceNotesDefault, 500)
      : company.invoice_notes_default;
  const ts = nowIso();

  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `UPDATE companies SET name = ?, owner_last_name = ?, owner_first_name = ?, sector = ?, city = ?,
         tax_id = ?, rccm = ?, address = ?, phone = ?, email = ?, currency = ?, accounting_standard = ?,
         invoice_prefix = ?, invoice_payment_terms = ?, invoice_notes_default = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        name,
        ownerLastName,
        ownerFirstName,
        sector,
        city,
        taxId,
        rccm,
        address,
        phone,
        email,
        currency,
        accountingStandard,
        invoicePrefix,
        invoicePaymentTerms,
        invoiceNotesDefault,
        ts,
        company.id
      ),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'UPDATE_SETTINGS',
      module: 'admin',
      summary: `Mise à jour des paramètres généraux et modèle de facture de ${name}.`,
    }),
  ]);

  const updated = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(company.id).first<CompanyRow>();
  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  return c.json({ company: updated ? mapCompanyDto(updated, mUids) : null });
});

apiApp.patch('/api/companies/:companyId/modules', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Permission insuffisante.' }, 403);

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const list = Array.isArray(body.enabledModules)
    ? body.enabledModules.map((m) => sanitizeText(m, 60)).filter(Boolean)
    : ['mod_dashboard'];
  const nextModules = list.length > 0 ? list : ['mod_dashboard'];

  await c.env.DB.batch([
    c.env.DB
      .prepare('UPDATE companies SET enabled_modules_json = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(nextModules), nowIso(), company.id),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'UPDATE_MODULES',
      module: 'appstore',
      summary: `Catalogue mis à jour : ${nextModules.length} modules actifs.`,
    }),
  ]);

  const updated = await c.env.DB.prepare('SELECT * FROM companies WHERE id = ?').bind(company.id).first<CompanyRow>();
  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  return c.json({ company: updated ? mapCompanyDto(updated, mUids) : null });
});

apiApp.patch('/api/companies/:companyId/password', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Permission insuffisante.' }, 403);

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (company.password_hash && company.password_salt) {
    const valid = await verifySecret(currentPassword, company.password_salt, company.password_hash);
    if (!valid) return c.json({ error: 'Mot de passe actuel incorrect.' }, 401);
  }

  const { salt, hash } = await hashSecret(newPassword, 4);
  await c.env.DB.batch([
    c.env.DB
      .prepare('UPDATE companies SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(salt, hash, nowIso(), company.id),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'UPDATE_PASSWORD',
      module: 'admin',
      summary: 'Modification du mot de passe de protection de l’espace de travail.',
    }),
  ]);

  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/members', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Permission insuffisante.' }, 403);

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const email = sanitizeText(body.email, 160).toLowerCase();
  const displayName = sanitizeText(body.displayName, 120);
  const roleCode = sanitizeText(body.roleCode, 40) || 'commercial';
  const departmentName = sanitizeText(body.departmentName, 120) || 'Ventes & CRM';

  if (!email) return c.json({ error: 'Adresse e-mail du collaborateur obligatoire.' }, 400);

  const targetUser = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!targetUser) {
    return c.json(
      { error: 'Aucun compte JESSI inscrit avec cet e-mail. Le collaborateur doit créer son compte d’abord.' },
      404
    );
  }

  const roles = await listCollection<{
    code: string;
    allowedModules: string[];
    canWrite: boolean;
    canValidate: boolean;
    canDelete: boolean;
  }>(c.env.DB, company.id, 'roles');
  const roleDef = roles.find((r) => r.code === roleCode);
  const ts = nowIso();

  const existingMember = await c.env.DB
    .prepare('SELECT id FROM company_members WHERE company_id = ? AND uid = ?')
    .bind(company.id, targetUser.uid)
    .first<{ id: string }>();

  const allowedJson = JSON.stringify(roleDef?.allowedModules || ['launcher', 'dashboard', 'crm', 'sales']);
  const cWrite = roleDef?.canWrite ?? true ? 1 : 0;
  const cVal = roleDef?.canValidate ?? false ? 1 : 0;
  const cDel = roleDef?.canDelete ?? false ? 1 : 0;

  if (existingMember) {
    await c.env.DB
      .prepare(
        `UPDATE company_members SET role_code = ?, department_name = ?, allowed_modules_json = ?,
         can_write = ?, can_validate = ?, can_delete = ?, active = 1, updated_at = ?
         WHERE company_id = ? AND uid = ?`
      )
      .bind(roleCode, departmentName, allowedJson, cWrite, cVal, cDel, ts, company.id, targetUser.uid)
      .run();
  } else {
    await c.env.DB
      .prepare(
        `INSERT INTO company_members (
          id, company_id, uid, email, display_name, role_code, department_name,
          allowed_modules_json, can_write, can_validate, can_delete, active, owner_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .bind(
        generateId(),
        company.id,
        targetUser.uid,
        targetUser.email,
        displayName || targetUser.display_name,
        roleCode,
        departmentName,
        allowedJson,
        cWrite,
        cVal,
        cDel,
        company.owner_id,
        ts,
        ts
      )
      .run();
  }

  await c.env.DB.batch([
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'ADD_MEMBER',
      module: 'admin',
      summary: `Accès attribué à ${targetUser.email} (${roleCode}).`,
    }),
  ]);

  return c.json({ ok: true });
});

// ==================== BUNDLE FETCH ====================

async function loadCompanyBundle(db: DbClient, companyId: string) {
  const [membersRes, invoicesRes, linesRes, recordsRes] = await Promise.all([
    db.prepare('SELECT * FROM company_members WHERE company_id = ? ORDER BY created_at ASC').bind(companyId).all<MemberRow>(),
    db.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY created_at DESC').bind(companyId).all<InvoiceRow>(),
    db.prepare('SELECT * FROM invoice_lines WHERE company_id = ? ORDER BY line_order ASC').bind(companyId).all<InvoiceLineRow>(),
    db.prepare('SELECT * FROM erp_records WHERE company_id = ? ORDER BY created_at DESC').bind(companyId).all<ErpRecordRow>(),
  ]);

  const memberUids = membersRes.results.filter((m) => m.active === 1).map((m) => m.uid);
  const members = membersRes.results.map((m) => mapMemberDto(m, memberUids));

  const linesByInvoice = new Map<string, InvoiceLineRow[]>();
  for (const l of linesRes.results) {
    const arr = linesByInvoice.get(l.invoice_id) || [];
    arr.push(l);
    linesByInvoice.set(l.invoice_id, arr);
  }
  const invoices = invoicesRes.results.map((inv) =>
    mapInvoiceDto(inv, linesByInvoice.get(inv.id) || [], memberUids)
  );

  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const name of ALLOWED_RECORD_COLLECTIONS) {
    grouped[name] = [];
  }
  for (const row of recordsRes.results) {
    if (!grouped[row.collection_name]) grouped[row.collection_name] = [];
    grouped[row.collection_name].push({
      ...safeJsonParse<Record<string, unknown>>(row.data_json, {}),
      id: row.id,
      ownerId: row.owner_id,
      memberUids,
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  return {
    members,
    invoices,
    ...grouped,
  };
}

apiApp.get('/api/companies/:companyId/bundle', async (c) => {
  const company = c.get('company');
  const bundle = await loadCompanyBundle(c.env.DB, company.id);
  return c.json({ bundle });
});

// ==================== GENERIC ALLOWLISTED CRUD ====================

apiApp.post('/api/companies/:companyId/data/:collection', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits d’écriture requis.' }, 403);

  const col = c.req.param('collection');
  if (!ALLOWED_RECORD_COLLECTIONS.has(col)) {
    return c.json({ error: `Collection non autorisée : ${col}` }, 400);
  }

  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  const id = generateId();
  const ts = nowIso();
  await c.env.DB.batch([
    buildInsertRecordStmt(c.env.DB, company.id, col, id, company.owner_id, body, false, ts),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'CREATE',
      module: col,
      entityType: col,
      entityId: id,
      summary: `Création dans ${col} (${sanitizeText(body.name || body.title || body.number || id, 80)}).`,
    }),
  ]);
  return c.json({ id }, 201);
});

apiApp.patch('/api/companies/:companyId/data/:collection/:docId', async (c) => {
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits d’écriture requis.' }, 403);

  const col = c.req.param('collection');
  const docId = c.req.param('docId');
  const body = await c.req.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));

  if (col === 'members') {
    if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Administrateur requis.' }, 403);
    if (docId === company.owner_id && body.active === false) {
      return c.json({ error: 'Impossible de désactiver le propriétaire de l’espace.' }, 400);
    }
    const existingMemberRow = await c.env.DB
      .prepare('SELECT * FROM company_members WHERE company_id = ? AND id = ?')
      .bind(company.id, docId)
      .first<MemberRow>();
    if (!existingMemberRow) return c.json({ error: 'Membre introuvable.' }, 404);

    const nextActive =
      body.active !== undefined ? (body.active ? 1 : 0) : existingMemberRow.active;
    const nextRoleCode =
      typeof body.roleCode === 'string' && body.roleCode.trim()
        ? sanitizeText(body.roleCode, 40)
        : existingMemberRow.role_code;
    const nextDept =
      typeof body.departmentName === 'string'
        ? sanitizeText(body.departmentName, 120)
        : existingMemberRow.department_name;

    await c.env.DB
      .prepare(
        'UPDATE company_members SET active = ?, role_code = ?, department_name = ?, updated_at = ? WHERE company_id = ? AND id = ?'
      )
      .bind(nextActive, nextRoleCode, nextDept, nowIso(), company.id, docId)
      .run();
    return c.json({ ok: true });
  }

  if (col === 'invoices') {
    const inv = await c.env.DB
      .prepare('SELECT * FROM invoices WHERE company_id = ? AND id = ?')
      .bind(company.id, docId)
      .first<InvoiceRow>();
    if (!inv) return c.json({ error: 'Facture introuvable.' }, 404);
    if (inv.status !== 'brouillon') {
      return c.json({ error: 'Seules les factures brouillon peuvent être modifiées.' }, 400);
    }
    const nextDue = body.dueDate !== undefined ? sanitizeText(body.dueDate, 30) : inv.due_date;
    const nextTerms =
      body.paymentTerms !== undefined ? sanitizeText(body.paymentTerms, 120) : inv.payment_terms;
    const nextNotes = body.notes !== undefined ? sanitizeText(body.notes, 500) : inv.notes;
    await c.env.DB
      .prepare('UPDATE invoices SET due_date = ?, payment_terms = ?, notes = ?, updated_at = ? WHERE company_id = ? AND id = ?')
      .bind(nextDue, nextTerms, nextNotes, nowIso(), company.id, docId)
      .run();
    return c.json({ ok: true });
  }

  if (!ALLOWED_RECORD_COLLECTIONS.has(col)) {
    return c.json({ error: `Collection non autorisée : ${col}` }, 400);
  }

  const existing = await getRecord<Record<string, unknown>>(c.env.DB, company.id, col, docId);
  if (!existing) return c.json({ error: 'Document introuvable.' }, 404);

  const merged = { ...existing, ...body };
  await buildUpdateRecordStmt(c.env.DB, company.id, col, docId, merged).run();
  return c.json({ ok: true });
});

apiApp.delete('/api/companies/:companyId/data/:collection/:docId', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canDelete(member, company)) return c.json({ error: 'Droits de suppression requis.' }, 403);

  const col = c.req.param('collection');
  const docId = c.req.param('docId');

  if (col === 'members') {
    if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Administrateur requis.' }, 403);
    if (docId === company.owner_id) {
      return c.json({ error: 'Impossible de retirer le propriétaire de l’espace.' }, 400);
    }
    await c.env.DB
      .prepare('DELETE FROM company_members WHERE company_id = ? AND id = ?')
      .bind(company.id, docId)
      .run();
    return c.json({ ok: true });
  }

  if (col === 'invoices') {
    const inv = await c.env.DB
      .prepare('SELECT id, status, paid_amount FROM invoices WHERE company_id = ? AND id = ?')
      .bind(company.id, docId)
      .first<{ id: string; status: string; paid_amount: number }>();
    if (!inv) return c.json({ error: 'Facture introuvable.' }, 404);
    if (inv.paid_amount > 0) return c.json({ error: 'Impossible de supprimer une facture ayant déjà reçu un paiement.' }, 400);
    await c.env.DB.prepare('DELETE FROM invoices WHERE company_id = ? AND id = ?').bind(company.id, docId).run();
    return c.json({ ok: true });
  }

  if (!ALLOWED_RECORD_COLLECTIONS.has(col)) {
    return c.json({ error: `Collection non autorisée : ${col}` }, 400);
  }

  await c.env.DB.batch([
    c.env.DB
      .prepare('DELETE FROM erp_records WHERE company_id = ? AND collection_name = ? AND id = ?')
      .bind(company.id, col, docId),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'DELETE',
      module: col,
      entityId: docId,
      summary: `Suppression d'un élément dans ${col}.`,
    }),
  ]);
  return c.json({ ok: true });
});

// ==================== TRANSACTIONAL BUSINESS ACTIONS ====================

apiApp.post('/api/companies/:companyId/actions/import', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits d’écriture requis.' }, 403);

  const body = await c.req.json<{ target?: string; rows?: Array<Record<string, unknown>> }>().catch(() => ({
    target: '',
    rows: [],
  }));
  const target = sanitizeText(body.target, 40);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!IMPORT_COLLECTIONS.has(target)) return c.json({ error: 'Cible d’import invalide.' }, 400);
  if (rows.length === 0) return c.json({ imported: 0 });

  const ts = nowIso();
  const stmts: DbPreparedStatement[] = [];
  for (const row of rows) {
    stmts.push(buildInsertRecordStmt(c.env.DB, company.id, target, generateId(), company.owner_id, row, false, ts));
  }
  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'IMPORT_CSV_EXCEL',
      module: target,
      summary: `Import CSV/Excel de ${rows.length} enregistrement(s) dans ${target}.`,
    })
  );

  for (let i = 0; i < stmts.length; i += 100) {
    await c.env.DB.batch(stmts.slice(i, i + 100));
  }
  return c.json({ imported: rows.length });
});

apiApp.post('/api/companies/:companyId/actions/convert-lead', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits d’écriture requis.' }, 403);

  const { leadId } = await c.req.json<{ leadId?: string }>().catch(() => ({ leadId: '' }));
  if (!leadId) return c.json({ error: 'Prospect requis.' }, 400);

  const lead = await getRecord<{
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    status: string;
  }>(c.env.DB, company.id, 'leads', leadId);
  if (!lead) return c.json({ error: 'Prospect introuvable.' }, 404);

  const customerId = generateId();
  const code = await nextSequenceNumber(c.env.DB, company.id, 'CLI');

  await c.env.DB.batch([
    buildInsertRecordStmt(c.env.DB, company.id, 'customers', customerId, company.owner_id, {
      code,
      name: lead.companyName || lead.name,
      segment: lead.companyName ? 'B2B' : 'B2C',
      email: lead.email || '',
      phone: lead.phone || '',
      address: '',
      taxId: '',
      creditLimit: 5000000,
      balanceDue: 0,
      leadId,
      notes: lead.notes || `Converti depuis le prospect ${lead.name}`,
    }),
    buildUpdateRecordStmt(c.env.DB, company.id, 'leads', leadId, { ...lead, status: 'converti' }),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'CONVERT_LEAD',
      module: 'crm',
      entityType: 'customer',
      entityId: customerId,
      summary: `Prospect ${lead.name} converti en client (${code}).`,
    }),
  ]);

  return c.json({ customerId, code });
});

apiApp.post('/api/companies/:companyId/actions/convert-quote', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits d’écriture requis.' }, 403);

  const { quoteId, warehouseId } = await c.req.json<{ quoteId?: string; warehouseId?: string }>().catch(() => ({
    quoteId: '',
    warehouseId: '',
  }));
  if (!quoteId || !warehouseId) return c.json({ error: 'Devis et entrepôt requis.' }, 400);

  const quote = await getRecord<{
    number: string;
    customerId: string;
    customerName: string;
    lines: DocLine[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    notes?: string;
  }>(c.env.DB, company.id, 'quotes', quoteId);
  if (!quote) return c.json({ error: 'Devis introuvable.' }, 404);

  const orderId = generateId();
  const orderNumber = await nextSequenceNumber(c.env.DB, company.id, 'CMD');

  await c.env.DB.batch([
    buildInsertRecordStmt(c.env.DB, company.id, 'salesOrders', orderId, company.owner_id, {
      number: orderNumber,
      quoteId,
      customerId: quote.customerId,
      customerName: quote.customerName,
      warehouseId,
      date: todayIso(),
      status: 'brouillon',
      lines: quote.lines,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      notes: quote.notes || '',
    }),
    buildUpdateRecordStmt(c.env.DB, company.id, 'quotes', quoteId, {
      ...quote,
      status: 'converti',
      salesOrderId: orderId,
    }),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'CONVERT_QUOTE',
      module: 'sales',
      entityType: 'salesOrder',
      entityId: orderId,
      summary: `Devis ${quote.number} converti en commande ${orderNumber}.`,
    }),
  ]);

  return c.json({ orderId, orderNumber });
});

apiApp.post('/api/companies/:companyId/actions/validate-order', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const { orderId, warehouseName } = await c.req.json<{ orderId?: string; warehouseName?: string }>().catch(() => ({
    orderId: '',
    warehouseName: '',
  }));
  if (!orderId) return c.json({ error: 'Commande requise.' }, 400);

  const order = await getRecord<{
    number: string;
    warehouseId: string;
    lines: DocLine[];
    status: string;
  }>(c.env.DB, company.id, 'salesOrders', orderId);
  if (!order) return c.json({ error: 'Commande introuvable.' }, 404);
  if (order.status !== 'brouillon') return c.json({ error: 'Cette commande est déjà validée.' }, 400);

  const stmts: DbPreparedStatement[] = [];
  for (const line of order.lines) {
    const prod = await getRecord<{
      name: string;
      sku: string;
      stockQty: number;
      minStock: number;
      purchasePrice: number;
      warehouseStocks?: Record<string, number>;
    }>(c.env.DB, company.id, 'products', line.productId);
    if (!prod) continue;
    if ((prod.stockQty || 0) < line.qty) {
      return c.json({ error: `Stock insuffisant pour ${prod.name} (disponible : ${prod.stockQty}, demandé : ${line.qty}).` }, 400);
    }
    const newQty = round2(prod.stockQty - line.qty);
    const whMap = { ...(prod.warehouseStocks || {}) };
    whMap[order.warehouseId] = Math.max(0, round2((whMap[order.warehouseId] || prod.stockQty) - line.qty));

    stmts.push(
      buildUpdateRecordStmt(c.env.DB, company.id, 'products', prod.id, {
        ...prod,
        stockQty: newQty,
        warehouseStocks: whMap,
      })
    );
    stmts.push(
      buildInsertRecordStmt(c.env.DB, company.id, 'stockMovements', generateId(), company.owner_id, {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        warehouseId: order.warehouseId,
        warehouseName: warehouseName || 'Entrepôt principal',
        type: 'sortie',
        quantity: line.qty,
        unitCost: prod.purchasePrice || 0,
        totalValue: round2(line.qty * (prod.purchasePrice || 0)),
        referenceType: 'salesOrder',
        referenceNumber: order.number,
        note: `Sortie commande client ${order.number}`,
        date: todayIso(),
        authorEmail: user.email,
      })
    );
    if (newQty <= (prod.minStock || 0)) {
      stmts.push(
        await appendNotificationStmt(c.env.DB, {
          companyId: company.id,
          ownerId: company.owner_id,
          title: 'Alerte Stock Minimum',
          message: `${prod.name} (${prod.sku}) : stock restant ${newQty} <= seuil ${prod.minStock}.`,
          severity: 'warning',
          module: 'inventory',
        })
      );
    }
  }

  stmts.push(buildUpdateRecordStmt(c.env.DB, company.id, 'salesOrders', orderId, { ...order, status: 'validee' }));
  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'VALIDATE_ORDER',
      module: 'sales',
      entityType: 'salesOrder',
      entityId: orderId,
      summary: `Commande ${order.number} validée et stock déduit.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

async function createInvoiceSqlRecords(
  db: DbClient,
  params: {
    company: CompanyRow;
    customerId: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerAddress?: string;
    customerTaxId?: string;
    salesOrderId?: string;
    lines: DocLine[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    date: string;
    dueDate: string;
    paymentTerms: string;
    status: 'brouillon' | 'emise';
    notes: string;
    email: string;
  }
) {
  const invoiceId = generateId();
  const invNumber = await nextSequenceNumber(db, params.company.id, params.company.invoice_prefix || 'FAC');
  const ts = nowIso();
  const sellerJson = buildSellerSnapshot(params.company);

  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    db
      .prepare(
        `INSERT INTO invoices (
          id, company_id, number, sales_order_id, customer_id, customer_name,
          customer_email, customer_phone, customer_address, customer_tax_id,
          seller_snapshot_json, currency, payment_terms, date, due_date, status,
          subtotal, discount_total, tax_total, total, paid_amount, balance_due,
          notes, owner_id, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)`
      )
      .bind(
        invoiceId,
        params.company.id,
        invNumber,
        params.salesOrderId || '',
        params.customerId,
        params.customerName,
        params.customerEmail || '',
        params.customerPhone || '',
        params.customerAddress || '',
        params.customerTaxId || '',
        sellerJson,
        params.company.currency || 'XAF',
        params.paymentTerms || params.company.invoice_payment_terms || 'Paiement à 30 jours net',
        params.date,
        params.dueDate,
        params.status,
        params.subtotal,
        params.discountTotal,
        params.taxTotal,
        params.total,
        params.total,
        params.notes || params.company.invoice_notes_default || '',
        params.company.owner_id,
        ts,
        ts
      )
  );

  params.lines.forEach((line, idx) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO invoice_lines (
            id, invoice_id, company_id, line_order, product_id, sku, name,
            category_name, qty, unit_price, discount_pct, tax_rate, line_total
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          invoiceId,
          params.company.id,
          idx,
          line.productId || '',
          line.sku || '',
          line.name,
          line.categoryName || '',
          line.qty,
          line.unitPrice,
          line.discountPct,
          line.taxRate,
          line.lineTotal
        )
    );
  });

  if (params.status === 'emise') {
    const cust = await getRecord<{ balanceDue: number }>(db, params.company.id, 'customers', params.customerId);
    if (cust) {
      stmts.push(
        buildUpdateRecordStmt(db, params.company.id, 'customers', cust.id, {
          ...cust,
          balanceDue: round2((cust.balanceDue || 0) + params.total),
        })
      );
    }

    if (params.total > 0) {
      const netRevenue = round2(params.subtotal - params.discountTotal);
      const journalLines: JournalLine[] = [
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: params.total, credit: 0 },
      ];
      if (netRevenue > 0) {
        journalLines.push({ accountCode: '701', accountName: 'Ventes de marchandises', debit: 0, credit: netRevenue });
      }
      if (params.taxTotal > 0) {
        journalLines.push({
          accountCode: '443',
          accountName: 'État, TVA facturée (collectée)',
          debit: 0,
          credit: params.taxTotal,
        });
      }
      const jStmts = await buildJournalPostingStmts(db, {
        companyId: params.company.id,
        journalCode: 'VE',
        reference: invNumber,
        label: `Facture client ${invNumber} - ${params.customerName}`,
        lines: journalLines,
        sourceModule: 'sales',
        sourceId: invoiceId,
        email: params.email,
        ownerId: params.company.owner_id,
      });
      stmts.push(...jStmts);
    }
  }

  return { invoiceId, invNumber, stmts };
}

apiApp.post('/api/companies/:companyId/actions/invoice-from-order', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req.json<{ orderId?: string; dueDate?: string; paymentTerms?: string }>().catch(() => ({
    orderId: '',
    dueDate: '',
    paymentTerms: '',
  }));
  if (!body.orderId) return c.json({ error: 'Commande requise.' }, 400);

  const order = await getRecord<{
    number: string;
    customerId: string;
    customerName: string;
    lines: DocLine[];
    subtotal: number;
    discountTotal: number;
    taxTotal: number;
    total: number;
    status: string;
  }>(c.env.DB, company.id, 'salesOrders', body.orderId);
  if (!order) return c.json({ error: 'Commande introuvable.' }, 404);
  if (order.status === 'facturee') return c.json({ error: 'Commande déjà facturée.' }, 400);

  const cust = await getRecord<{ email?: string; phone?: string; address?: string; taxId?: string }>(
    c.env.DB,
    company.id,
    'customers',
    order.customerId
  );

  const { invoiceId, invNumber, stmts } = await createInvoiceSqlRecords(c.env.DB, {
    company,
    customerId: order.customerId,
    customerName: order.customerName,
    customerEmail: cust?.email,
    customerPhone: cust?.phone,
    customerAddress: cust?.address,
    customerTaxId: cust?.taxId,
    salesOrderId: order.id,
    lines: order.lines,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    total: order.total,
    date: todayIso(),
    dueDate: body.dueDate || addDaysIso(30),
    paymentTerms: body.paymentTerms || company.invoice_payment_terms || 'Paiement à 30 jours net',
    status: 'emise',
    notes: company.invoice_notes_default || 'Règlement à réception / sous 30 jours.',
    email: user.email,
  });

  stmts.push(
    buildUpdateRecordStmt(c.env.DB, company.id, 'salesOrders', order.id, {
      ...order,
      status: 'facturee',
      invoiceId,
    })
  );
  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'INVOICE_ORDER',
      module: 'sales',
      entityType: 'invoice',
      entityId: invoiceId,
      summary: `Facture ${invNumber} créée depuis la commande ${order.number} (${order.total}).`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ id: invoiceId, number: invNumber });
});

apiApp.post('/api/companies/:companyId/actions/direct-invoice', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      customerId?: string;
      warehouseId?: string;
      warehouseName?: string;
      lines?: DocLine[];
      dueDate?: string;
      paymentTerms?: string;
      notes?: string;
      deductStock?: boolean;
      status?: 'brouillon' | 'emise';
    }>()
    .catch(() => ({
      customerId: undefined,
      warehouseId: undefined,
      warehouseName: undefined,
      lines: undefined,
      dueDate: undefined,
      paymentTerms: undefined,
      notes: undefined,
      deductStock: undefined,
      status: undefined,
    }));

  if (!body.customerId || !Array.isArray(body.lines) || body.lines.length === 0) {
    return c.json({ error: 'Client et au moins une ligne article sont obligatoires.' }, 400);
  }

  const cust = await getRecord<{
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
  }>(c.env.DB, company.id, 'customers', body.customerId);
  if (!cust) return c.json({ error: 'Client introuvable.' }, 404);

  const totals = computeDocumentTotals(body.lines);
  const status: 'brouillon' | 'emise' = body.status === 'brouillon' ? 'brouillon' : 'emise';
  const { invoiceId, invNumber, stmts } = await createInvoiceSqlRecords(c.env.DB, {
    company,
    customerId: cust.id,
    customerName: cust.name,
    customerEmail: cust.email,
    customerPhone: cust.phone,
    customerAddress: cust.address,
    customerTaxId: cust.taxId,
    lines: totals.lines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    date: todayIso(),
    dueDate: body.dueDate || addDaysIso(30),
    paymentTerms: sanitizeText(body.paymentTerms, 120) || company.invoice_payment_terms || 'Paiement à 30 jours net',
    status,
    notes: sanitizeText(body.notes, 500) || company.invoice_notes_default || '',
    email: user.email,
  });

  if (status === 'emise' && body.deductStock && body.warehouseId) {
    for (const line of totals.lines) {
      const prod = await getRecord<{
        name: string;
        sku: string;
        stockQty: number;
        minStock: number;
        purchasePrice: number;
        warehouseStocks?: Record<string, number>;
      }>(c.env.DB, company.id, 'products', line.productId);
      if (!prod || prod.stockQty <= 0) continue;
      const deducted = Math.min(prod.stockQty, line.qty);
      const newQty = round2(prod.stockQty - deducted);
      const whMap = { ...(prod.warehouseStocks || {}) };
      whMap[body.warehouseId] = Math.max(0, round2((whMap[body.warehouseId] || prod.stockQty) - deducted));
      stmts.push(buildUpdateRecordStmt(c.env.DB, company.id, 'products', prod.id, { ...prod, stockQty: newQty, warehouseStocks: whMap }));
      stmts.push(
        buildInsertRecordStmt(c.env.DB, company.id, 'stockMovements', generateId(), company.owner_id, {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          warehouseId: body.warehouseId,
          warehouseName: body.warehouseName || 'Entrepôt Principal',
          type: 'sortie',
          quantity: deducted,
          unitCost: prod.purchasePrice || 0,
          totalValue: round2(deducted * (prod.purchasePrice || 0)),
          referenceType: 'invoice',
          referenceNumber: invNumber,
          note: `Sortie sur facture directe ${invNumber}`,
          date: todayIso(),
          authorEmail: user.email,
        })
      );
      if (newQty <= (prod.minStock || 0)) {
        stmts.push(
          await appendNotificationStmt(c.env.DB, {
            companyId: company.id,
            ownerId: company.owner_id,
            title: 'Alerte Stock Minimum',
            message: `${prod.name} (${prod.sku}) : stock restant ${newQty} <= seuil ${prod.minStock}.`,
            severity: 'warning',
            module: 'inventory',
          })
        );
      }
    }
  }

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: status === 'brouillon' ? 'DRAFT_INVOICE' : 'DIRECT_INVOICE',
      module: 'sales',
      entityType: 'invoice',
      entityId: invoiceId,
      summary: `Facture ${invNumber} (${status}) générée pour ${cust.name} (${totals.total}).`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ id: invoiceId, number: invNumber }, 201);
});

apiApp.patch('/api/companies/:companyId/actions/invoice-status', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const { invoiceId, status } = await c.req.json<{ invoiceId?: string; status?: 'emise' | 'annulee' }>().catch(() => ({
    invoiceId: '',
    status: undefined,
  }));
  if (!invoiceId || (status !== 'emise' && status !== 'annulee')) {
    return c.json({ error: 'Facture et statut valide requis.' }, 400);
  }

  const inv = await c.env.DB
    .prepare('SELECT * FROM invoices WHERE company_id = ? AND id = ?')
    .bind(company.id, invoiceId)
    .first<InvoiceRow>();
  if (!inv) return c.json({ error: 'Facture introuvable.' }, 404);
  if (inv.status === status) return c.json({ ok: true });
  if (status === 'annulee' && inv.paid_amount > 0) {
    return c.json({ error: 'Impossible d’annuler une facture déjà partiellement ou totalement encaissée.' }, 400);
  }
  if (status === 'emise' && inv.status !== 'brouillon') {
    return c.json({ error: 'Seule une facture brouillon peut être émise.' }, 400);
  }

  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    c.env.DB
      .prepare('UPDATE invoices SET status = ?, updated_at = ? WHERE company_id = ? AND id = ?')
      .bind(status, nowIso(), company.id, invoiceId)
  );

  const cust = await getRecord<{ balanceDue: number }>(c.env.DB, company.id, 'customers', inv.customer_id);
  if (status === 'emise') {
    if (cust) {
      stmts.push(
        buildUpdateRecordStmt(c.env.DB, company.id, 'customers', cust.id, {
          ...cust,
          balanceDue: round2((cust.balanceDue || 0) + inv.total),
        })
      );
    }
    if (inv.total > 0) {
      const netRev = round2(inv.subtotal - inv.discount_total);
      const jLines: JournalLine[] = [
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: inv.total, credit: 0 },
      ];
      if (netRev > 0) jLines.push({ accountCode: '701', accountName: 'Ventes de marchandises', debit: 0, credit: netRev });
      if (inv.tax_total > 0) jLines.push({ accountCode: '443', accountName: 'État, TVA facturée (collectée)', debit: 0, credit: inv.tax_total });
      stmts.push(
        ...(await buildJournalPostingStmts(c.env.DB, {
          companyId: company.id,
          journalCode: 'VE',
          reference: inv.number,
          label: `Émission facture ${inv.number} - ${inv.customer_name}`,
          lines: jLines,
          sourceModule: 'sales',
          sourceId: invoiceId,
          email: user.email,
          ownerId: company.owner_id,
        }))
      );
    }
  } else if (status === 'annulee' && inv.status !== 'brouillon') {
    if (cust) {
      stmts.push(
        buildUpdateRecordStmt(c.env.DB, company.id, 'customers', cust.id, {
          ...cust,
          balanceDue: Math.max(0, round2((cust.balanceDue || 0) - inv.balance_due)),
        })
      );
    }
    if (inv.total > 0) {
      const netRev = round2(inv.subtotal - inv.discount_total);
      const revLines: JournalLine[] = [
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: 0, credit: inv.total },
      ];
      if (netRev > 0) revLines.push({ accountCode: '701', accountName: 'Ventes de marchandises', debit: netRev, credit: 0 });
      if (inv.tax_total > 0) revLines.push({ accountCode: '443', accountName: 'État, TVA facturée (collectée)', debit: inv.tax_total, credit: 0 });
      stmts.push(
        ...(await buildJournalPostingStmts(c.env.DB, {
          companyId: company.id,
          journalCode: 'VE',
          reference: `${inv.number}-ANN`,
          label: `Annulation facture ${inv.number} - ${inv.customer_name}`,
          lines: revLines,
          sourceModule: 'sales',
          sourceId: invoiceId,
          email: user.email,
          ownerId: company.owner_id,
        }))
      );
    }
  }

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: status === 'emise' ? 'EMIT_INVOICE' : 'CANCEL_INVOICE',
      module: 'sales',
      entityType: 'invoice',
      entityId: invoiceId,
      summary: `Facture ${inv.number} passée au statut ${status}.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/actions/customer-payment', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      invoiceId?: string;
      treasuryAccountId?: string;
      amount?: number;
      method?: string;
      reference?: string;
    }>()
    .catch(() => ({
      invoiceId: undefined,
      treasuryAccountId: undefined,
      amount: undefined,
      method: undefined,
      reference: undefined,
    }));

  const amount = round2(Number(body.amount) || 0);
  if (!body.invoiceId || !body.treasuryAccountId || amount <= 0) {
    return c.json({ error: 'Facture, compte de trésorerie et montant positif requis.' }, 400);
  }

  const inv = await c.env.DB
    .prepare('SELECT * FROM invoices WHERE company_id = ? AND id = ?')
    .bind(company.id, body.invoiceId)
    .first<InvoiceRow>();
  if (!inv) return c.json({ error: 'Facture introuvable.' }, 404);
  if (inv.status === 'brouillon' || inv.status === 'annulee') {
    return c.json({ error: 'La facture doit être émise avant encaissement.' }, 400);
  }
  if (amount > inv.balance_due + 0.01) {
    return c.json({ error: `Le montant saisi dépasse le solde restant (${inv.balance_due}).` }, 400);
  }

  const treas = await getRecord<{ name: string; type: 'banque' | 'caisse'; accountCode?: string; balance: number }>(
    c.env.DB,
    company.id,
    'treasuryAccounts',
    body.treasuryAccountId
  );
  if (!treas) return c.json({ error: 'Compte de trésorerie introuvable.' }, 404);

  const newPaid = round2(inv.paid_amount + amount);
  const newBalance = Math.max(0, round2(inv.total - newPaid));
  const newStatus = newBalance === 0 ? 'payee' : 'partielle';
  const payNum = await nextSequenceNumber(c.env.DB, company.id, 'ENC');
  const paymentId = generateId();
  const method = ['virement', 'especes', 'cheque', 'mobile_money'].includes(String(body.method))
    ? String(body.method)
    : 'virement';

  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    c.env.DB
      .prepare('UPDATE invoices SET paid_amount = ?, balance_due = ?, status = ?, updated_at = ? WHERE company_id = ? AND id = ?')
      .bind(newPaid, newBalance, newStatus, nowIso(), company.id, inv.id)
  );
  stmts.push(
    buildUpdateRecordStmt(c.env.DB, company.id, 'treasuryAccounts', treas.id, {
      ...treas,
      balance: round2((treas.balance || 0) + amount),
    })
  );

  const cust = await getRecord<{ balanceDue: number }>(c.env.DB, company.id, 'customers', inv.customer_id);
  if (cust) {
    stmts.push(
      buildUpdateRecordStmt(c.env.DB, company.id, 'customers', cust.id, {
        ...cust,
        balanceDue: Math.max(0, round2((cust.balanceDue || 0) - amount)),
      })
    );
  }

  stmts.push(
    buildInsertRecordStmt(c.env.DB, company.id, 'payments', paymentId, company.owner_id, {
      number: payNum,
      direction: 'encaissement',
      partnerType: 'client',
      partnerId: inv.customer_id,
      partnerName: inv.customer_name,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      treasuryAccountId: treas.id,
      treasuryAccountName: treas.name,
      method,
      amount,
      date: todayIso(),
      reference: sanitizeText(body.reference, 80) || payNum,
      note: `Encaissement facture ${inv.number}`,
    })
  );

  const treasCode = treas.accountCode || (treas.type === 'caisse' ? '571' : '521');
  stmts.push(
    ...(await buildJournalPostingStmts(c.env.DB, {
      companyId: company.id,
      journalCode: treas.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNum,
      label: `Encaissement ${inv.number} - ${inv.customer_name}`,
      lines: [
        { accountCode: treasCode, accountName: treas.name, debit: amount, credit: 0 },
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: 0, credit: amount },
      ],
      sourceModule: 'treasury',
      sourceId: paymentId,
      email: user.email,
      ownerId: company.owner_id,
    }))
  );

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'CUSTOMER_PAYMENT',
      module: 'treasury',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Encaissement ${payNum} de ${amount} sur ${inv.number}.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, paymentNumber: payNum });
});

apiApp.post('/api/companies/:companyId/actions/receive-po', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const { poId, warehouseName, autoInvoice } = await c.req.json<{
    poId?: string;
    warehouseName?: string;
    autoInvoice?: boolean;
  }>().catch(() => ({ poId: '', warehouseName: '', autoInvoice: true }));

  if (!poId) return c.json({ error: 'Commande fournisseur requise.' }, 400);
  const po = await getRecord<{
    number: string;
    supplierId: string;
    supplierName: string;
    warehouseId: string;
    lines: DocLine[];
    subtotal: number;
    taxTotal: number;
    total: number;
    status: string;
  }>(c.env.DB, company.id, 'purchaseOrders', poId);
  if (!po) return c.json({ error: 'Commande fournisseur introuvable.' }, 404);
  if (po.status === 'receptionnee' || po.status === 'facturee') {
    return c.json({ error: 'Cette commande a déjà été réceptionnée.' }, 400);
  }

  const stmts: DbPreparedStatement[] = [];
  for (const line of po.lines) {
    const prod = await getRecord<{
      name: string;
      sku: string;
      stockQty: number;
      warehouseStocks?: Record<string, number>;
    }>(c.env.DB, company.id, 'products', line.productId);
    if (!prod) continue;
    const newQty = round2((prod.stockQty || 0) + line.qty);
    const whMap = { ...(prod.warehouseStocks || {}) };
    whMap[po.warehouseId] = round2((whMap[po.warehouseId] || 0) + line.qty);

    stmts.push(buildUpdateRecordStmt(c.env.DB, company.id, 'products', prod.id, { ...prod, stockQty: newQty, warehouseStocks: whMap }));
    stmts.push(
      buildInsertRecordStmt(c.env.DB, company.id, 'stockMovements', generateId(), company.owner_id, {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        warehouseId: po.warehouseId,
        warehouseName: warehouseName || 'Entrepôt principal',
        type: 'entree',
        quantity: line.qty,
        unitCost: line.unitPrice,
        totalValue: round2(line.qty * line.unitPrice),
        referenceType: 'purchaseOrder',
        referenceNumber: po.number,
        note: `Réception commande fournisseur ${po.number}`,
        date: todayIso(),
        authorEmail: user.email,
      })
    );
  }

  stmts.push(
    buildUpdateRecordStmt(c.env.DB, company.id, 'purchaseOrders', po.id, {
      ...po,
      status: autoInvoice ? 'facturee' : 'receptionnee',
      receivedAt: todayIso(),
    })
  );

  if (autoInvoice) {
    const sinvId = generateId();
    const sinvNum = await nextSequenceNumber(c.env.DB, company.id, 'FFR');
    stmts.push(
      buildInsertRecordStmt(c.env.DB, company.id, 'supplierInvoices', sinvId, company.owner_id, {
        number: sinvNum,
        purchaseOrderId: po.id,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        date: todayIso(),
        dueDate: addDaysIso(30),
        status: 'en_attente',
        total: po.total,
        paidAmount: 0,
        balanceDue: po.total,
      })
    );

    const sup = await getRecord<{ balancePayable: number }>(c.env.DB, company.id, 'suppliers', po.supplierId);
    if (sup) {
      stmts.push(
        buildUpdateRecordStmt(c.env.DB, company.id, 'suppliers', sup.id, {
          ...sup,
          balancePayable: round2((sup.balancePayable || 0) + po.total),
        })
      );
    }

    if (po.total > 0) {
      const acLines: JournalLine[] = [];
      if (po.subtotal > 0) acLines.push({ accountCode: '601', accountName: 'Achats de marchandises', debit: po.subtotal, credit: 0 });
      if (po.taxTotal > 0) acLines.push({ accountCode: '445', accountName: 'État, TVA récupérable', debit: po.taxTotal, credit: 0 });
      acLines.push({ accountCode: '401', accountName: 'Fournisseurs, dettes en compte', debit: 0, credit: po.total });

      stmts.push(
        ...(await buildJournalPostingStmts(c.env.DB, {
          companyId: company.id,
          journalCode: 'AC',
          reference: sinvNum,
          label: `Facture fournisseur ${sinvNum} - ${po.supplierName}`,
          lines: acLines,
          sourceModule: 'purchases',
          sourceId: sinvId,
          email: user.email,
          ownerId: company.owner_id,
        }))
      );
    }
  }

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'RECEIVE_PO',
      module: 'purchases',
      entityType: 'purchaseOrder',
      entityId: po.id,
      summary: `Réception commande fournisseur ${po.number} et entrée en stock.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/actions/supplier-payment', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      supplierInvoiceId?: string;
      treasuryAccountId?: string;
      amount?: number;
      method?: string;
      reference?: string;
    }>()
    .catch(() => ({
      supplierInvoiceId: undefined,
      treasuryAccountId: undefined,
      amount: undefined,
      method: undefined,
      reference: undefined,
    }));

  const amount = round2(Number(body.amount) || 0);
  if (!body.supplierInvoiceId || !body.treasuryAccountId || amount <= 0) {
    return c.json({ error: 'Facture fournisseur, compte de trésorerie et montant requis.' }, 400);
  }

  const sinv = await getRecord<{
    number: string;
    supplierId: string;
    supplierName: string;
    total: number;
    paidAmount: number;
    balanceDue: number;
    status: string;
  }>(c.env.DB, company.id, 'supplierInvoices', body.supplierInvoiceId);
  if (!sinv) return c.json({ error: 'Facture fournisseur introuvable.' }, 404);
  if (amount > (sinv.balanceDue || 0) + 0.01) return c.json({ error: 'Montant supérieur au solde fournisseur dû.' }, 400);

  const treas = await getRecord<{ name: string; type: 'banque' | 'caisse'; accountCode?: string; balance: number }>(
    c.env.DB,
    company.id,
    'treasuryAccounts',
    body.treasuryAccountId
  );
  if (!treas) return c.json({ error: 'Compte de trésorerie introuvable.' }, 404);

  const newPaid = round2((sinv.paidAmount || 0) + amount);
  const newBalance = Math.max(0, round2(sinv.total - newPaid));
  const payNum = await nextSequenceNumber(c.env.DB, company.id, 'DEC');
  const paymentId = generateId();

  const stmts: DbPreparedStatement[] = [];
  stmts.push(
    buildUpdateRecordStmt(c.env.DB, company.id, 'supplierInvoices', sinv.id, {
      ...sinv,
      paidAmount: newPaid,
      balanceDue: newBalance,
      status: newBalance === 0 ? 'payee' : 'partielle',
    })
  );
  stmts.push(
    buildUpdateRecordStmt(c.env.DB, company.id, 'treasuryAccounts', treas.id, {
      ...treas,
      balance: round2((treas.balance || 0) - amount),
    })
  );

  const sup = await getRecord<{ balancePayable: number }>(c.env.DB, company.id, 'suppliers', sinv.supplierId);
  if (sup) {
    stmts.push(
      buildUpdateRecordStmt(c.env.DB, company.id, 'suppliers', sup.id, {
        ...sup,
        balancePayable: Math.max(0, round2((sup.balancePayable || 0) - amount)),
      })
    );
  }

  stmts.push(
    buildInsertRecordStmt(c.env.DB, company.id, 'payments', paymentId, company.owner_id, {
      number: payNum,
      direction: 'decaissement',
      partnerType: 'fournisseur',
      partnerId: sinv.supplierId,
      partnerName: sinv.supplierName,
      invoiceId: sinv.id,
      invoiceNumber: sinv.number,
      treasuryAccountId: treas.id,
      treasuryAccountName: treas.name,
      method: body.method || 'virement',
      amount,
      date: todayIso(),
      reference: sanitizeText(body.reference, 80) || payNum,
      note: `Règlement fournisseur ${sinv.number}`,
    })
  );

  const treasCode = treas.accountCode || (treas.type === 'caisse' ? '571' : '521');
  stmts.push(
    ...(await buildJournalPostingStmts(c.env.DB, {
      companyId: company.id,
      journalCode: treas.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNum,
      label: `Règlement ${sinv.number} - ${sinv.supplierName}`,
      lines: [
        { accountCode: '401', accountName: 'Fournisseurs, dettes en compte', debit: amount, credit: 0 },
        { accountCode: treasCode, accountName: treas.name, debit: 0, credit: amount },
      ],
      sourceModule: 'treasury',
      sourceId: paymentId,
      email: user.email,
      ownerId: company.owner_id,
    }))
  );

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'SUPPLIER_PAYMENT',
      module: 'treasury',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Règlement fournisseur ${payNum} de ${amount} sur ${sinv.number}.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/actions/stock-movement', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      productId?: string;
      warehouseId?: string;
      warehouseName?: string;
      toWarehouseId?: string;
      toWarehouseName?: string;
      type?: 'entree' | 'sortie' | 'transfert' | 'inventaire';
      quantity?: number;
      note?: string;
    }>()
    .catch(() => ({
      productId: undefined,
      warehouseId: undefined,
      warehouseName: undefined,
      toWarehouseId: undefined,
      toWarehouseName: undefined,
      type: undefined,
      quantity: undefined,
      note: undefined,
    }));

  const qty = Number(body.quantity);
  if (!body.productId || !body.warehouseId || !body.type || !Number.isFinite(qty) || qty < 0) {
    return c.json({ error: 'Paramètres de mouvement de stock invalides.' }, 400);
  }

  const prod = await getRecord<{
    name: string;
    sku: string;
    stockQty: number;
    minStock: number;
    purchasePrice: number;
    warehouseStocks?: Record<string, number>;
  }>(c.env.DB, company.id, 'products', body.productId);
  if (!prod) return c.json({ error: 'Produit introuvable.' }, 404);

  const whMap = { ...(prod.warehouseStocks || {}) };
  let newTotal = prod.stockQty || 0;

  if (body.type === 'entree') {
    newTotal = round2(newTotal + qty);
    whMap[body.warehouseId] = round2((whMap[body.warehouseId] || 0) + qty);
  } else if (body.type === 'sortie') {
    if (newTotal < qty) return c.json({ error: `Stock insuffisant (${newTotal} disponibles).` }, 400);
    newTotal = round2(newTotal - qty);
    whMap[body.warehouseId] = Math.max(0, round2((whMap[body.warehouseId] || prod.stockQty) - qty));
  } else if (body.type === 'transfert') {
    if (!body.toWarehouseId) return c.json({ error: 'Entrepôt destination requis.' }, 400);
    const srcQty = whMap[body.warehouseId] ?? prod.stockQty;
    if (srcQty < qty) return c.json({ error: `Stock insuffisant dans l'entrepôt source (${srcQty}).` }, 400);
    whMap[body.warehouseId] = round2(srcQty - qty);
    whMap[body.toWarehouseId] = round2((whMap[body.toWarehouseId] || 0) + qty);
  } else if (body.type === 'inventaire') {
    whMap[body.warehouseId] = round2(qty);
    newTotal = round2(Object.values(whMap).reduce((s, v) => s + (Number(v) || 0), 0));
  }

  const stmts: DbPreparedStatement[] = [
    buildUpdateRecordStmt(c.env.DB, company.id, 'products', prod.id, {
      ...prod,
      stockQty: newTotal,
      warehouseStocks: whMap,
    }),
    buildInsertRecordStmt(c.env.DB, company.id, 'stockMovements', generateId(), company.owner_id, {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      warehouseId: body.warehouseId,
      warehouseName: body.warehouseName || '',
      toWarehouseId: body.toWarehouseId || '',
      toWarehouseName: body.toWarehouseName || '',
      type: body.type,
      quantity: qty,
      unitCost: prod.purchasePrice || 0,
      totalValue: round2(qty * (prod.purchasePrice || 0)),
      referenceType: 'manuel',
      note: sanitizeText(body.note, 300) || `Mouvement ${body.type}`,
      date: todayIso(),
      authorEmail: user.email,
    }),
  ];

  if (newTotal <= (prod.minStock || 0)) {
    stmts.push(
      await appendNotificationStmt(c.env.DB, {
        companyId: company.id,
        ownerId: company.owner_id,
        title: 'Stock sous le seuil minimum',
        message: `${prod.name} (${prod.sku}) : stock actuel ${newTotal} <= seuil ${prod.minStock}.`,
        severity: 'warning',
        module: 'inventory',
      })
    );
  }

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: `STOCK_${body.type.toUpperCase()}`,
      module: 'inventory',
      entityType: 'product',
      entityId: prod.id,
      summary: `${body.type} de ${qty} x ${prod.name}. Nouveau stock : ${newTotal}.`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, stockQty: newTotal });
});

apiApp.post('/api/companies/:companyId/actions/journal-entry', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      journalCode?: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
      date?: string;
      reference?: string;
      label?: string;
      lines?: JournalLine[];
      sourceModule?: string;
      sourceId?: string;
    }>()
    .catch(() => ({
      journalCode: undefined,
      date: undefined,
      reference: undefined,
      label: undefined,
      lines: undefined,
      sourceModule: undefined,
      sourceId: undefined,
    }));

  if (!body.journalCode || !body.label || !Array.isArray(body.lines) || body.lines.length < 2) {
    return c.json({ error: 'Journal, libellé et au moins deux lignes comptables sont requis.' }, 400);
  }

  const stmts = await buildJournalPostingStmts(c.env.DB, {
    companyId: company.id,
    journalCode: body.journalCode,
    date: body.date,
    reference: body.reference,
    label: body.label,
    lines: body.lines,
    sourceModule: body.sourceModule || 'accounting',
    sourceId: body.sourceId,
    email: user.email,
    ownerId: company.owner_id,
  });

  stmts.push(
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'POST_JOURNAL',
      module: 'accounting',
      summary: `Écriture ${body.journalCode} : ${body.label}`,
    })
  );

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/actions/treasury-move', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const body = await c.req
    .json<{
      direction?: 'encaissement' | 'decaissement';
      partnerName?: string;
      treasuryAccountId?: string;
      method?: 'virement' | 'especes' | 'cheque' | 'mobile_money';
      amount?: number;
      note?: string;
    }>()
    .catch(() => ({
      direction: undefined,
      partnerName: undefined,
      treasuryAccountId: undefined,
      method: undefined,
      amount: undefined,
      note: undefined,
    }));

  const amount = round2(Number(body.amount) || 0);
  if (!body.treasuryAccountId || !body.partnerName || amount <= 0) {
    return c.json({ error: 'Compte, tiers et montant positif obligatoires.' }, 400);
  }

  const treas = await getRecord<{ name: string; type: 'banque' | 'caisse'; accountCode?: string; balance: number }>(
    c.env.DB,
    company.id,
    'treasuryAccounts',
    body.treasuryAccountId
  );
  if (!treas) return c.json({ error: 'Compte de trésorerie introuvable.' }, 404);

  const direction = body.direction === 'decaissement' ? 'decaissement' : 'encaissement';
  const delta = direction === 'encaissement' ? amount : -amount;
  const payNum = await nextSequenceNumber(c.env.DB, company.id, direction === 'encaissement' ? 'ENC' : 'DEC');
  const paymentId = generateId();
  const treasCode = treas.accountCode || (treas.type === 'caisse' ? '571' : '521');

  const stmts: DbPreparedStatement[] = [
    buildUpdateRecordStmt(c.env.DB, company.id, 'treasuryAccounts', treas.id, {
      ...treas,
      balance: round2((treas.balance || 0) + delta),
    }),
    buildInsertRecordStmt(c.env.DB, company.id, 'payments', paymentId, company.owner_id, {
      number: payNum,
      direction,
      partnerType: 'autre',
      partnerName: sanitizeText(body.partnerName, 140),
      treasuryAccountId: treas.id,
      treasuryAccountName: treas.name,
      method: body.method || 'virement',
      amount,
      date: todayIso(),
      reference: payNum,
      note: sanitizeText(body.note, 300) || 'Opération de trésorerie diverse',
    }),
    ...(await buildJournalPostingStmts(c.env.DB, {
      companyId: company.id,
      journalCode: treas.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNum,
      label: `${direction === 'encaissement' ? 'Encaissement' : 'Décaissement'} : ${body.partnerName}`,
      lines:
        direction === 'encaissement'
          ? [
              { accountCode: treasCode, accountName: treas.name, debit: amount, credit: 0 },
              { accountCode: '706', accountName: 'Services vendus', debit: 0, credit: amount },
            ]
          : [
              { accountCode: '624', accountName: 'Entretien, réparations et maintenance', debit: amount, credit: 0 },
              { accountCode: treasCode, accountName: treas.name, debit: 0, credit: amount },
            ],
      sourceModule: 'treasury',
      sourceId: paymentId,
      email: user.email,
      ownerId: company.owner_id,
    })),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: direction === 'encaissement' ? 'TREASURY_IN' : 'TREASURY_OUT',
      module: 'treasury',
      entityType: 'payment',
      entityId: paymentId,
      summary: `${direction} ${payNum} de ${amount} (${body.partnerName}).`,
    }),
  ];

  await c.env.DB.batch(stmts);
  return c.json({ ok: true, paymentNumber: payNum });
});

apiApp.post('/api/companies/:companyId/actions/pay-payroll', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!canWrite(member, company)) return c.json({ error: 'Droits requis.' }, 403);

  const { payrollId, treasuryAccountId } = await c.req.json<{ payrollId?: string; treasuryAccountId?: string }>().catch(() => ({
    payrollId: '',
    treasuryAccountId: '',
  }));
  if (!payrollId || !treasuryAccountId) return c.json({ error: 'Bulletin et compte de trésorerie requis.' }, 400);

  const payroll = await getRecord<{
    period: string;
    employeeName: string;
    netSalary: number;
    status: string;
  }>(c.env.DB, company.id, 'payrolls', payrollId);
  if (!payroll) return c.json({ error: 'Bulletin de paie introuvable.' }, 404);
  if (payroll.status === 'payee') return c.json({ error: 'Ce bulletin est déjà payé.' }, 400);

  const treas = await getRecord<{ name: string; type: 'banque' | 'caisse'; accountCode?: string; balance: number }>(
    c.env.DB,
    company.id,
    'treasuryAccounts',
    treasuryAccountId
  );
  if (!treas) return c.json({ error: 'Compte de trésorerie introuvable.' }, 404);

  const payNum = await nextSequenceNumber(c.env.DB, company.id, 'PAIE');
  const paymentId = generateId();
  const treasCode = treas.accountCode || (treas.type === 'caisse' ? '571' : '521');

  const stmts: DbPreparedStatement[] = [
    buildUpdateRecordStmt(c.env.DB, company.id, 'payrolls', payroll.id, {
      ...payroll,
      status: 'payee',
      paidAt: todayIso(),
    }),
    buildUpdateRecordStmt(c.env.DB, company.id, 'treasuryAccounts', treas.id, {
      ...treas,
      balance: round2((treas.balance || 0) - payroll.netSalary),
    }),
    buildInsertRecordStmt(c.env.DB, company.id, 'payments', paymentId, company.owner_id, {
      number: payNum,
      direction: 'decaissement',
      partnerType: 'autre',
      partnerName: `Salaire ${payroll.employeeName}`,
      treasuryAccountId: treas.id,
      treasuryAccountName: treas.name,
      method: treas.type === 'caisse' ? 'especes' : 'virement',
      amount: payroll.netSalary,
      date: todayIso(),
      reference: payroll.period,
      note: `Paiement salaire ${payroll.period}`,
    }),
    ...(await buildJournalPostingStmts(c.env.DB, {
      companyId: company.id,
      journalCode: treas.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNum,
      label: `Paiement salaire ${payroll.employeeName} (${payroll.period})`,
      lines: [
        { accountCode: '661', accountName: 'Rémunérations directes versées au personnel', debit: payroll.netSalary, credit: 0 },
        { accountCode: treasCode, accountName: treas.name, debit: 0, credit: payroll.netSalary },
      ],
      sourceModule: 'hr',
      sourceId: payroll.id,
      email: user.email,
      ownerId: company.owner_id,
    })),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'PAY_PAYROLL',
      module: 'hr',
      entityType: 'payroll',
      entityId: payroll.id,
      summary: `Salaire de ${payroll.employeeName} (${payroll.period}) payé : ${payroll.netSalary}.`,
    }),
  ];

  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

apiApp.post('/api/companies/:companyId/actions/purge-demo', async (c) => {
  const user = c.get('user');
  const company = c.get('company');
  const member = c.get('member');
  if (!isOwnerOrAdmin(member, company)) return c.json({ error: 'Administrateur requis.' }, 403);

  const countRecords = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM erp_records WHERE company_id = ? AND is_demo = 1')
    .bind(company.id)
    .first<{ cnt: number }>();
  const countInvoices = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE company_id = ? AND is_demo = 1')
    .bind(company.id)
    .first<{ cnt: number }>();
  const deletedCount = Number(countRecords?.cnt || 0) + Number(countInvoices?.cnt || 0);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM erp_records WHERE company_id = ? AND is_demo = 1').bind(company.id),
    c.env.DB.prepare('DELETE FROM invoices WHERE company_id = ? AND is_demo = 1').bind(company.id),
    c.env.DB.prepare('UPDATE companies SET is_demo = 0, updated_at = ? WHERE id = ?').bind(nowIso(), company.id),
    await appendAuditStmt(c.env.DB, {
      companyId: company.id,
      uid: user.uid,
      email: user.email,
      ownerId: company.owner_id,
      action: 'PURGE_DEMO',
      module: 'admin',
      summary: `Suppression de ${deletedCount} enregistrements de démonstration.`,
    }),
  ]);

  return c.json({ deletedCount });
});

apiApp.get('/api/companies/:companyId/actions/backup', async (c) => {
  const company = c.get('company');
  const mUids = await getCompanyMemberUids(c.env.DB, company.id);
  const bundle = await loadCompanyBundle(c.env.DB, company.id);
  return c.json({
    exportedAt: nowIso(),
    company: mapCompanyDto(company, mUids),
    collections: bundle,
  });
});
