import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateDocNumber, round2, todayIso, addDaysIso, currentPeriod } from '../lib/format';
import {
  Account,
  AccountingStandard,
  CurrencyCode,
  DocumentLine,
  Employee,
  Invoice,
  JournalEntry,
  JournalLine,
  Lead,
  ModuleId,
  Payroll,
  Product,
  PurchaseOrder,
  Quote,
  RoleCode,
  SalesOrder,
  SupplierInvoice,
  TreasuryAccount,
} from '../types/erp';

export const ALL_MODULES: ModuleId[] = [
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
  const path = `companies/${params.companyId}/auditLogs`;
  try {
    const ref = doc(collection(db, path));
    await setDoc(ref, {
      userId: params.uid,
      userEmail: params.email,
      action: params.action,
      module: params.module,
      entityType: params.entityType || '',
      entityId: params.entityId || '',
      summary: params.summary.slice(0, 490),
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      createdAt: serverTimestamp(),
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
  const path = `companies/${params.companyId}/notifications`;
  try {
    const ref = doc(collection(db, path));
    await setDoc(ref, {
      title: params.title.slice(0, 130),
      message: params.message.slice(0, 380),
      severity: params.severity,
      module: params.module,
      read: false,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notification write skipped:', error);
  }
}

export async function createCompanyWorkspace(params: {
  uid: string;
  email: string;
  displayName: string;
  name: string;
  currency: CurrencyCode;
  accountingStandard: AccountingStandard;
  withDemoData: boolean;
}): Promise<string> {
  const companyRef = doc(collection(db, 'companies'));
  const companyId = companyRef.id;
  const memberUids = [params.uid];

  try {
    // Step 1: Create parent company first so security rule get() / exists() sees it
    await setDoc(companyRef, {
      name: params.name,
      legalForm: params.withDemoData ? 'SARL' : 'SAS',
      taxId: params.withDemoData ? 'M042619874321K' : '',
      rccm: params.withDemoData ? 'RC/DLA/2024/B/1482' : '',
      currency: params.currency,
      accountingStandard: params.accountingStandard,
      address: params.withDemoData ? 'Boulevard de la Liberté, Douala' : '',
      phone: params.withDemoData ? '+237 699 42 18 00' : '',
      email: params.email,
      ownerId: params.uid,
      memberUids,
      isDemo: params.withDemoData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Step 2: Create owner member record + user defaultCompanyId
    const memberRef = doc(db, `companies/${companyId}/members/${params.uid}`);
    await setDoc(memberRef, {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      roleCode: 'admin',
      departmentName: 'Direction Générale',
      allowedModules: ALL_MODULES,
      canWrite: true,
      canValidate: true,
      canDelete: true,
      active: true,
      ownerId: params.uid,
      memberUids,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'users', params.uid), {
      defaultCompanyId: companyId,
      updatedAt: serverTimestamp(),
    });

    // Step 3: Seed roles, departments, OHADA accounts, default warehouse & treasury
    const batch1 = writeBatch(db);

    const roleSeeds: Array<{
      code: RoleCode;
      name: string;
      description: string;
      allowedModules: ModuleId[];
      canWrite: boolean;
      canValidate: boolean;
      canDelete: boolean;
    }> = [
      {
        code: 'admin',
        name: 'Administrateur Système',
        description: 'Accès complet à tous les modules et à la sécurité.',
        allowedModules: ALL_MODULES,
        canWrite: true,
        canValidate: true,
        canDelete: true,
      },
      {
        code: 'direction',
        name: 'Direction Générale',
        description: 'Pilotage stratégique, validations et analytics.',
        allowedModules: ['dashboard', 'crm', 'sales', 'purchases', 'inventory', 'accounting', 'treasury', 'hr', 'reporting', 'docs'],
        canWrite: true,
        canValidate: true,
        canDelete: false,
      },
      {
        code: 'commercial',
        name: 'Responsable Commercial',
        description: 'Gestion CRM, devis, commandes clients et facturation.',
        allowedModules: ['dashboard', 'crm', 'sales', 'inventory', 'reporting', 'docs'],
        canWrite: true,
        canValidate: true,
        canDelete: false,
      },
      {
        code: 'comptable',
        name: 'Chef Comptable OHADA',
        description: 'Comptabilité générale, journaux, trésorerie et bilans.',
        allowedModules: ['dashboard', 'sales', 'purchases', 'accounting', 'treasury', 'reporting', 'docs'],
        canWrite: true,
        canValidate: true,
        canDelete: false,
      },
      {
        code: 'magasinier',
        name: 'Gestionnaire de Stocks',
        description: 'Entrepôts, réceptions, transferts et inventaires.',
        allowedModules: ['dashboard', 'inventory', 'purchases', 'sales', 'docs'],
        canWrite: true,
        canValidate: false,
        canDelete: false,
      },
      {
        code: 'rh',
        name: 'Responsable RH',
        description: 'Dossiers employés, congés, absences et paie.',
        allowedModules: ['dashboard', 'hr', 'reporting', 'docs'],
        canWrite: true,
        canValidate: true,
        canDelete: false,
      },
    ];

    roleSeeds.forEach((r) => {
      const ref = doc(collection(db, `companies/${companyId}/roles`));
      batch1.set(ref, {
        ...r,
        ownerId: params.uid,
        memberUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    const deptSeeds = [
      { code: 'DIR', name: 'Direction Générale', managerName: params.displayName, budget: 15000000 },
      { code: 'COM', name: 'Ventes & CRM', managerName: 'Claire Mbarga', budget: 8500000 },
      { code: 'FIN', name: 'Finance & Comptabilité', managerName: 'Marc Essomba', budget: 6000000 },
      { code: 'LOG', name: 'Logistique & Stocks', managerName: 'Paul Nkodo', budget: 9200000 },
      { code: 'RH', name: 'Ressources Humaines', managerName: 'Nadine Kamga', budget: 5400000 },
    ];

    deptSeeds.forEach((d) => {
      const ref = doc(collection(db, `companies/${companyId}/departments`));
      batch1.set(ref, {
        ...d,
        ownerId: params.uid,
        memberUids,
        isDemo: params.withDemoData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    OHADA_DEFAULT_ACCOUNTS.forEach((acc) => {
      const ref = doc(collection(db, `companies/${companyId}/accounts`));
      let balanceDebit = 0;
      let balanceCredit = 0;
      if (params.withDemoData) {
        if (acc.code === '101') balanceCredit = 25000000;
        if (acc.code === '521') balanceDebit = 14850000;
        if (acc.code === '571') balanceDebit = 1650000;
        if (acc.code === '411') balanceDebit = 4250000;
        if (acc.code === '401') balanceCredit = 2850000;
        if (acc.code === '701') balanceCredit = 18400000;
        if (acc.code === '601') balanceDebit = 9100000;
        if (acc.code === '661') balanceDebit = 3450000;
        if (acc.code === '443') balanceCredit = 3542000;
        if (acc.code === '445') balanceDebit = 1751750;
      }
      batch1.set(ref, {
        ...acc,
        balanceDebit,
        balanceCredit,
        isSystem: true,
        ownerId: params.uid,
        memberUids,
        isDemo: params.withDemoData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch1.commit();

    // Default warehouse + treasury accounts even for non-demo companies
    const whMainRef = doc(collection(db, `companies/${companyId}/warehouses`));
    const whSecRef = doc(collection(db, `companies/${companyId}/warehouses`));
    const bankRef = doc(collection(db, `companies/${companyId}/treasuryAccounts`));
    const cashRef = doc(collection(db, `companies/${companyId}/treasuryAccounts`));

    const batch2 = writeBatch(db);
    batch2.set(whMainRef, {
      code: 'ENT-01',
      name: 'Entrepôt Central',
      location: params.withDemoData ? 'Zone Industrielle Bassa, Douala' : 'Siège Principal',
      managerName: params.withDemoData ? 'Paul Nkodo' : params.displayName,
      isDefault: true,
      ownerId: params.uid,
      memberUids,
      isDemo: params.withDemoData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.withDemoData) {
      batch2.set(whSecRef, {
        code: 'ENT-02',
        name: 'Dépôt Yaoundé Nord',
        location: 'Quartier Bastos, Yaoundé',
        managerName: 'Serge Biya',
        isDefault: false,
        ownerId: params.uid,
        memberUids,
        isDemo: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch2.set(bankRef, {
      name: params.withDemoData ? 'Compte Courant Afriland First Bank' : 'Compte Bancaire Principal',
      type: 'banque',
      bankName: params.withDemoData ? 'Afriland First Bank' : 'Banque Principale',
      iban: params.withDemoData ? 'CM21 10005 00001 04589210112 88' : '',
      accountCode: '521',
      balance: params.withDemoData ? 14850000 : 0,
      currency: params.currency,
      ownerId: params.uid,
      memberUids,
      isDemo: params.withDemoData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch2.set(cashRef, {
      name: 'Caisse Principale Siège',
      type: 'caisse',
      bankName: 'Caisse interne',
      iban: '',
      accountCode: '571',
      balance: params.withDemoData ? 1650000 : 0,
      currency: params.currency,
      ownerId: params.uid,
      memberUids,
      isDemo: params.withDemoData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch2.commit();

    if (params.withDemoData) {
      await seedDemoOperationalData({
        companyId,
        uid: params.uid,
        email: params.email,
        memberUids,
        whMainId: whMainRef.id,
        whSecId: whSecRef.id,
        bankId: bankRef.id,
        cashId: cashRef.id,
      });
    }

    await logAudit({
      companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.uid,
      memberUids,
      action: 'CREATE',
      module: 'admin',
      entityType: 'company',
      entityId: companyId,
      summary: `Initialisation de la société ${params.name} (${params.withDemoData ? 'avec données de démonstration' : 'vierge'})`,
    });

    return companyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'companies');
  }
}

async function seedDemoOperationalData(opts: {
  companyId: string;
  uid: string;
  email: string;
  memberUids: string[];
  whMainId: string;
  whSecId: string;
  bankId: string;
  cashId: string;
}) {
  const { companyId, uid, email, memberUids, whMainId, whSecId, bankId, cashId } = opts;
  const batch = writeBatch(db);

  // Categories
  const cats = [
    { code: 'INF', name: 'Matériel Informatique', description: 'Ordinateurs, serveurs et périphériques' },
    { code: 'MOB', name: 'Mobilier de Bureau', description: 'Bureaux, sièges ergonomiques et rangements' },
    { code: 'RES', name: 'Réseaux & Télécoms', description: 'Routeurs, switchs et câblage' },
    { code: 'SRV', name: 'Services & Maintenance', description: 'Prestations d’installation et support' },
  ];
  const catIds: string[] = [];
  cats.forEach((c) => {
    const ref = doc(collection(db, `companies/${companyId}/categories`));
    catIds.push(ref.id);
    batch.set(ref, {
      ...c,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Products
  const prodSeeds = [
    {
      sku: 'PRD-LAP-01',
      name: 'Ordinateur Portable ProBook 15"',
      categoryId: catIds[0],
      categoryName: 'Matériel Informatique',
      unit: 'Unité',
      purchasePrice: 420000,
      salePrice: 590000,
      taxRate: 19.25,
      stockQty: 24,
      minStock: 8,
      warehouseStocks: { [whMainId]: 18, [whSecId]: 6 },
    },
    {
      sku: 'PRD-SRV-02',
      name: 'Serveur Rack Enterprise 2U',
      categoryId: catIds[0],
      categoryName: 'Matériel Informatique',
      unit: 'Unité',
      purchasePrice: 1650000,
      salePrice: 2350000,
      taxRate: 19.25,
      stockQty: 5,
      minStock: 3,
      warehouseStocks: { [whMainId]: 4, [whSecId]: 1 },
    },
    {
      sku: 'PRD-MOB-03',
      name: 'Fauteuil Direction Ergonomique',
      categoryId: catIds[1],
      categoryName: 'Mobilier de Bureau',
      unit: 'Unité',
      purchasePrice: 95000,
      salePrice: 145000,
      taxRate: 19.25,
      stockQty: 4,
      minStock: 6,
      warehouseStocks: { [whMainId]: 3, [whSecId]: 1 },
    },
    {
      sku: 'PRD-NET-04',
      name: 'Switch Manageable 24 Ports PoE',
      categoryId: catIds[2],
      categoryName: 'Réseaux & Télécoms',
      unit: 'Unité',
      purchasePrice: 185000,
      salePrice: 275000,
      taxRate: 19.25,
      stockQty: 14,
      minStock: 5,
      warehouseStocks: { [whMainId]: 10, [whSecId]: 4 },
    },
    {
      sku: 'PRD-IMP-05',
      name: 'Imprimante Laser Multifonction Réseau',
      categoryId: catIds[0],
      categoryName: 'Matériel Informatique',
      unit: 'Unité',
      purchasePrice: 210000,
      salePrice: 315000,
      taxRate: 19.25,
      stockQty: 9,
      minStock: 4,
      warehouseStocks: { [whMainId]: 7, [whSecId]: 2 },
    },
  ];
  const prodRefs = prodSeeds.map((p) => {
    const ref = doc(collection(db, `companies/${companyId}/products`));
    batch.set(ref, {
      ...p,
      trackStock: true,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...p };
  });

  // Customers
  const custSeeds = [
    {
      code: 'CLI-001',
      name: 'Société Atlantique Logistique SA',
      segment: 'B2B' as const,
      email: 'achats@atlantique-log.cm',
      phone: '+237 677 12 45 90',
      address: 'Bonanjo, Douala',
      taxId: 'M051900231441A',
      creditLimit: 15000000,
      balanceDue: 2750000,
    },
    {
      code: 'CLI-002',
      name: 'Groupe Horizon BTP',
      segment: 'B2B' as const,
      email: 'finance@horizonbtp.cm',
      phone: '+237 691 34 88 12',
      address: 'Bastos, Yaoundé',
      taxId: 'M082011223344C',
      creditLimit: 20000000,
      balanceDue: 1500000,
    },
    {
      code: 'CLI-003',
      name: 'Clinique Saint-Michel',
      segment: 'Administration' as const,
      email: 'direction@clinique-sm.cm',
      phone: '+237 655 09 32 10',
      address: 'Akwa, Douala',
      taxId: 'M011899887766Z',
      creditLimit: 10000000,
      balanceDue: 0,
    },
  ];
  const custRefs = custSeeds.map((c) => {
    const ref = doc(collection(db, `companies/${companyId}/customers`));
    batch.set(ref, {
      ...c,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...c };
  });

  // Leads
  const leadSeeds = [
    {
      name: 'Henriette Fouda',
      companyName: 'AgroTech Cameroun',
      email: 'h.fouda@agrotech.cm',
      phone: '+237 690 21 33 44',
      source: 'Salon Professionnel',
      status: 'qualifie' as const,
      estimatedValue: 4800000,
      notes: 'Besoin de 10 postes ProBook et équipement réseau.',
    },
    {
      name: 'Alain Tchoumi',
      companyName: 'Cabinet Juridique Tchoumi',
      email: 'contact@tchoumi-law.cm',
      phone: '+237 675 44 10 22',
      source: 'Recommandation',
      status: 'nouveau' as const,
      estimatedValue: 1850000,
      notes: 'Demande de devis mobilier et imprimantes.',
    },
  ];
  leadSeeds.forEach((l) => {
    const ref = doc(collection(db, `companies/${companyId}/leads`));
    batch.set(ref, {
      ...l,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Opportunities
  const oppSeeds = [
    {
      title: 'Renouvellement Parc Informatique Q4',
      customerId: custRefs[0].id,
      customerName: custRefs[0].name,
      stage: 'negociation' as const,
      amount: 7200000,
      probability: 75,
      expectedCloseDate: addDaysIso(15),
    },
    {
      title: 'Infrastructure Réseau Siège Yaoundé',
      customerId: custRefs[1].id,
      customerName: custRefs[1].name,
      stage: 'proposition' as const,
      amount: 4600000,
      probability: 55,
      expectedCloseDate: addDaysIso(30),
    },
    {
      title: 'Équipement Bureaux Clinique',
      customerId: custRefs[2].id,
      customerName: custRefs[2].name,
      stage: 'gagnee' as const,
      amount: 3450000,
      probability: 100,
      expectedCloseDate: todayIso(),
    },
  ];
  oppSeeds.forEach((o) => {
    const ref = doc(collection(db, `companies/${companyId}/opportunities`));
    batch.set(ref, {
      ...o,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  // Suppliers
  const supSeeds = [
    {
      code: 'FRN-001',
      name: 'TechnoImport Distribution',
      email: 'commandes@technoimport.cm',
      phone: '+237 233 42 78 19',
      address: 'Port Autonome, Douala',
      taxId: 'M031455667788P',
      paymentTerms: '30 jours net',
      balancePayable: 2850000,
    },
    {
      code: 'FRN-002',
      name: 'Mobilier Pro Afrique',
      email: 'ventes@mobilierpro.cm',
      phone: '+237 699 88 77 66',
      address: 'Zone Bonabéri, Douala',
      taxId: 'M091722334455R',
      paymentTerms: 'Comptant / 15 jours',
      balancePayable: 0,
    },
  ];
  const supRefs = supSeeds.map((s) => {
    const ref = doc(collection(db, `companies/${companyId}/suppliers`));
    batch.set(ref, {
      ...s,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...s };
  });

  // Sales Orders + Invoices across recent months for rich real chart calculations
  const monthsOffsets = [-3, -2, -1, 0];
  monthsOffsets.forEach((offset, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    const dateStr = d.toISOString().slice(0, 10);
    const dueD = new Date(d);
    dueD.setDate(dueD.getDate() + 30);
    const dueStr = dueD.toISOString().slice(0, 10);

    const p = prodRefs[idx % prodRefs.length];
    const cust = custRefs[idx % custRefs.length];
    const qty = 3 + idx * 2;
    const calc = computeDocumentTotals([
      {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        qty,
        unitPrice: p.salePrice,
        discountPct: idx === 1 ? 5 : 0,
        taxRate: p.taxRate,
        lineTotal: 0,
      },
    ]);

    const orderRef = doc(collection(db, `companies/${companyId}/salesOrders`));
    const invRef = doc(collection(db, `companies/${companyId}/invoices`));
    const isPaid = idx < 2;
    const isPartial = idx === 2;
    const paidAmount = isPaid ? calc.total : isPartial ? round2(calc.total * 0.4) : 0;
    const balanceDue = round2(calc.total - paidAmount);

    batch.set(orderRef, {
      number: `CMD-2026-${101 + idx}`,
      customerId: cust.id,
      customerName: cust.name,
      warehouseId: whMainId,
      date: dateStr,
      status: 'facturee',
      lines: calc.lines,
      subtotal: calc.subtotal,
      discountTotal: calc.discountTotal,
      taxTotal: calc.taxTotal,
      total: calc.total,
      invoiceId: invRef.id,
      notes: 'Commande livrée et facturée (démonstration)',
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(invRef, {
      number: `FAC-2026-${201 + idx}`,
      salesOrderId: orderRef.id,
      customerId: cust.id,
      customerName: cust.name,
      customerEmail: cust.email,
      date: dateStr,
      dueDate: dueStr,
      status: isPaid ? 'payee' : isPartial ? 'partielle' : 'emise',
      lines: calc.lines,
      subtotal: calc.subtotal,
      discountTotal: calc.discountTotal,
      taxTotal: calc.taxTotal,
      total: calc.total,
      paidAmount,
      balanceDue,
      notes: 'Règlement par virement bancaire ou chèque.',
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (paidAmount > 0) {
      const payRef = doc(collection(db, `companies/${companyId}/payments`));
      batch.set(payRef, {
        number: `ENC-2026-${301 + idx}`,
        direction: 'encaissement',
        partnerType: 'client',
        partnerId: cust.id,
        partnerName: cust.name,
        invoiceId: invRef.id,
        invoiceNumber: `FAC-2026-${201 + idx}`,
        treasuryAccountId: idx % 2 === 0 ? bankId : cashId,
        treasuryAccountName: idx % 2 === 0 ? 'Compte Courant Afriland First Bank' : 'Caisse Principale Siège',
        method: idx % 2 === 0 ? 'virement' : 'especes',
        amount: paidAmount,
        date: dateStr,
        reference: `VIR-${1040 + idx}`,
        note: 'Règlement facture client',
        ownerId: uid,
        memberUids,
        isDemo: true,
        createdAt: serverTimestamp(),
      });
    }
  });

  // Demo Quote
  const qCalc = computeDocumentTotals([
    {
      productId: prodRefs[1].id,
      sku: prodRefs[1].sku,
      name: prodRefs[1].name,
      categoryName: prodRefs[1].categoryName,
      qty: 2,
      unitPrice: prodRefs[1].salePrice,
      discountPct: 5,
      taxRate: 19.25,
      lineTotal: 0,
    },
  ]);
  batch.set(doc(collection(db, `companies/${companyId}/quotes`)), {
    number: 'DEV-2026-089',
    customerId: custRefs[1].id,
    customerName: custRefs[1].name,
    date: todayIso(),
    validUntil: addDaysIso(30),
    status: 'envoye',
    lines: qCalc.lines,
    subtotal: qCalc.subtotal,
    discountTotal: qCalc.discountTotal,
    taxTotal: qCalc.taxTotal,
    total: qCalc.total,
    notes: 'Offre valable 30 jours, installation incluse.',
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Demo Purchase Order + Supplier Invoice
  const poCalc = computeDocumentTotals([
    {
      productId: prodRefs[0].id,
      sku: prodRefs[0].sku,
      name: prodRefs[0].name,
      categoryName: prodRefs[0].categoryName,
      qty: 10,
      unitPrice: prodRefs[0].purchasePrice,
      discountPct: 0,
      taxRate: 19.25,
      lineTotal: 0,
    },
  ]);
  const poRef = doc(collection(db, `companies/${companyId}/purchaseOrders`));
  batch.set(poRef, {
    number: 'BCF-2026-045',
    supplierId: supRefs[0].id,
    supplierName: supRefs[0].name,
    warehouseId: whMainId,
    date: todayIso(),
    expectedDate: addDaysIso(7),
    status: 'envoyee',
    lines: poCalc.lines,
    subtotal: poCalc.subtotal,
    taxTotal: poCalc.taxTotal,
    total: poCalc.total,
    notes: 'Réapprovisionnement stock ProBook',
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, `companies/${companyId}/supplierInvoices`)), {
    number: 'FFR-2026-019',
    supplierId: supRefs[0].id,
    supplierName: supRefs[0].name,
    date: todayIso(),
    dueDate: addDaysIso(30),
    status: 'en_attente',
    total: 2850000,
    paidAmount: 0,
    balanceDue: 2850000,
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Stock Movement initial
  batch.set(doc(collection(db, `companies/${companyId}/stockMovements`)), {
    productId: prodRefs[0].id,
    productName: prodRefs[0].name,
    sku: prodRefs[0].sku,
    warehouseId: whMainId,
    warehouseName: 'Entrepôt Central',
    type: 'entree',
    quantity: 18,
    unitCost: prodRefs[0].purchasePrice,
    totalValue: 18 * prodRefs[0].purchasePrice,
    referenceType: 'initial',
    referenceNumber: 'INI-2026-001',
    note: 'Stock initial de démonstration',
    date: todayIso(),
    authorEmail: email,
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
  });

  // Journal Entries (OHADA)
  batch.set(doc(collection(db, `companies/${companyId}/journalEntries`)), {
    number: 'OD-2026-001',
    date: todayIso(),
    journalCode: 'OD',
    reference: 'BILAN-OUV',
    label: 'Apport en capital et ouverture trésorerie OHADA',
    lines: [
      { accountCode: '521', accountName: 'Banques locales', debit: 14850000, credit: 0 },
      { accountCode: '571', accountName: 'Caisse siège', debit: 1650000, credit: 0 },
      { accountCode: '101', accountName: 'Capital social', debit: 0, credit: 16500000 },
    ],
    totalDebit: 16500000,
    totalCredit: 16500000,
    sourceModule: 'accounting',
    status: 'validee',
    authorEmail: email,
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
  });

  // Employees, Leaves, Payrolls
  const empSeeds = [
    {
      matricule: 'EMP-001',
      firstName: 'Claire',
      lastName: 'Mbarga',
      email: 'c.mbarga@cecile-erp.cm',
      phone: '+237 699 11 22 33',
      departmentName: 'Ventes & CRM',
      position: 'Directrice Commerciale',
      contractType: 'CDI' as const,
      hireDate: '2022-03-15',
      baseSalary: 950000,
      status: 'actif' as const,
      history: ['2022-03-15 : Embauche CDI Responsable Commerciale', '2024-01-01 : Promotion Directrice Commerciale'],
    },
    {
      matricule: 'EMP-002',
      firstName: 'Marc',
      lastName: 'Essomba',
      email: 'm.essomba@cecile-erp.cm',
      phone: '+237 677 55 44 33',
      departmentName: 'Finance & Comptabilité',
      position: 'Chef Comptable OHADA',
      contractType: 'CDI' as const,
      hireDate: '2021-09-01',
      baseSalary: 850000,
      status: 'actif' as const,
      history: ['2021-09-01 : Embauche CDI Comptable Senior'],
    },
    {
      matricule: 'EMP-003',
      firstName: 'Paul',
      lastName: 'Nkodo',
      email: 'p.nkodo@cecile-erp.cm',
      phone: '+237 655 66 77 88',
      departmentName: 'Logistique & Stocks',
      position: 'Chef Magasinier',
      contractType: 'CDI' as const,
      hireDate: '2023-02-10',
      baseSalary: 480000,
      status: 'actif' as const,
      history: ['2023-02-10 : Embauche CDI Chef Magasinier'],
    },
    {
      matricule: 'EMP-004',
      firstName: 'Nadine',
      lastName: 'Kamga',
      email: 'n.kamga@cecile-erp.cm',
      phone: '+237 694 32 10 98',
      departmentName: 'Ressources Humaines',
      position: 'Chargée RH & Paie',
      contractType: 'CDD' as const,
      hireDate: '2025-01-06',
      baseSalary: 520000,
      status: 'actif' as const,
      history: ['2025-01-06 : Contrat CDD 24 mois'],
    },
  ];
  const empRefs = empSeeds.map((emp) => {
    const ref = doc(collection(db, `companies/${companyId}/employees`));
    batch.set(ref, {
      ...emp,
      ownerId: uid,
      memberUids,
      isDemo: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, ...emp };
  });

  batch.set(doc(collection(db, `companies/${companyId}/leaves`)), {
    employeeId: empRefs[2].id,
    employeeName: `${empRefs[2].firstName} ${empRefs[2].lastName}`,
    type: 'conge_paye',
    startDate: addDaysIso(10),
    endDate: addDaysIso(15),
    days: 5,
    reason: 'Congé annuel planifié',
    status: 'en_attente',
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(collection(db, `companies/${companyId}/payrolls`)), {
    period: currentPeriod(),
    employeeId: empRefs[0].id,
    employeeName: `${empRefs[0].firstName} ${empRefs[0].lastName}`,
    departmentName: empRefs[0].departmentName,
    baseSalary: empRefs[0].baseSalary,
    bonuses: 120000,
    deductions: 45000,
    netSalary: empRefs[0].baseSalary + 120000 - 45000,
    status: 'validee',
    ownerId: uid,
    memberUids,
    isDemo: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Low-stock alert notification
  batch.set(doc(collection(db, `companies/${companyId}/notifications`)), {
    title: 'Alerte Stock Minimum',
    message: 'Fauteuil Direction Ergonomique (PRD-MOB-03) : stock actuel 4 unités ≤ seuil 6.',
    severity: 'warning',
    module: 'inventory',
    read: false,
    ownerId: uid,
    memberUids,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function purgeDemoData(params: {
  companyId: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}): Promise<number> {
  const collectionsToClean = [
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
    'invoices',
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
    'departments',
  ];

  let deletedCount = 0;
  for (const col of collectionsToClean) {
    const q = query(
      collection(db, `companies/${params.companyId}/${col}`),
      where('memberUids', 'array-contains', params.uid)
    );
    const snap = await getDocs(q);
    const demoDocs = snap.docs.filter((d) => d.data().isDemo === true);
    for (let i = 0; i < demoDocs.length; i += 450) {
      const chunk = demoDocs.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.delete(d.ref);
        deletedCount++;
      });
      await batch.commit();
    }
  }

  await updateDoc(doc(db, 'companies', params.companyId), {
    isDemo: false,
    updatedAt: serverTimestamp(),
  });

  await logAudit({
    companyId: params.companyId,
    uid: params.uid,
    email: params.email,
    ownerId: params.ownerId,
    memberUids: params.memberUids,
    action: 'PURGE_DEMO',
    module: 'admin',
    summary: `Suppression de ${deletedCount} enregistrements de démonstration.`,
  });

  return deletedCount;
}

export async function convertLeadToCustomer(params: {
  companyId: string;
  lead: Lead;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  const customerRef = doc(collection(db, `companies/${params.companyId}/customers`));
  const leadRef = doc(db, `companies/${params.companyId}/leads`, params.lead.id);
  const code = generateDocNumber('CLI').slice(0, 12);

  try {
    await runTransaction(db, async (tx) => {
      tx.set(customerRef, {
        code,
        name: params.lead.companyName || params.lead.name,
        segment: params.lead.companyName ? 'B2B' : 'B2C',
        email: params.lead.email || '',
        phone: params.lead.phone || '',
        address: '',
        taxId: '',
        creditLimit: 5000000,
        balanceDue: 0,
        leadId: params.lead.id,
        notes: params.lead.notes || `Converti depuis le prospect ${params.lead.name}`,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(leadRef, {
        status: 'converti',
        updatedAt: serverTimestamp(),
      });
    });

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'CONVERT_LEAD',
      module: 'crm',
      entityType: 'customer',
      entityId: customerRef.id,
      summary: `Prospect ${params.lead.name} converti en client (${code}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/customers`);
  }
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
  const orderRef = doc(collection(db, `companies/${params.companyId}/salesOrders`));
  const quoteRef = doc(db, `companies/${params.companyId}/quotes`, params.quote.id);
  const orderNumber = generateDocNumber('CMD');

  try {
    await runTransaction(db, async (tx) => {
      tx.set(orderRef, {
        number: orderNumber,
        quoteId: params.quote.id,
        customerId: params.quote.customerId,
        customerName: params.quote.customerName,
        warehouseId: params.warehouseId,
        date: todayIso(),
        status: 'brouillon',
        lines: params.quote.lines,
        subtotal: params.quote.subtotal,
        discountTotal: params.quote.discountTotal,
        taxTotal: params.quote.taxTotal,
        total: params.quote.total,
        notes: params.quote.notes || '',
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(quoteRef, {
        status: 'converti',
        salesOrderId: orderRef.id,
        updatedAt: serverTimestamp(),
      });
    });

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'CONVERT_QUOTE',
      module: 'sales',
      entityType: 'salesOrder',
      entityId: orderRef.id,
      summary: `Devis ${params.quote.number} converti en commande ${orderNumber}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/salesOrders`);
  }
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
  const orderRef = doc(db, `companies/${params.companyId}/salesOrders`, params.order.id);
  const lowStockAlerts: string[] = [];

  try {
    await runTransaction(db, async (tx) => {
      const productSnapshots: Array<{
        ref: ReturnType<typeof doc>;
        product: Product;
        qtyOut: number;
      }> = [];

      for (const line of params.order.lines) {
        const pRef = doc(db, `companies/${params.companyId}/products`, line.productId);
        const snap = await tx.get(pRef);
        if (!snap.exists()) {
          throw new Error(`Article introuvable : ${line.name}`);
        }
        const prod = { id: snap.id, ...snap.data() } as Product;
        if (prod.stockQty < line.qty) {
          throw new Error(
            `Stock insuffisant pour "${prod.name}" (disponible : ${prod.stockQty}, demandé : ${line.qty}).`
          );
        }
        productSnapshots.push({ ref: pRef, product: prod, qtyOut: line.qty });
      }

      for (const item of productSnapshots) {
        const newTotalQty = round2(item.product.stockQty - item.qtyOut);
        const whMap = { ...(item.product.warehouseStocks || {}) };
        const currentWhQty = whMap[params.order.warehouseId] ?? item.product.stockQty;
        whMap[params.order.warehouseId] = Math.max(0, round2(currentWhQty - item.qtyOut));

        tx.update(item.ref, {
          stockQty: newTotalQty,
          warehouseStocks: whMap,
          updatedAt: serverTimestamp(),
        });

        const movRef = doc(collection(db, `companies/${params.companyId}/stockMovements`));
        tx.set(movRef, {
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          warehouseId: params.order.warehouseId,
          warehouseName: params.warehouseName,
          type: 'sortie',
          quantity: item.qtyOut,
          unitCost: item.product.purchasePrice,
          totalValue: round2(item.qtyOut * item.product.purchasePrice),
          referenceType: 'salesOrder',
          referenceNumber: params.order.number,
          note: `Sortie sur validation commande ${params.order.number}`,
          date: todayIso(),
          authorEmail: params.email,
          ownerId: params.ownerId,
          memberUids: params.memberUids,
          isDemo: false,
          createdAt: serverTimestamp(),
        });

        if (newTotalQty <= item.product.minStock) {
          lowStockAlerts.push(`${item.product.name} (${newTotalQty} ≤ seuil ${item.product.minStock})`);
        }
      }

      tx.update(orderRef, {
        status: 'validee',
        updatedAt: serverTimestamp(),
      });
    });

    for (const alertMsg of lowStockAlerts) {
      await pushNotification({
        companyId: params.companyId,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        title: 'Alerte Stock Minimum',
        message: alertMsg,
        severity: 'warning',
        module: 'inventory',
      });
    }

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'VALIDATE_ORDER',
      module: 'sales',
      entityType: 'salesOrder',
      entityId: params.order.id,
      summary: `Commande ${params.order.number} validée avec sortie de stock.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Stock insuffisant')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `companies/${params.companyId}/salesOrders/${params.order.id}`);
  }
}

async function applyAccountingEntryAndAccountBalances(params: {
  companyId: string;
  accounts: Account[];
  journalCode: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
  reference: string;
  label: string;
  lines: JournalLine[];
  sourceModule: string;
  sourceId: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  const totalDebit = round2(params.lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(params.lines.reduce((s, l) => s + l.credit, 0));
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) >= 0.01) {
    throw new Error('Écriture comptable déséquilibrée : Total Débit doit égaler Total Crédit.');
  }

  const batch = writeBatch(db);
  const entryRef = doc(collection(db, `companies/${params.companyId}/journalEntries`));
  batch.set(entryRef, {
    number: generateDocNumber(params.journalCode),
    date: todayIso(),
    journalCode: params.journalCode,
    reference: params.reference,
    label: params.label.slice(0, 230),
    lines: params.lines,
    totalDebit,
    totalCredit,
    sourceModule: params.sourceModule,
    sourceId: params.sourceId,
    status: 'validee',
    authorEmail: params.email,
    ownerId: params.ownerId,
    memberUids: params.memberUids,
    isDemo: false,
    createdAt: serverTimestamp(),
  });

  const deltas = new Map<string, { debit: number; credit: number }>();
  for (const line of params.lines) {
    const cur = deltas.get(line.accountCode) || { debit: 0, credit: 0 };
    deltas.set(line.accountCode, {
      debit: round2(cur.debit + (line.debit || 0)),
      credit: round2(cur.credit + (line.credit || 0)),
    });
  }

  deltas.forEach((delta, accountCode) => {
    const acc = params.accounts.find((a) => a.code === accountCode);
    if (acc) {
      batch.update(doc(db, `companies/${params.companyId}/accounts`, acc.id), {
        balanceDebit: round2((acc.balanceDebit || 0) + delta.debit),
        balanceCredit: round2((acc.balanceCredit || 0) + delta.credit),
        updatedAt: serverTimestamp(),
      });
    }
  });

  await batch.commit();
}

export async function createInvoiceFromOrder(params: {
  companyId: string;
  order: SalesOrder;
  customerEmail?: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  const invRef = doc(collection(db, `companies/${params.companyId}/invoices`));
  const invNumber = generateDocNumber('FAC');
  const orderRef = doc(db, `companies/${params.companyId}/salesOrders`, params.order.id);
  const custRef = doc(db, `companies/${params.companyId}/customers`, params.order.customerId);

  try {
    await runTransaction(db, async (tx) => {
      const custSnap = await tx.get(custRef);
      const currentDue = custSnap.exists() ? (custSnap.data().balanceDue || 0) : 0;

      tx.set(invRef, {
        number: invNumber,
        salesOrderId: params.order.id,
        customerId: params.order.customerId,
        customerName: params.order.customerName,
        customerEmail: params.customerEmail || '',
        date: todayIso(),
        dueDate: addDaysIso(30),
        status: 'emise',
        lines: params.order.lines,
        subtotal: params.order.subtotal,
        discountTotal: params.order.discountTotal,
        taxTotal: params.order.taxTotal,
        total: params.order.total,
        paidAmount: 0,
        balanceDue: params.order.total,
        notes: 'Facture générée automatiquement depuis commande validée.',
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.update(orderRef, {
        status: 'facturee',
        invoiceId: invRef.id,
        updatedAt: serverTimestamp(),
      });

      if (custSnap.exists()) {
        tx.update(custRef, {
          balanceDue: round2(currentDue + params.order.total),
          updatedAt: serverTimestamp(),
        });
      }
    });

    // Automatic OHADA accounting entry: 411 Débit / 701 + 443 Crédit
    const netHt = round2(params.order.total - params.order.taxTotal);
    const lines: JournalLine[] = [
      { accountCode: '411', accountName: 'Clients, créances en compte', debit: params.order.total, credit: 0 },
      { accountCode: '701', accountName: 'Ventes de marchandises', debit: 0, credit: netHt },
    ];
    if (params.order.taxTotal > 0) {
      lines.push({
        accountCode: '443',
        accountName: 'État, TVA facturée (collectée)',
        debit: 0,
        credit: params.order.taxTotal,
      });
    }

    await applyAccountingEntryAndAccountBalances({
      companyId: params.companyId,
      accounts: params.accounts,
      journalCode: 'VE',
      reference: invNumber,
      label: `Facturation client ${params.order.customerName} (${invNumber})`,
      lines,
      sourceModule: 'sales',
      sourceId: invRef.id,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
    });

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'CREATE_INVOICE',
      module: 'sales',
      entityType: 'invoice',
      entityId: invRef.id,
      summary: `Facture ${invNumber} émise (${params.order.total}) et comptabilisée en OHADA.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/invoices`);
  }
}

export async function recordCustomerInvoicePayment(params: {
  companyId: string;
  invoice: Invoice;
  treasuryAccount: TreasuryAccount;
  amount: number;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  reference: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  if (params.amount <= 0 || params.amount > params.invoice.balanceDue + 0.01) {
    throw new Error('Le montant doit être positif et ne pas dépasser le solde dû.');
  }

  const invRef = doc(db, `companies/${params.companyId}/invoices`, params.invoice.id);
  const custRef = doc(db, `companies/${params.companyId}/customers`, params.invoice.customerId);
  const treasRef = doc(db, `companies/${params.companyId}/treasuryAccounts`, params.treasuryAccount.id);
  const payRef = doc(collection(db, `companies/${params.companyId}/payments`));
  const payNumber = generateDocNumber('ENC');

  try {
    await runTransaction(db, async (tx) => {
      const invSnap = await tx.get(invRef);
      const treasSnap = await tx.get(treasRef);
      const custSnap = await tx.get(custRef);

      if (!invSnap.exists() || !treasSnap.exists()) {
        throw new Error('Facture ou compte de trésorerie introuvable.');
      }

      const currentPaid = invSnap.data().paidAmount || 0;
      const total = invSnap.data().total || 0;
      const newPaid = round2(currentPaid + params.amount);
      const newBalance = Math.max(0, round2(total - newPaid));
      const newStatus = newBalance <= 0.01 ? 'payee' : 'partielle';

      tx.update(invRef, {
        paidAmount: newPaid,
        balanceDue: newBalance,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      tx.update(treasRef, {
        balance: round2((treasSnap.data().balance || 0) + params.amount),
        updatedAt: serverTimestamp(),
      });

      if (custSnap.exists()) {
        tx.update(custRef, {
          balanceDue: Math.max(0, round2((custSnap.data().balanceDue || 0) - params.amount)),
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(payRef, {
        number: payNumber,
        direction: 'encaissement',
        partnerType: 'client',
        partnerId: params.invoice.customerId,
        partnerName: params.invoice.customerName,
        invoiceId: params.invoice.id,
        invoiceNumber: params.invoice.number,
        treasuryAccountId: params.treasuryAccount.id,
        treasuryAccountName: params.treasuryAccount.name,
        method: params.method,
        amount: round2(params.amount),
        date: todayIso(),
        reference: params.reference || payNumber,
        note: `Règlement facture ${params.invoice.number}`,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    });

    const tresCode = params.treasuryAccount.accountCode || (params.treasuryAccount.type === 'caisse' ? '571' : '521');
    await applyAccountingEntryAndAccountBalances({
      companyId: params.companyId,
      accounts: params.accounts,
      journalCode: params.treasuryAccount.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNumber,
      label: `Encaissement client ${params.invoice.customerName} (${params.invoice.number})`,
      lines: [
        { accountCode: tresCode, accountName: params.treasuryAccount.name, debit: round2(params.amount), credit: 0 },
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: 0, credit: round2(params.amount) },
      ],
      sourceModule: 'treasury',
      sourceId: payRef.id,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
    });

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'RECORD_PAYMENT',
      module: 'treasury',
      entityType: 'payment',
      entityId: payRef.id,
      summary: `Encaissement ${payNumber} de ${params.amount} sur facture ${params.invoice.number}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/payments`);
  }
}

export async function receivePurchaseOrderWithStock(params: {
  companyId: string;
  po: PurchaseOrder;
  warehouseName: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  const poRef = doc(db, `companies/${params.companyId}/purchaseOrders`, params.po.id);
  const supRef = doc(db, `companies/${params.companyId}/suppliers`, params.po.supplierId);
  const sinvRef = doc(collection(db, `companies/${params.companyId}/supplierInvoices`));
  const sinvNumber = generateDocNumber('FFR');

  try {
    await runTransaction(db, async (tx) => {
      const supSnap = await tx.get(supRef);
      const productsToUpdate: Array<{ ref: ReturnType<typeof doc>; product: Product; qtyIn: number; cost: number }> = [];

      for (const line of params.po.lines) {
        const pRef = doc(db, `companies/${params.companyId}/products`, line.productId);
        const snap = await tx.get(pRef);
        if (snap.exists()) {
          productsToUpdate.push({
            ref: pRef,
            product: { id: snap.id, ...snap.data() } as Product,
            qtyIn: line.qty,
            cost: line.unitPrice,
          });
        }
      }

      for (const item of productsToUpdate) {
        const newTotal = round2(item.product.stockQty + item.qtyIn);
        const whMap = { ...(item.product.warehouseStocks || {}) };
        whMap[params.po.warehouseId] = round2((whMap[params.po.warehouseId] || 0) + item.qtyIn);

        tx.update(item.ref, {
          stockQty: newTotal,
          warehouseStocks: whMap,
          updatedAt: serverTimestamp(),
        });

        const movRef = doc(collection(db, `companies/${params.companyId}/stockMovements`));
        tx.set(movRef, {
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          warehouseId: params.po.warehouseId,
          warehouseName: params.warehouseName,
          type: 'entree',
          quantity: item.qtyIn,
          unitCost: item.cost,
          totalValue: round2(item.qtyIn * item.cost),
          referenceType: 'purchaseOrder',
          referenceNumber: params.po.number,
          note: `Réception commande fournisseur ${params.po.number}`,
          date: todayIso(),
          authorEmail: params.email,
          ownerId: params.ownerId,
          memberUids: params.memberUids,
          isDemo: false,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(poRef, {
        status: 'receptionnee',
        receivedAt: todayIso(),
        updatedAt: serverTimestamp(),
      });

      tx.set(sinvRef, {
        number: sinvNumber,
        purchaseOrderId: params.po.id,
        supplierId: params.po.supplierId,
        supplierName: params.po.supplierName,
        date: todayIso(),
        dueDate: addDaysIso(30),
        status: 'en_attente',
        total: params.po.total,
        paidAmount: 0,
        balanceDue: params.po.total,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (supSnap.exists()) {
        tx.update(supRef, {
          balancePayable: round2((supSnap.data().balancePayable || 0) + params.po.total),
          updatedAt: serverTimestamp(),
        });
      }
    });

    const netHt = round2(params.po.total - params.po.taxTotal);
    const lines: JournalLine[] = [
      { accountCode: '601', accountName: 'Achats de marchandises', debit: netHt, credit: 0 },
    ];
    if (params.po.taxTotal > 0) {
      lines.push({
        accountCode: '445',
        accountName: 'État, TVA récupérable',
        debit: params.po.taxTotal,
        credit: 0,
      });
    }
    lines.push({
      accountCode: '401',
      accountName: 'Fournisseurs, dettes en compte',
      debit: 0,
      credit: params.po.total,
    });

    await applyAccountingEntryAndAccountBalances({
      companyId: params.companyId,
      accounts: params.accounts,
      journalCode: 'AC',
      reference: sinvNumber,
      label: `Réception & Facture fournisseur ${params.po.supplierName} (${sinvNumber})`,
      lines,
      sourceModule: 'purchases',
      sourceId: sinvRef.id,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
    });

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'RECEIVE_PO',
      module: 'purchases',
      entityType: 'purchaseOrder',
      entityId: params.po.id,
      summary: `Commande ${params.po.number} réceptionnée : stock augmenté + facture ${sinvNumber} comptabilisée.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/purchaseOrders/${params.po.id}`);
  }
}

export async function recordSupplierInvoicePayment(params: {
  companyId: string;
  sinv: SupplierInvoice;
  treasuryAccount: TreasuryAccount;
  amount: number;
  method: 'virement' | 'especes' | 'cheque' | 'mobile_money';
  reference: string;
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  if (params.amount <= 0 || params.amount > params.sinv.balanceDue + 0.01) {
    throw new Error('Montant invalide par rapport au solde dû au fournisseur.');
  }

  const sinvRef = doc(db, `companies/${params.companyId}/supplierInvoices`, params.sinv.id);
  const supRef = doc(db, `companies/${params.companyId}/suppliers`, params.sinv.supplierId);
  const treasRef = doc(db, `companies/${params.companyId}/treasuryAccounts`, params.treasuryAccount.id);
  const payRef = doc(collection(db, `companies/${params.companyId}/payments`));
  const payNumber = generateDocNumber('DEC');

  try {
    await runTransaction(db, async (tx) => {
      const sinvSnap = await tx.get(sinvRef);
      const treasSnap = await tx.get(treasRef);
      const supSnap = await tx.get(supRef);
      if (!sinvSnap.exists() || !treasSnap.exists()) {
        throw new Error('Facture fournisseur ou compte trésorerie introuvable.');
      }

      const newPaid = round2((sinvSnap.data().paidAmount || 0) + params.amount);
      const newBalance = Math.max(0, round2((sinvSnap.data().total || 0) - newPaid));
      tx.update(sinvRef, {
        paidAmount: newPaid,
        balanceDue: newBalance,
        status: newBalance <= 0.01 ? 'payee' : 'partielle',
        updatedAt: serverTimestamp(),
      });

      tx.update(treasRef, {
        balance: round2((treasSnap.data().balance || 0) - params.amount),
        updatedAt: serverTimestamp(),
      });

      if (supSnap.exists()) {
        tx.update(supRef, {
          balancePayable: Math.max(0, round2((supSnap.data().balancePayable || 0) - params.amount)),
          updatedAt: serverTimestamp(),
        });
      }

      tx.set(payRef, {
        number: payNumber,
        direction: 'decaissement',
        partnerType: 'fournisseur',
        partnerId: params.sinv.supplierId,
        partnerName: params.sinv.supplierName,
        invoiceId: params.sinv.id,
        invoiceNumber: params.sinv.number,
        treasuryAccountId: params.treasuryAccount.id,
        treasuryAccountName: params.treasuryAccount.name,
        method: params.method,
        amount: round2(params.amount),
        date: todayIso(),
        reference: params.reference || payNumber,
        note: `Règlement fournisseur ${params.sinv.number}`,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    });

    const tresCode = params.treasuryAccount.accountCode || (params.treasuryAccount.type === 'caisse' ? '571' : '521');
    await applyAccountingEntryAndAccountBalances({
      companyId: params.companyId,
      accounts: params.accounts,
      journalCode: params.treasuryAccount.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNumber,
      label: `Décaissement fournisseur ${params.sinv.supplierName} (${params.sinv.number})`,
      lines: [
        { accountCode: '401', accountName: 'Fournisseurs, dettes en compte', debit: round2(params.amount), credit: 0 },
        { accountCode: tresCode, accountName: params.treasuryAccount.name, debit: 0, credit: round2(params.amount) },
      ],
      sourceModule: 'treasury',
      sourceId: payRef.id,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/payments`);
  }
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
  note: string;
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  const pRef = doc(db, `companies/${params.companyId}/products`, params.product.id);
  const movRef = doc(collection(db, `companies/${params.companyId}/stockMovements`));
  let triggeredAlert = false;
  let finalQty = 0;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef);
      if (!snap.exists()) throw new Error('Produit introuvable.');
      const prod = snap.data() as Product;
      const whMap = { ...(prod.warehouseStocks || {}) };
      const currentWh = whMap[params.warehouseId] ?? 0;

      if (params.type === 'entree') {
        whMap[params.warehouseId] = round2(currentWh + params.quantity);
        finalQty = round2(prod.stockQty + params.quantity);
      } else if (params.type === 'sortie') {
        if (prod.stockQty < params.quantity) {
          throw new Error(`Stock global insuffisant (${prod.stockQty} disponibles).`);
        }
        whMap[params.warehouseId] = Math.max(0, round2(currentWh - params.quantity));
        finalQty = round2(prod.stockQty - params.quantity);
      } else if (params.type === 'transfert') {
        if (!params.toWarehouseId || params.toWarehouseId === params.warehouseId) {
          throw new Error('Sélectionnez un entrepôt de destination distinct.');
        }
        if (currentWh < params.quantity) {
          throw new Error(`Stock insuffisant dans l'entrepôt source (${currentWh} disponibles).`);
        }
        whMap[params.warehouseId] = round2(currentWh - params.quantity);
        whMap[params.toWarehouseId] = round2((whMap[params.toWarehouseId] || 0) + params.quantity);
        finalQty = prod.stockQty;
      } else {
        // inventaire: quantity represents new counted stock in selected warehouse
        const diff = params.quantity - currentWh;
        whMap[params.warehouseId] = round2(params.quantity);
        finalQty = Math.max(0, round2(prod.stockQty + diff));
      }

      if (finalQty <= prod.minStock) triggeredAlert = true;

      tx.update(pRef, {
        stockQty: finalQty,
        warehouseStocks: whMap,
        updatedAt: serverTimestamp(),
      });

      tx.set(movRef, {
        productId: params.product.id,
        productName: prod.name,
        sku: prod.sku,
        warehouseId: params.warehouseId,
        warehouseName: params.warehouseName,
        toWarehouseId: params.toWarehouseId || '',
        toWarehouseName: params.toWarehouseName || '',
        type: params.type,
        quantity: params.quantity,
        unitCost: prod.purchasePrice,
        totalValue: round2(params.quantity * prod.purchasePrice),
        referenceType: 'manual',
        referenceNumber: generateDocNumber('MVT'),
        note: params.note || `Mouvement ${params.type}`,
        date: todayIso(),
        authorEmail: params.email,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    });

    if (triggeredAlert) {
      await pushNotification({
        companyId: params.companyId,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        title: 'Alerte Stock Minimum',
        message: `${params.product.name} (${finalQty} unités) a atteint son seuil critique (${params.product.minStock}).`,
        severity: 'warning',
        module: 'inventory',
      });
    }

    await logAudit({
      companyId: params.companyId,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
      action: 'STOCK_MOVEMENT',
      module: 'inventory',
      entityType: 'product',
      entityId: params.product.id,
      summary: `Mouvement ${params.type} de ${params.quantity} × ${params.product.name}.`,
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('insuffisant') || error.message.includes('destination'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/stockMovements`);
  }
}

export async function postManualJournalEntry(params: {
  companyId: string;
  journalCode: 'VE' | 'AC' | 'BQ' | 'CA' | 'OD';
  date: string;
  reference: string;
  label: string;
  lines: JournalLine[];
  accounts: Account[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}) {
  await applyAccountingEntryAndAccountBalances({
    companyId: params.companyId,
    accounts: params.accounts,
    journalCode: params.journalCode,
    reference: params.reference || generateDocNumber(params.journalCode),
    label: params.label,
    lines: params.lines,
    sourceModule: 'accounting',
    sourceId: 'manual',
    uid: params.uid,
    email: params.email,
    ownerId: params.ownerId,
    memberUids: params.memberUids,
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
  const payRef = doc(collection(db, `companies/${params.companyId}/payments`));
  const payrollRef = doc(db, `companies/${params.companyId}/payrolls`, params.payroll.id);
  const treasRef = doc(db, `companies/${params.companyId}/treasuryAccounts`, params.treasuryAccount.id);
  const payNumber = generateDocNumber('PAIE');

  try {
    await runTransaction(db, async (tx) => {
      const treasSnap = await tx.get(treasRef);
      if (!treasSnap.exists()) throw new Error('Compte de trésorerie introuvable.');

      tx.update(payrollRef, {
        status: 'payee',
        paidAt: todayIso(),
        updatedAt: serverTimestamp(),
      });

      tx.update(treasRef, {
        balance: round2((treasSnap.data().balance || 0) - params.payroll.netSalary),
        updatedAt: serverTimestamp(),
      });

      tx.set(payRef, {
        number: payNumber,
        direction: 'decaissement',
        partnerType: 'autre',
        partnerId: params.payroll.employeeId,
        partnerName: params.payroll.employeeName,
        treasuryAccountId: params.treasuryAccount.id,
        treasuryAccountName: params.treasuryAccount.name,
        method: params.treasuryAccount.type === 'caisse' ? 'especes' : 'virement',
        amount: round2(params.payroll.netSalary),
        date: todayIso(),
        reference: `SAL-${params.payroll.period}`,
        note: `Paiement salaire ${params.payroll.period} — ${params.payroll.employeeName}`,
        ownerId: params.ownerId,
        memberUids: params.memberUids,
        isDemo: false,
        createdAt: serverTimestamp(),
      });
    });

    const tresCode = params.treasuryAccount.accountCode || '521';
    await applyAccountingEntryAndAccountBalances({
      companyId: params.companyId,
      accounts: params.accounts,
      journalCode: params.treasuryAccount.type === 'caisse' ? 'CA' : 'BQ',
      reference: payNumber,
      label: `Paie ${params.payroll.period} — ${params.payroll.employeeName}`,
      lines: [
        { accountCode: '661', accountName: 'Rémunérations directes versées au personnel', debit: round2(params.payroll.netSalary), credit: 0 },
        { accountCode: tresCode, accountName: params.treasuryAccount.name, debit: 0, credit: round2(params.payroll.netSalary) },
      ],
      sourceModule: 'hr',
      sourceId: params.payroll.id,
      uid: params.uid,
      email: params.email,
      ownerId: params.ownerId,
      memberUids: params.memberUids,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${params.companyId}/payrolls/${params.payroll.id}`);
  }
}

export async function exportCompanyBackup(companyId: string, uid: string) {
  const collections = [
    'departments',
    'roles',
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
    'invoices',
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
    'auditLogs',
  ];

  const backup: Record<string, unknown[]> = {};
  for (const col of collections) {
    const q = query(
      collection(db, `companies/${companyId}/${col}`),
      where('memberUids', 'array-contains', uid)
    );
    const snap = await getDocs(q);
    backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  return {
    exportedAt: new Date().toISOString(),
    companyId,
    collections: backup,
  };
}

export async function createErpDoc<T extends Record<string, unknown>>(
  companyId: string,
  subcollection: string,
  data: T,
  ownerId: string,
  memberUids: string[],
  withUpdatedAt = true
): Promise<string> {
  const path = `companies/${companyId}/${subcollection}`;
  try {
    const ref = doc(collection(db, path));
    const payload: Record<string, unknown> = {
      ...data,
      ownerId,
      memberUids,
      createdAt: serverTimestamp(),
    };
    if (withUpdatedAt) {
      payload.updatedAt = serverTimestamp();
    }
    await setDoc(ref, payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateErpDoc(
  companyId: string,
  subcollection: string,
  id: string,
  data: Record<string, unknown>,
  withUpdatedAt = true
) {
  const path = `companies/${companyId}/${subcollection}/${id}`;
  try {
    await updateDoc(doc(db, path), {
      ...data,
      ...(withUpdatedAt ? { updatedAt: serverTimestamp() } : {}),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteErpDoc(companyId: string, subcollection: string, id: string) {
  const path = `companies/${companyId}/${subcollection}/${id}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
