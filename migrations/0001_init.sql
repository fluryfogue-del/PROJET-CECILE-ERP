-- FUREX ERP Database Schema for Cloudflare D1 & Local SQLite

CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'entreprise',
  default_company_id TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'fr',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'entreprise',
  owner_first_name TEXT NOT NULL DEFAULT '',
  owner_last_name TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  legal_form TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  rccm TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'XAF',
  accounting_standard TEXT NOT NULL DEFAULT 'OHADA',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
  invoice_payment_terms TEXT NOT NULL DEFAULT 'Paiement à 30 jours net',
  invoice_notes_default TEXT NOT NULL DEFAULT 'Règlement par virement bancaire, chèque ou Mobile Money.',
  password_salt TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  enabled_modules_json TEXT NOT NULL DEFAULT '[]',
  owner_id TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(uid)
);

CREATE TABLE IF NOT EXISTS company_members (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role_code TEXT NOT NULL,
  department_name TEXT NOT NULL DEFAULT '',
  allowed_modules_json TEXT NOT NULL DEFAULT '[]',
  can_write INTEGER NOT NULL DEFAULT 1,
  can_validate INTEGER NOT NULL DEFAULT 0,
  can_delete INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(company_id, uid),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_members_uid ON company_members(uid);
CREATE INDEX IF NOT EXISTS idx_company_members_company ON company_members(company_id);

CREATE TABLE IF NOT EXISTS invoice_sequences (
  company_id TEXT NOT NULL,
  prefix TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, prefix, year),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  number TEXT NOT NULL,
  sales_order_id TEXT NOT NULL DEFAULT '',
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  customer_tax_id TEXT NOT NULL DEFAULT '',
  seller_snapshot_json TEXT NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'XAF',
  payment_terms TEXT NOT NULL DEFAULT 'Paiement à 30 jours net',
  date TEXT NOT NULL,
  due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'emise',
  subtotal REAL NOT NULL DEFAULT 0,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(company_id, customer_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  line_order INTEGER NOT NULL DEFAULT 0,
  product_id TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  category_name TEXT NOT NULL DEFAULT '',
  qty REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id, line_order ASC);

CREATE TABLE IF NOT EXISTS erp_records (
  company_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, collection_name, id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_erp_records_lookup
  ON erp_records(company_id, collection_name, created_at DESC);
