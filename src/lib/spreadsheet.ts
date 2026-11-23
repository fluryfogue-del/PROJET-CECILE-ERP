import * as XLSX from 'xlsx';
import { apiRequest } from './apiClient';
import { todayIso } from './format';

export type ImportTarget =
  | 'products'
  | 'customers'
  | 'leads'
  | 'suppliers'
  | 'employees'
  | 'accounts'
  | 'moduleRecords';

export interface ImportTargetMeta {
  id: ImportTarget;
  label: string;
  description: string;
  templateHeaders: string[];
  requiredHint: string;
}

export const IMPORT_TARGET_META: Record<ImportTarget, ImportTargetMeta> = {
  products: {
    id: 'products',
    label: 'Articles & Stocks',
    description: 'Catalogue produits, références SKU, prix d’achat/vente et quantités initiales.',
    templateHeaders: [
      'SKU',
      'Designation',
      'Categorie',
      'Unite',
      'PrixAchat',
      'PrixVente',
      'TVA',
      'Stock',
      'SeuilMin',
    ],
    requiredHint: 'SKU (ou généré), Designation (obligatoire)',
  },
  customers: {
    id: 'customers',
    label: 'Clients CRM',
    description: 'Répertoire des clients Entreprises (B2B), Particuliers (B2C) ou Administrations.',
    templateHeaders: ['Code', 'Nom', 'Segment', 'Email', 'Telephone', 'Adresse', 'NIF', 'PlafondCredit', 'Notes'],
    requiredHint: 'Nom / Raison sociale (obligatoire)',
  },
  leads: {
    id: 'leads',
    label: 'Prospects CRM',
    description: 'Liste de contacts commerciaux et opportunités entrantes.',
    templateHeaders: ['Nom', 'Entreprise', 'Email', 'Telephone', 'Source', 'Statut', 'ValeurEstimee', 'Notes'],
    requiredHint: 'Nom du prospect (obligatoire)',
  },
  suppliers: {
    id: 'suppliers',
    label: 'Fournisseurs',
    description: 'Base fournisseurs, coordonnées et conditions de règlement.',
    templateHeaders: ['Code', 'Nom', 'Email', 'Telephone', 'Adresse', 'NIF', 'ConditionsPaiement'],
    requiredHint: 'Nom du fournisseur (obligatoire)',
  },
  employees: {
    id: 'employees',
    label: 'Employés & RH',
    description: 'Registre du personnel, postes, départements, contrats et salaires.',
    templateHeaders: [
      'Matricule',
      'Prenom',
      'Nom',
      'Email',
      'Telephone',
      'Departement',
      'Poste',
      'Contrat',
      'DateEmbauche',
      'SalaireBase',
      'Statut',
    ],
    requiredHint: 'Prenom et Nom (obligatoires)',
  },
  accounts: {
    id: 'accounts',
    label: 'Comptes Comptables',
    description: 'Comptes du plan comptable (classes 1 à 8).',
    templateHeaders: ['Code', 'Intitule', 'Classe', 'Nature'],
    requiredHint: 'Code (min. 2 car.) et Intitule (obligatoires)',
  },
  moduleRecords: {
    id: 'moduleRecords',
    label: 'Opérations du module',
    description: 'Enregistrements structurés importés directement dans ce module.',
    templateHeaders: ['Reference', 'Libelle', 'Tiers', 'Categorie', 'Date', 'Quantite', 'Montant', 'Statut', 'Notes'],
    requiredHint: 'Libelle (obligatoire)',
  },
};

export interface ParsedSpreadsheetRow {
  rowIndex: number;
  valid: boolean;
  error?: string;
  previewTitle: string;
  previewSubtitle: string;
  payload: Record<string, unknown>;
}

export interface ParsedSpreadsheetResult {
  rows: ParsedSpreadsheetRow[];
  validCount: number;
  errorCount: number;
  detectedHeaders: string[];
}

function normalizeHeader(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function cleanText(val: unknown, maxLen: number): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLen);
}

function parseNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (val === null || val === undefined) return fallback;
  const raw = String(val)
    .replace(/\u00A0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function buildNormalizedLookup(row: Record<string, unknown>): Map<string, unknown> {
  const map = new Map<string, unknown>();
  Object.entries(row).forEach(([k, v]) => {
    map.set(normalizeHeader(k), v);
  });
  return map;
}

function pick(map: Map<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const norm = normalizeHeader(alias);
    if (map.has(norm)) {
      const val = map.get(norm);
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }
  return undefined;
}

function normalizeDate(val: unknown): string {
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  const s = cleanText(val, 30);
  if (!s) return todayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashMatch = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }
  return s;
}

export async function parseSpreadsheetFile(
  file: File,
  target: ImportTarget,
  options?: { moduleId?: string; defaultWarehouseId?: string }
): Promise<ParsedSpreadsheetResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { rows: [], validCount: 0, errorCount: 0, detectedHeaders: [] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const detectedHeaders = rawObjects.length > 0 ? Object.keys(rawObjects[0]) : [];

  const rows: ParsedSpreadsheetRow[] = rawObjects.map((rawRow, idx) => {
    const rowIndex = idx + 2;
    const map = buildNormalizedLookup(rawRow);

    if (target === 'products') {
      const name = cleanText(
        pick(map, ['designation', 'nom', 'article', 'produit', 'name', 'libelle', 'title']),
        160
      );
      const sku =
        cleanText(pick(map, ['sku', 'reference', 'ref', 'code', 'codearticle']), 50) ||
        `PRD-${String(idx + 1).padStart(3, '0')}`;
      const categoryName = cleanText(pick(map, ['categorie', 'category', 'famille']), 120) || 'Général';
      const unit = cleanText(pick(map, ['unite', 'unit', 'uom']), 30) || 'Unité';
      const purchasePrice = Math.max(
        0,
        parseNum(pick(map, ['prixachat', 'prixdachat', 'cout', 'purchaseprice', 'pa']), 0)
      );
      const salePrice = Math.max(
        0,
        parseNum(pick(map, ['prixvente', 'prixdevente', 'pv', 'pu', 'prix', 'saleprice', 'price']), 0)
      );
      const taxRate = Math.min(
        100,
        Math.max(0, parseNum(pick(map, ['tva', 'taxe', 'taxrate', 'tax']), 19.25))
      );
      const stockQty = Math.max(
        0,
        parseNum(pick(map, ['stock', 'quantite', 'qte', 'stockqty', 'qty']), 0)
      );
      const minStock = Math.max(0, parseNum(pick(map, ['seuilmin', 'seuil', 'minstock', 'min']), 5));

      if (!name) {
        return {
          rowIndex,
          valid: false,
          error: 'Désignation manquante',
          previewTitle: sku,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: `${sku} · ${name}`,
        previewSubtitle: `Stock: ${stockQty} ${unit} · Vente: ${salePrice}`,
        payload: {
          sku,
          name,
          categoryName,
          unit,
          purchasePrice,
          salePrice,
          taxRate,
          stockQty,
          minStock,
          warehouseStocks: options?.defaultWarehouseId ? { [options.defaultWarehouseId]: stockQty } : {},
          trackStock: true,
        },
      };
    }

    if (target === 'customers') {
      const name = cleanText(
        pick(map, ['nom', 'raisonsociale', 'client', 'name', 'entreprise', 'societe']),
        160
      );
      const code =
        cleanText(pick(map, ['code', 'codeclient', 'ref', 'reference']), 40) ||
        `CLI-${String(idx + 1).padStart(3, '0')}`;
      const rawSeg = cleanText(pick(map, ['segment', 'type', 'categorie']), 30).toLowerCase();
      const segment =
        rawSeg.includes('b2c') || rawSeg.includes('part')
          ? 'B2C'
          : rawSeg.includes('adm')
          ? 'Administration'
          : 'B2B';
      const email = cleanText(pick(map, ['email', 'mail', 'courriel']), 160);
      const phone = cleanText(pick(map, ['telephone', 'tel', 'phone', 'mobile']), 40);
      const address = cleanText(pick(map, ['adresse', 'address', 'ville', 'quartier']), 250);
      const taxId = cleanText(pick(map, ['nif', 'taxid', 'nui', 'cni', 'contribuable']), 80);
      const creditLimit = Math.max(
        0,
        parseNum(pick(map, ['plafondcredit', 'creditlimit', 'plafond', 'credit']), 0)
      );
      const notes = cleanText(pick(map, ['notes', 'note', 'remarque']), 1000);

      if (!name) {
        return {
          rowIndex,
          valid: false,
          error: 'Nom / Raison sociale manquant',
          previewTitle: code,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: `${code} · ${name}`,
        previewSubtitle: [segment, phone || email || address].filter(Boolean).join(' · '),
        payload: {
          code,
          name,
          segment,
          email,
          phone,
          address,
          taxId,
          creditLimit,
          balanceDue: 0,
          notes,
        },
      };
    }

    if (target === 'leads') {
      const name = cleanText(pick(map, ['nom', 'contact', 'name', 'prospect']), 140);
      const companyName = cleanText(pick(map, ['entreprise', 'societe', 'company', 'companyname']), 160);
      const email = cleanText(pick(map, ['email', 'mail']), 160);
      const phone = cleanText(pick(map, ['telephone', 'tel', 'phone']), 40);
      const source = cleanText(pick(map, ['source', 'origine', 'canal']), 60) || 'Import CSV/Excel';
      const rawStatus = cleanText(pick(map, ['statut', 'status']), 30).toLowerCase();
      const status = (['nouveau', 'contacte', 'qualifie', 'converti', 'perdu'].includes(rawStatus)
        ? rawStatus
        : 'nouveau') as 'nouveau' | 'contacte' | 'qualifie' | 'converti' | 'perdu';
      const estimatedValue = Math.max(
        0,
        parseNum(pick(map, ['valeurestimee', 'montant', 'valeur', 'estimatedvalue', 'budget']), 0)
      );
      const notes = cleanText(pick(map, ['notes', 'note', 'commentaire']), 1000);

      if (!name) {
        return {
          rowIndex,
          valid: false,
          error: 'Nom du prospect manquant',
          previewTitle: companyName || `Ligne ${rowIndex}`,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: name,
        previewSubtitle: [companyName || 'Particulier', status, `${estimatedValue}`].join(' · '),
        payload: {
          name,
          companyName,
          email,
          phone,
          source,
          status,
          estimatedValue,
          notes,
        },
      };
    }

    if (target === 'suppliers') {
      const name = cleanText(
        pick(map, ['nom', 'raisonsociale', 'fournisseur', 'name', 'societe']),
        160
      );
      const code =
        cleanText(pick(map, ['code', 'codefournisseur', 'ref']), 40) ||
        `FRN-${String(idx + 1).padStart(3, '0')}`;
      const email = cleanText(pick(map, ['email', 'mail']), 160);
      const phone = cleanText(pick(map, ['telephone', 'tel', 'phone']), 40);
      const address = cleanText(pick(map, ['adresse', 'address']), 250);
      const taxId = cleanText(pick(map, ['nif', 'taxid', 'nui']), 80);
      const paymentTerms =
        cleanText(pick(map, ['conditionspaiement', 'conditions', 'paymentterms', 'delai']), 60) ||
        '30 jours net';

      if (!name) {
        return {
          rowIndex,
          valid: false,
          error: 'Raison sociale fournisseur manquante',
          previewTitle: code,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: `${code} · ${name}`,
        previewSubtitle: [paymentTerms, phone || email].filter(Boolean).join(' · '),
        payload: {
          code,
          name,
          email,
          phone,
          address,
          taxId,
          paymentTerms,
          balancePayable: 0,
        },
      };
    }

    if (target === 'employees') {
      const firstName = cleanText(pick(map, ['prenom', 'prenoms', 'firstname']), 80);
      const lastName = cleanText(pick(map, ['nom', 'nomdefamille', 'lastname']), 80);
      const matricule =
        cleanText(pick(map, ['matricule', 'code', 'id']), 40) ||
        `EMP-${String(idx + 1).padStart(3, '0')}`;
      const email = cleanText(pick(map, ['email', 'mail']), 160);
      const phone = cleanText(pick(map, ['telephone', 'tel', 'phone']), 40);
      const departmentName =
        cleanText(pick(map, ['departement', 'department', 'service']), 120) || 'Direction Générale';
      const position = cleanText(pick(map, ['poste', 'fonction', 'position', 'role']), 120) || 'Collaborateur';
      const rawContract = cleanText(pick(map, ['contrat', 'contracttype', 'typecontrat']), 30).toUpperCase();
      const contractType = (['CDI', 'CDD', 'STAGE', 'CONSULTANT'].includes(rawContract)
        ? rawContract === 'STAGE'
          ? 'Stage'
          : rawContract === 'CONSULTANT'
          ? 'Consultant'
          : rawContract
        : 'CDI') as 'CDI' | 'CDD' | 'Stage' | 'Consultant';
      const hireDate = normalizeDate(pick(map, ['dateembauche', 'embauche', 'hiredate', 'date']));
      const baseSalary = Math.max(
        0,
        parseNum(pick(map, ['salairebase', 'salaire', 'basesalary', 'remuneration']), 0)
      );
      const rawStatus = cleanText(pick(map, ['statut', 'status']), 30).toLowerCase();
      const status = (['actif', 'en_conge', 'suspendu', 'sorti'].includes(rawStatus)
        ? rawStatus
        : 'actif') as 'actif' | 'en_conge' | 'suspendu' | 'sorti';

      if (!firstName || !lastName) {
        return {
          rowIndex,
          valid: false,
          error: 'Prénom et Nom obligatoires',
          previewTitle: matricule,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: `${matricule} · ${firstName} ${lastName}`,
        previewSubtitle: `${position} · ${departmentName} · ${contractType}`,
        payload: {
          matricule,
          firstName,
          lastName,
          email,
          phone,
          departmentName,
          position,
          contractType,
          hireDate,
          baseSalary,
          status,
          history: [`${hireDate} : Import dossier (${contractType})`],
        },
      };
    }

    if (target === 'accounts') {
      const code = cleanText(pick(map, ['code', 'compte', 'numero', 'accountcode']), 20);
      const name = cleanText(pick(map, ['intitule', 'nom', 'libelle', 'name']), 160);
      const rawClass = parseNum(pick(map, ['classe', 'classnumber', 'class']), NaN);
      const inferredClass = Number.isFinite(rawClass)
        ? Math.min(8, Math.max(1, Math.round(rawClass)))
        : Math.min(8, Math.max(1, parseInt(code.slice(0, 1), 10) || 6));
      const rawNature = cleanText(pick(map, ['nature', 'type']), 30).toLowerCase();
      const type = (['actif', 'passif', 'charge', 'produit'].includes(rawNature)
        ? rawNature
        : inferredClass === 6 || inferredClass === 8
        ? 'charge'
        : inferredClass === 7
        ? 'produit'
        : inferredClass === 1 || inferredClass === 4
        ? 'passif'
        : 'actif') as 'actif' | 'passif' | 'charge' | 'produit';

      if (code.length < 2 || name.length < 2) {
        return {
          rowIndex,
          valid: false,
          error: 'Code (min. 2 car.) et Intitulé obligatoires',
          previewTitle: code || `Ligne ${rowIndex}`,
          previewSubtitle: 'Ligne invalide',
          payload: {},
        };
      }

      return {
        rowIndex,
        valid: true,
        previewTitle: `${code} · ${name}`,
        previewSubtitle: `Classe ${inferredClass} · ${type}`,
        payload: {
          code,
          name,
          classNumber: inferredClass,
          type,
          balanceDebit: 0,
          balanceCredit: 0,
          isSystem: false,
        },
      };
    }

    // moduleRecords
    const title = cleanText(pick(map, ['libelle', 'titre', 'title', 'objet', 'nom', 'description']), 200);
    const reference =
      cleanText(pick(map, ['reference', 'ref', 'code', 'numero']), 60) ||
      `IMP-${String(idx + 1).padStart(4, '0')}`;
    const partnerName = cleanText(pick(map, ['tiers', 'client', 'responsable', 'partner', 'partnername']), 160);
    const category = cleanText(pick(map, ['categorie', 'category', 'type']), 80);
    const date = normalizeDate(pick(map, ['date', 'datedocument']));
    const quantity = Math.max(0, parseNum(pick(map, ['quantite', 'qte', 'quantity', 'qty']), 1));
    const amount = Math.max(0, parseNum(pick(map, ['montant', 'prix', 'valeur', 'amount', 'total']), 0));
    const rawStatus = cleanText(pick(map, ['statut', 'status']), 30).toLowerCase();
    const status = (['brouillon', 'en_cours', 'valide', 'termine', 'annule'].includes(rawStatus)
      ? rawStatus
      : 'en_cours') as 'brouillon' | 'en_cours' | 'valide' | 'termine' | 'annule';
    const notes = cleanText(pick(map, ['notes', 'note', 'detail']), 1000);

    if (!title) {
      return {
        rowIndex,
        valid: false,
        error: 'Libellé manquant',
        previewTitle: reference,
        previewSubtitle: 'Ligne invalide',
        payload: {},
      };
    }

    return {
      rowIndex,
      valid: true,
      previewTitle: `${reference} · ${title}`,
      previewSubtitle: [partnerName || 'Sans tiers', date, `Montant: ${amount}`].join(' · '),
      payload: {
        moduleId: options?.moduleId || 'mod_dashboard',
        title,
        reference,
        partnerName,
        category,
        amount,
        quantity,
        status,
        date,
        notes,
      },
    };
  });

  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.length - validCount;
  return { rows, validCount, errorCount, detectedHeaders };
}

export async function commitImportedRows(params: {
  companyId: string;
  target: ImportTarget;
  rows: ParsedSpreadsheetRow[];
  uid: string;
  email: string;
  ownerId: string;
  memberUids: string[];
}): Promise<number> {
  const validRows = params.rows.filter((r) => r.valid);
  if (validRows.length === 0) return 0;

  const res = await apiRequest<{ imported: number }>(
    `/api/companies/${params.companyId}/actions/import`,
    {
      method: 'POST',
      companyId: params.companyId,
      body: {
        target: params.target,
        rows: validRows.map((r) => r.payload),
      },
      emitMutation: true,
    }
  );

  return res.imported ?? validRows.length;
}
