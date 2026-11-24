import { DbClient, DbPreparedStatement } from './db/types.ts';
import { generateId } from './lib/crypto.ts';

export const ALL_66_CATALOG_MODULE_IDS: string[] = [
  'mod_dashboard',
  'mod_kpi',
  'mod_analytics',
  'mod_ai_forecast',
  'mod_audit',
  'mod_alerts',
  'mod_docs_guide',
  'mod_leads',
  'mod_customers',
  'mod_pipeline',
  'mod_quotes',
  'mod_orders',
  'mod_invoices',
  'mod_pos',
  'mod_subscriptions',
  'mod_loyalty',
  'mod_sav',
  'mod_pricelists',
  'mod_contracts_sales',
  'mod_suppliers',
  'mod_purchase_req',
  'mod_purchase_orders',
  'mod_receipts',
  'mod_supplier_invoices',
  'mod_products',
  'mod_warehouses',
  'mod_stock_moves',
  'mod_inventories',
  'mod_reorder',
  'mod_shipping',
  'mod_fleet',
  'mod_barcode',
  'mod_ohada_plan',
  'mod_journals',
  'mod_ledger',
  'mod_statements',
  'mod_treasury',
  'mod_cash',
  'mod_expenses',
  'mod_assets',
  'mod_taxes',
  'mod_collections',
  'mod_budgets',
  'mod_reconcile',
  'mod_employees',
  'mod_hr_contracts',
  'mod_leaves',
  'mod_payroll',
  'mod_recruitment',
  'mod_appraisals',
  'mod_training',
  'mod_timesheets',
  'mod_projects',
  'mod_tasks',
  'mod_manufacturing',
  'mod_bom',
  'mod_maintenance',
  'mod_quality',
  'mod_it_assets',
  'mod_field_service',
  'mod_ecommerce',
  'mod_marketing',
  'mod_events',
  'mod_ged',
  'mod_calendar',
  'mod_admin_rbac',
];

const ALL_ERP_ROUTE_MODULES = [
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

const OHADA_ACCOUNTS = [
  { code: '101', name: 'Capital social', classNumber: 1, type: 'passif', debit: 0, credit: 5000000 },
  { code: '121', name: 'Report à nouveau créditeur', classNumber: 1, type: 'passif', debit: 0, credit: 0 },
  { code: '241', name: 'Matériel et outillage industriel', classNumber: 2, type: 'actif', debit: 1200000, credit: 0 },
  { code: '244', name: 'Matériel et mobilier de bureau', classNumber: 2, type: 'actif', debit: 650000, credit: 0 },
  { code: '311', name: 'Stocks de marchandises', classNumber: 3, type: 'actif', debit: 4215000, credit: 0 },
  { code: '401', name: 'Fournisseurs, dettes en compte', classNumber: 4, type: 'passif', debit: 420000, credit: 1380000 },
  { code: '411', name: 'Clients, créances en compte', classNumber: 4, type: 'actif', debit: 2816225, credit: 1647225 },
  { code: '422', name: 'Personnel, rémunérations dues', classNumber: 4, type: 'passif', debit: 0, credit: 0 },
  { code: '443', name: 'État, TVA facturée (collectée)', classNumber: 4, type: 'passif', debit: 0, credit: 451225 },
  { code: '445', name: 'État, TVA récupérable', classNumber: 4, type: 'actif', debit: 223100, credit: 0 },
  { code: '521', name: 'Banques locales', classNumber: 5, type: 'actif', debit: 5850000, credit: 1000000 },
  { code: '571', name: 'Caisse siège', classNumber: 5, type: 'actif', debit: 790000, credit: 150000 },
  { code: '601', name: 'Achats de marchandises', classNumber: 6, type: 'charge', debit: 1156900, credit: 0 },
  { code: '624', name: 'Entretien, réparations et maintenance', classNumber: 6, type: 'charge', debit: 85000, credit: 0 },
  { code: '661', name: 'Rémunérations directes versées au personnel', classNumber: 6, type: 'charge', debit: 680000, credit: 0 },
  { code: '701', name: 'Ventes de marchandises', classNumber: 7, type: 'produit', debit: 0, credit: 2365000 },
  { code: '706', name: 'Services vendus', classNumber: 7, type: 'produit', debit: 0, credit: 350000 },
];

interface SpecializedSeedEntry {
  moduleId: string;
  items: Array<{
    title: string;
    reference: string;
    partnerName: string;
    category: string;
    amount: number;
    quantity: number;
    status: 'brouillon' | 'en_cours' | 'valide' | 'termine' | 'annule';
    daysAgo: number;
    notes: string;
  }>;
}

const SPECIALIZED_MODULE_SEEDS: SpecializedSeedEntry[] = [
  {
    moduleId: 'mod_kpi',
    items: [
      {
        title: 'Objectif Chiffre d’Affaires Trimestriel',
        reference: 'KPI-2026-Q1',
        partnerName: 'Direction Commerciale',
        category: 'Croissance Ventes',
        amount: 15000000,
        quantity: 82,
        status: 'en_cours',
        daysAgo: 5,
        notes: 'Suivi hebdomadaire des ventes B2B et B2C sur JESSI.',
      },
      {
        title: 'Taux de Recouvrement Créances Clients',
        reference: 'KPI-2026-REC',
        partnerName: 'Direction Financière',
        category: 'Trésorerie & Cash',
        amount: 4500000,
        quantity: 91,
        status: 'valide',
        daysAgo: 12,
        notes: 'Cible de délai moyen d’encaissement inférieure à 25 jours.',
      },
    ],
  },
  {
    moduleId: 'mod_alerts',
    items: [
      {
        title: 'Seuil Stock Critique Onduleurs APC',
        reference: 'ALR-STK-01',
        partnerName: 'Entrepôt Central',
        category: 'Critique',
        amount: 245000,
        quantity: 3,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'Stock restant inférieur au seuil minimum de sécurité.',
      },
      {
        title: 'Relance Échéance Facture J+15',
        reference: 'ALR-FAC-02',
        partnerName: 'Société Atlantique BTP',
        category: 'Avertissement',
        amount: 685000,
        quantity: 1,
        status: 'valide',
        daysAgo: 3,
        notes: 'Relance automatique programmée avant échéance mensuelle.',
      },
    ],
  },
  {
    moduleId: 'mod_pos',
    items: [
      {
        title: 'Clôture Caisse Comptoir Matin',
        reference: 'POS-00418',
        partnerName: 'Client Comptoir Douala',
        category: 'Caisse 01',
        amount: 185000,
        quantity: 7,
        status: 'termine',
        daysAgo: 0,
        notes: 'Règlement espèces et Mobile Money rapproché.',
      },
      {
        title: 'Vente Express Accessoires Bureautique',
        reference: 'POS-00419',
        partnerName: 'Cabinet Horizon',
        category: 'Caisse 02',
        amount: 92500,
        quantity: 4,
        status: 'termine',
        daysAgo: 2,
        notes: 'Ticket imprimé et stock décrémenté en direct.',
      },
    ],
  },
  {
    moduleId: 'mod_subscriptions',
    items: [
      {
        title: 'Contrat Maintenance Réseau Mensuel',
        reference: 'ABO-2026-01',
        partnerName: 'Clinique Espoir Plus',
        category: 'Pack Entreprise Pro',
        amount: 250000,
        quantity: 12,
        status: 'valide',
        daysAgo: 10,
        notes: 'Facturation récurrente le 1er de chaque mois.',
      },
      {
        title: 'Hébergement Cloud & Sauvegarde',
        reference: 'ABO-2026-02',
        partnerName: 'Cabinet Juridique Ndongo',
        category: 'Pack Cloud Annuel',
        amount: 420000,
        quantity: 12,
        status: 'en_cours',
        daysAgo: 18,
        notes: 'Renouvellement annuel automatique activé.',
      },
    ],
  },
  {
    moduleId: 'mod_loyalty',
    items: [
      {
        title: 'Carte Fidélité Client Gold #104',
        reference: 'FID-104',
        partnerName: 'Groupe Sitracel',
        category: 'Programme Gold',
        amount: 75000,
        quantity: 1450,
        status: 'valide',
        daysAgo: 4,
        notes: 'Remise commerciale de 5% applicable sur la prochaine commande.',
      },
      {
        title: 'Offre Rentrée Bureautique -10%',
        reference: 'PROMO-09',
        partnerName: 'Clients Particuliers',
        category: 'Campagne Saisonnière',
        amount: 120000,
        quantity: 320,
        status: 'en_cours',
        daysAgo: 9,
        notes: 'Remise immédiate sur les fournitures informatiques.',
      },
    ],
  },
  {
    moduleId: 'mod_sav',
    items: [
      {
        title: 'Remplacement Alimentation Imprimante Laser',
        reference: 'SAV-2026-14',
        partnerName: 'Société Atlantique BTP',
        category: 'Garantie Matériel',
        amount: 45000,
        quantity: 2,
        status: 'en_cours',
        daysAgo: 2,
        notes: 'Pièce commandée auprès du fournisseur officiel.',
      },
      {
        title: 'Calibration Scanner Code-Barres',
        reference: 'SAV-2026-11',
        partnerName: 'Supermarché Central',
        category: 'Support Technique',
        amount: 25000,
        quantity: 1,
        status: 'termine',
        daysAgo: 6,
        notes: 'Intervention clôturée avec procès-verbal signé.',
      },
    ],
  },
  {
    moduleId: 'mod_pricelists',
    items: [
      {
        title: 'Barème Grossistes & Revendeurs (-12%)',
        reference: 'TARIF-GROS',
        partnerName: 'Réseau Distributeurs',
        category: 'XAF / Zone CEMAC',
        amount: 120000,
        quantity: 28,
        status: 'valide',
        daysAgo: 15,
        notes: 'Applicable à partir de 10 unités commandées par référence.',
      },
      {
        title: 'Grille Tarifaire Administrations & ONG',
        reference: 'TARIF-PUB',
        partnerName: 'Secteur Public',
        category: 'XAF / Marchés Publics',
        amount: 85000,
        quantity: 16,
        status: 'valide',
        daysAgo: 22,
        notes: 'Prix forfaitaires TTC validés pour l’exercice 2026.',
      },
    ],
  },
  {
    moduleId: 'mod_contracts_sales',
    items: [
      {
        title: 'Accord-Cadre Fourniture Équipements IT',
        reference: 'CTR-VTE-08',
        partnerName: 'Groupe Sitracel',
        category: 'Contrat Annuel B2B',
        amount: 6400000,
        quantity: 12,
        status: 'valide',
        daysAgo: 20,
        notes: 'Engagement trimestriel de livraison sous 48 heures.',
      },
      {
        title: 'Contrat Prestation Conseil & Audit',
        reference: 'CTR-VTE-09',
        partnerName: 'Clinique Espoir Plus',
        category: 'Prestation Service',
        amount: 1850000,
        quantity: 6,
        status: 'en_cours',
        daysAgo: 7,
        notes: 'Paiement échelonné en 3 tranches mensuelles.',
      },
    ],
  },
  {
    moduleId: 'mod_shipping',
    items: [
      {
        title: 'Expédition Palette Équipements Bureau',
        reference: 'EXP-2026-31',
        partnerName: 'DHL Express Cameroun',
        category: 'Express National',
        amount: 42000,
        quantity: 6,
        status: 'termine',
        daysAgo: 3,
        notes: 'Bordereau signé à la réception par le destinataire.',
      },
      {
        title: 'Colisage Commande #CMD-2026-0002',
        reference: 'EXP-2026-34',
        partnerName: 'Transporteur Inter-Villes',
        category: 'Messagerie Routière',
        amount: 28500,
        quantity: 4,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'En cours de chargement au quai 2 de l’entrepôt.',
      },
    ],
  },
  {
    moduleId: 'mod_fleet',
    items: [
      {
        title: 'Tournée Livraison Zone Industrielle Bonabéri',
        reference: 'FLT-TRN-102',
        partnerName: 'Camionnette Hilux LT-412',
        category: 'Zone Industrielle',
        amount: 145000,
        quantity: 48,
        status: 'termine',
        daysAgo: 1,
        notes: '4 livraisons clients complétées sans incident.',
      },
      {
        title: 'Course Express Centre Administratif',
        reference: 'FLT-TRN-105',
        partnerName: 'Moto Coursier #03',
        category: 'Centre-Ville',
        amount: 18000,
        quantity: 14,
        status: 'en_cours',
        daysAgo: 0,
        notes: 'Dépôt pli factures officielles et accusé de réception.',
      },
    ],
  },
  {
    moduleId: 'mod_barcode',
    items: [
      {
        title: 'Lot Étiquettes EAN-13 Nouvel Arrivage',
        reference: 'BAR-LOT-88',
        partnerName: 'Entrepôt Central',
        category: 'EAN13 / Thermique',
        amount: 1420000,
        quantity: 180,
        status: 'termine',
        daysAgo: 4,
        notes: 'Étiquetage complet de la gamme informatique et câblage.',
      },
      {
        title: 'Étiquettes QR Emplacements Rayonnage',
        reference: 'BAR-LOT-89',
        partnerName: 'Dépôt Agence Yaoundé',
        category: 'QR Code / Rayons',
        amount: 320000,
        quantity: 45,
        status: 'valide',
        daysAgo: 8,
        notes: 'Allées A1 à C5 identifiées pour inventaire rapide.',
      },
    ],
  },
  {
    moduleId: 'mod_expenses',
    items: [
      {
        title: 'Déplacement Mission Commerciale Yaoundé',
        reference: 'NDF-2026-07',
        partnerName: 'Jean-Paul Mbarga',
        category: 'Transport & Hébergement',
        amount: 85000,
        quantity: 4,
        status: 'valide',
        daysAgo: 5,
        notes: 'Justificatifs hôtel et carburant joints et approuvés.',
      },
      {
        title: 'Frais Déjeuner Partenaires B2B',
        reference: 'NDF-2026-08',
        partnerName: 'Claire Ngo',
        category: 'Réception Client',
        amount: 34500,
        quantity: 2,
        status: 'en_cours',
        daysAgo: 2,
        notes: 'En attente de validation comptable pour remboursement.',
      },
    ],
  },
  {
    moduleId: 'mod_assets',
    items: [
      {
        title: 'Serveur Rack Entreprise & Baie Réseau',
        reference: 'IMM-241-01',
        partnerName: 'Direction SI',
        category: 'Matériel Informatique (Cl. 244)',
        amount: 1200000,
        quantity: 4,
        status: 'valide',
        daysAgo: 30,
        notes: 'Amortissement linéaire sur 4 ans (25% / an).',
      },
      {
        title: 'Mobilier & Postes de Travail Open Space',
        reference: 'IMM-244-02',
        partnerName: 'Siège Social',
        category: 'Mobilier de Bureau (Cl. 244)',
        amount: 650000,
        quantity: 5,
        status: 'valide',
        daysAgo: 25,
        notes: 'Actif inventorié et affecté au siège.',
      },
    ],
  },
  {
    moduleId: 'mod_taxes',
    items: [
      {
        title: 'Déclaration TVA Mensuelle Collectée / Déductible',
        reference: 'TVA-2026-03',
        partnerName: 'Direction Générale des Impôts',
        category: 'TVA 19.25%',
        amount: 228125,
        quantity: 19,
        status: 'en_cours',
        daysAgo: 3,
        notes: 'TVA collectée (451 225) moins TVA déductible (223 100).',
      },
      {
        title: 'Acompte IS & Centimes Additionnels',
        reference: 'FISC-2026-IS',
        partnerName: 'Recette des Impôts',
        category: 'Impôt Sociétés',
        amount: 145000,
        quantity: 2,
        status: 'valide',
        daysAgo: 14,
        notes: 'Quittance archivée dans le module GED.',
      },
    ],
  },
  {
    moduleId: 'mod_collections',
    items: [
      {
        title: 'Relance Solde Partiel Facture #FAC-2026-0002',
        reference: 'REC-2026-01',
        partnerName: 'Société Atlantique BTP',
        category: 'Relance Niveau 1',
        amount: 520000,
        quantity: 8,
        status: 'en_cours',
        daysAgo: 2,
        notes: 'Promesse de virement reçue pour fin de semaine.',
      },
      {
        title: 'Suivi Créance Émise #FAC-2026-0003',
        reference: 'REC-2026-02',
        partnerName: 'Clinique Espoir Plus',
        category: 'Suivi Préventif',
        amount: 649000,
        quantity: 3,
        status: 'valide',
        daysAgo: 1,
        notes: 'Facture accusée réception par le service comptable client.',
      },
    ],
  },
  {
    moduleId: 'mod_budgets',
    items: [
      {
        title: 'Enveloppe Budgétaire Direction Commerciale',
        reference: 'BUD-COM-2026',
        partnerName: 'Pôle Ventes & CRM',
        category: 'Exercice 2026',
        amount: 3200000,
        quantity: 42,
        status: 'valide',
        daysAgo: 20,
        notes: '42% du budget annuel engagé conformément aux prévisions.',
      },
      {
        title: 'Budget Approvisionnement & Logistique',
        reference: 'BUD-LOG-2026',
        partnerName: 'Pôle Logistique',
        category: 'Exercice 2026',
        amount: 8500000,
        quantity: 36,
        status: 'en_cours',
        daysAgo: 15,
        notes: 'Réserve disponible pour réassort trimestriel.',
      },
    ],
  },
  {
    moduleId: 'mod_reconcile',
    items: [
      {
        title: 'Rapprochement Relevé Bancaire Mars',
        reference: 'RAP-BQ-03',
        partnerName: 'Compte Bancaire Principal',
        category: 'Période Mensuelle',
        amount: 4850000,
        quantity: 14,
        status: 'termine',
        daysAgo: 2,
        notes: 'Écart nul entre le relevé bancaire et le compte 521.',
      },
      {
        title: 'Pointage Bordereau Remise Chèques',
        reference: 'RAP-BQ-04',
        partnerName: 'Compte Bancaire Principal',
        category: 'Encaissements Clients',
        amount: 920000,
        quantity: 3,
        status: 'en_cours',
        daysAgo: 1,
        notes: '2 chèques compensés, 1 en cours d’encaissement.',
      },
    ],
  },
  {
    moduleId: 'mod_recruitment',
    items: [
      {
        title: 'Candidature Poste Technico-Commercial',
        reference: 'REC-CAND-12',
        partnerName: 'Samuel Essomba',
        category: 'Commercial B2B',
        amount: 380000,
        quantity: 88,
        status: 'en_cours',
        daysAgo: 4,
        notes: 'Entretien technique validé avec la direction.',
      },
      {
        title: 'Recrutement Assistant Comptable OHADA',
        reference: 'REC-CAND-15',
        partnerName: 'Aline Kamga',
        category: 'Finance & Comptabilité',
        amount: 290000,
        quantity: 92,
        status: 'valide',
        daysAgo: 9,
        notes: 'Promesse d’embauche CDD 6 mois émise.',
      },
    ],
  },
  {
    moduleId: 'mod_appraisals',
    items: [
      {
        title: 'Revue Annuelle Performance Commerciale',
        reference: 'EVAL-2026-01',
        partnerName: 'Jean-Paul Mbarga',
        category: 'Cycle S1 2026',
        amount: 150000,
        quantity: 94,
        status: 'termine',
        daysAgo: 11,
        notes: 'Dépassement des objectifs de vente sur le trimestre.',
      },
      {
        title: 'Évaluation Gestionnaire de Stocks',
        reference: 'EVAL-2026-02',
        partnerName: 'Brice Tchoupo',
        category: 'Cycle S1 2026',
        amount: 90000,
        quantity: 87,
        status: 'valide',
        daysAgo: 13,
        notes: 'Fiabilité d’inventaire supérieure à 99%.',
      },
    ],
  },
  {
    moduleId: 'mod_training',
    items: [
      {
        title: 'Atelier Réforme Comptable SYSCOHADA Révisé',
        reference: 'FORM-2026-01',
        partnerName: 'Cabinet Expertise Audit',
        category: 'Finance & Fiscalité',
        amount: 240000,
        quantity: 16,
        status: 'termine',
        daysAgo: 19,
        notes: '2 collaborateurs certifiés avec attestation.',
      },
      {
        title: 'Formation Sécurité Entrepôt & Logistique',
        reference: 'FORM-2026-02',
        partnerName: 'Institut Prévention Pro',
        category: 'Logistique & HSE',
        amount: 165000,
        quantity: 12,
        status: 'en_cours',
        daysAgo: 5,
        notes: 'Session pratique programmée sur le site central.',
      },
    ],
  },
  {
    moduleId: 'mod_timesheets',
    items: [
      {
        title: 'Déploiement Réseau & Postes Client',
        reference: 'TS-2026-W12',
        partnerName: 'Clinique Espoir Plus',
        category: 'Intégration SI',
        amount: 320000,
        quantity: 24,
        status: 'valide',
        daysAgo: 2,
        notes: '24 heures facturées au taux horaire conventionnel.',
      },
      {
        title: 'Audit Inventaire & Paramétrage Stocks',
        reference: 'TS-2026-W13',
        partnerName: 'Groupe Sitracel',
        category: 'Conseil Opérationnel',
        amount: 180000,
        quantity: 12,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'Phase finale de recette utilisateurs en cours.',
      },
    ],
  },
  {
    moduleId: 'mod_projects',
    items: [
      {
        title: 'Digitalisation Complète Point de Vente',
        reference: 'PRJ-2026-01',
        partnerName: 'Groupe Sitracel',
        category: 'Déploiement ERP & POS',
        amount: 2800000,
        quantity: 75,
        status: 'en_cours',
        daysAgo: 8,
        notes: 'Phase 3 sur 4 : formation des caissiers et mise en service.',
      },
      {
        title: 'Installation Infrastructure Solaire Secours',
        reference: 'PRJ-2026-02',
        partnerName: 'Clinique Espoir Plus',
        category: 'Énergie & Infrastructure',
        amount: 4500000,
        quantity: 100,
        status: 'termine',
        daysAgo: 16,
        notes: 'PV de livraison définitive signé sans réserve.',
      },
    ],
  },
  {
    moduleId: 'mod_tasks',
    items: [
      {
        title: 'Préparer Import Catalogue Fournisseur Excel',
        reference: 'TASK-401',
        partnerName: 'Brice Tchoupo',
        category: 'Priorité Haute',
        amount: 0,
        quantity: 4,
        status: 'en_cours',
        daysAgo: 0,
        notes: 'Vérifier les codes SKU et prix d’achat HT avant import.',
      },
      {
        title: 'Clôturer Journaux Comptables Mensuels',
        reference: 'TASK-402',
        partnerName: 'Claire Ngo',
        category: 'Priorité Normale',
        amount: 0,
        quantity: 6,
        status: 'valide',
        daysAgo: 2,
        notes: 'Toutes les écritures VE, AC et BQ sont équilibrées.',
      },
    ],
  },
  {
    moduleId: 'mod_manufacturing',
    items: [
      {
        title: 'Assemblage Lots Coffrets Ondulés 2kVA',
        reference: 'OF-2026-014',
        partnerName: 'Atelier Assemblage A',
        category: 'Coffret Secours 2kVA',
        amount: 1450000,
        quantity: 15,
        status: 'en_cours',
        daysAgo: 3,
        notes: '10 unités terminées, 5 en test de charge.',
      },
      {
        title: 'Kit Câblage Réseau Cat6 Pré-Serti 50m',
        reference: 'OF-2026-011',
        partnerName: 'Atelier Assemblage B',
        category: 'Pack Réseau Pro',
        amount: 480000,
        quantity: 40,
        status: 'termine',
        daysAgo: 7,
        notes: 'Lot transféré vers l’entrepôt central pour commercialisation.',
      },
    ],
  },
  {
    moduleId: 'mod_bom',
    items: [
      {
        title: 'Nomenclature Kit Poste de Travail Complet',
        reference: 'BOM-POSTE-01',
        partnerName: 'Station Travail Pro',
        category: 'v2.1 Standard',
        amount: 410000,
        quantity: 5,
        status: 'valide',
        daysAgo: 21,
        notes: 'PC portable + écran 24" + onduleur + souris/clavier + sacoche.',
      },
      {
        title: 'Nomenclature Coffret Électrique Secours',
        reference: 'BOM-ELEC-04',
        partnerName: 'Coffret Secours 2kVA',
        category: 'v1.4 Certifiée',
        amount: 96000,
        quantity: 7,
        status: 'valide',
        daysAgo: 17,
        notes: 'Inclut disjoncteur, parafoudre, batteries et connectique.',
      },
    ],
  },
  {
    moduleId: 'mod_maintenance',
    items: [
      {
        title: 'Révision Préventive Groupe Électrogène',
        reference: 'MNT-2026-09',
        partnerName: 'Groupe Perkins 45kVA',
        category: 'Préventive',
        amount: 115000,
        quantity: 3,
        status: 'termine',
        daysAgo: 6,
        notes: 'Vidange huile et remplacement filtres réalisés.',
      },
      {
        title: 'Maintenance Chariot Élévateur Entrepôt',
        reference: 'MNT-2026-10',
        partnerName: 'Chariot Fenwick #02',
        category: 'Curative',
        amount: 78000,
        quantity: 5,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'Remplacement flexibles hydrauliques planifié.',
      },
    ],
  },
  {
    moduleId: 'mod_quality',
    items: [
      {
        title: 'Inspection Réception Lot Écrans LED 24"',
        reference: 'QUA-2026-22',
        partnerName: 'Lot PO-2026-0001',
        category: 'Contrôle Entrée',
        amount: 0,
        quantity: 100,
        status: 'valide',
        daysAgo: 4,
        notes: '100% conforme aux spécifications constructeur.',
      },
      {
        title: 'Audit Emballage & Protection Expéditions',
        reference: 'QUA-2026-23',
        partnerName: 'Quai Expédition',
        category: 'Contrôle Sortie',
        amount: 25000,
        quantity: 96,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'Renforcement du calage mousse recommandé sur colis fragiles.',
      },
    ],
  },
  {
    moduleId: 'mod_it_assets',
    items: [
      {
        title: 'Parc Postes Portables Direction & Commerciaux',
        reference: 'IT-PARC-01',
        partnerName: 'Équipe Commerciale',
        category: 'Ordinateurs Portables',
        amount: 3400000,
        quantity: 8,
        status: 'valide',
        daysAgo: 28,
        notes: 'Tous équipés de chiffrement disque et licences bureautiques.',
      },
      {
        title: 'Licences Logiciels & Certificats SSL',
        reference: 'IT-LIC-04',
        partnerName: 'Infrastructure Cloud',
        category: 'Licences SaaS',
        amount: 420000,
        quantity: 12,
        status: 'valide',
        daysAgo: 10,
        notes: 'Échéance renouvellement prévue dans 9 mois.',
      },
    ],
  },
  {
    moduleId: 'mod_field_service',
    items: [
      {
        title: 'Installation Terminaux Caisse sur Site',
        reference: 'INT-2026-18',
        partnerName: 'Supermarché Central',
        category: 'Douala Akwa',
        amount: 210000,
        quantity: 6,
        status: 'termine',
        daysAgo: 3,
        notes: '3 caisses connectées et testées avec lecteur code-barres.',
      },
      {
        title: 'Dépannage Lien Fibre & Onduleur Site',
        reference: 'INT-2026-19',
        partnerName: 'Cabinet Juridique Ndongo',
        category: 'Bonapriso',
        amount: 65000,
        quantity: 2,
        status: 'en_cours',
        daysAgo: 0,
        notes: 'Technicien assigné, intervention prévue cet après-midi.',
      },
    ],
  },
  {
    moduleId: 'mod_ecommerce',
    items: [
      {
        title: 'Commande Web #WEB-9042 (Paiement Mobile Money)',
        reference: 'WEB-9042',
        partnerName: 'Marc-Antoine Biloa',
        category: 'Boutique en ligne',
        amount: 145000,
        quantity: 3,
        status: 'valide',
        daysAgo: 1,
        notes: 'Paiement confirmé, colis prêt pour livraison.',
      },
      {
        title: 'Panier B2B Synchronisé #WEB-9045',
        reference: 'WEB-9045',
        partnerName: 'Entreprise Horizon',
        category: 'Portail Client B2B',
        amount: 580000,
        quantity: 10,
        status: 'en_cours',
        daysAgo: 0,
        notes: 'Demande de facture proforma générée automatiquement.',
      },
    ],
  },
  {
    moduleId: 'mod_marketing',
    items: [
      {
        title: 'Campagne Acquisition PME & Industries',
        reference: 'MKT-2026-Q1',
        partnerName: 'Régie Digitale Locale',
        category: 'LinkedIn & Search',
        amount: 350000,
        quantity: 42,
        status: 'en_cours',
        daysAgo: 7,
        notes: '42 prospects qualifiés générés avec coût d’acquisition optimisé.',
      },
      {
        title: 'Campagne E-mailing Renouvellement Équipements',
        reference: 'MKT-MAIL-04',
        partnerName: 'Base Clients Actifs',
        category: 'CRM E-mailing',
        amount: 65000,
        quantity: 18,
        status: 'termine',
        daysAgo: 14,
        notes: 'Taux d’ouverture 38%, 18 demandes de devis reçues.',
      },
    ],
  },
  {
    moduleId: 'mod_events',
    items: [
      {
        title: 'Petit-Déjeuner Démonstration JESSI B2B',
        reference: 'EVT-2026-01',
        partnerName: 'Hôtel Akwa Palace',
        category: 'Atelier Dirigeants',
        amount: 420000,
        quantity: 35,
        status: 'valide',
        daysAgo: 5,
        notes: '35 dirigeants et DAF inscrits pour la session live.',
      },
      {
        title: 'Participation Salon Entreprises & PME',
        reference: 'EVT-2026-02',
        partnerName: 'Palais des Congrès',
        category: 'Stand Exposant',
        amount: 650000,
        quantity: 120,
        status: 'en_cours',
        daysAgo: 12,
        notes: 'Supports visuels et démonstrateurs prêts.',
      },
    ],
  },
  {
    moduleId: 'mod_ged',
    items: [
      {
        title: 'Dossier Statuts, RCCM & Attestation Fiscale 2026',
        reference: 'GED-ADM-001',
        partnerName: 'Direction Juridique',
        category: 'Dossier Légal',
        amount: 0,
        quantity: 14,
        status: 'valide',
        daysAgo: 26,
        notes: 'Pièces officielles numérisées et certifiées conformes.',
      },
      {
        title: 'Contrats Fournisseurs & Conditions Générales',
        reference: 'GED-ACH-019',
        partnerName: 'Service Achats',
        category: 'Contrats Tiers',
        amount: 2400000,
        quantity: 8,
        status: 'valide',
        daysAgo: 15,
        notes: 'Indexés par fournisseur et date de renouvellement.',
      },
    ],
  },
  {
    moduleId: 'mod_calendar',
    items: [
      {
        title: 'Comité Mensuel de Pilotage Trésorerie',
        reference: 'RDV-2026-041',
        partnerName: 'Direction & Comptabilité',
        category: 'Comité Interne',
        amount: 0,
        quantity: 60,
        status: 'valide',
        daysAgo: 0,
        notes: 'Revue des encaissements et priorités règlements fournisseurs.',
      },
      {
        title: 'Rendez-vous Signature Contrat Cadre',
        reference: 'RDV-2026-044',
        partnerName: 'Groupe Sitracel',
        category: 'Rendez-vous Client',
        amount: 2800000,
        quantity: 45,
        status: 'en_cours',
        daysAgo: 1,
        notes: 'Présentation de la proposition finale et planning livraison.',
      },
    ],
  },
];

function buildInsertStmt(
  db: DbClient,
  companyId: string,
  collectionName: string,
  id: string,
  ownerId: string,
  payload: Record<string, unknown>,
  ts: string
): DbPreparedStatement {
  return db
    .prepare(
      `INSERT INTO erp_records (company_id, collection_name, id, owner_id, is_demo, data_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    )
    .bind(companyId, collectionName, id, ownerId, JSON.stringify(payload), ts, ts);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedFullDemoWorkspace(params: {
  db: DbClient;
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  userFirstName: string;
  userLastName: string;
  userPhone: string;
  userAddress: string;
}): Promise<string> {
  const { db, userUid, userEmail, userDisplayName, userFirstName, userLastName, userPhone, userAddress } = params;
  const companyId = generateId();
  const ts = new Date().toISOString();
  const displayName = userDisplayName || `${userFirstName} ${userLastName}`.trim() || userEmail;

  const companyName = 'JESSI Démo Complète';
  const currency = 'XAF';
  const sellerSnapshot = JSON.stringify({
    name: companyName,
    legalForm: 'SARL',
    taxId: 'M042619874321K',
    rccm: 'RC/DLA/2026/B/0099',
    address: userAddress || 'Boulevard de la Liberté, Akwa, Douala',
    phone: userPhone || '+237 699 00 11 22',
    email: userEmail,
    city: 'Douala, Cameroun',
  });

  const stmts: DbPreparedStatement[] = [];

  // 1. Demo company (no separate screen-lock password so access is instant & frictionless)
  stmts.push(
    db
      .prepare(
        `INSERT INTO companies (
          id, name, account_type, owner_first_name, owner_last_name, sector, city, legal_form,
          tax_id, rccm, currency, accounting_standard, address, phone, email,
          invoice_prefix, invoice_payment_terms, invoice_notes_default,
          password_salt, password_hash, enabled_modules_json, owner_id, is_demo, created_at, updated_at
        ) VALUES (?, ?, 'entreprise', ?, ?, 'Distribution, Services & Industrie', 'Douala, Cameroun', 'SARL',
          'M042619874321K', 'RC/DLA/2026/B/0099', 'XAF', 'OHADA', ?, ?, ?,
          'FAC', 'Paiement à 30 jours net', 'Environnement de démonstration complet couvrant les 66 modules JESSI.',
          '', '', ?, ?, 1, ?, ?)`
      )
      .bind(
        companyId,
        companyName,
        userFirstName || 'Utilisateur',
        userLastName || 'Démo',
        userAddress || 'Boulevard de la Liberté, Akwa, Douala',
        userPhone || '+237 699 00 11 22',
        userEmail,
        JSON.stringify(ALL_66_CATALOG_MODULE_IDS),
        userUid,
        ts,
        ts
      )
  );

  // 2. Owner member
  stmts.push(
    db
      .prepare(
        `INSERT INTO company_members (
          id, company_id, uid, email, display_name, role_code, department_name,
          allowed_modules_json, can_write, can_validate, can_delete, active, owner_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'admin', 'Direction Générale', ?, 1, 1, 1, 1, ?, ?, ?)`
      )
      .bind(
        generateId(),
        companyId,
        userUid,
        userEmail,
        displayName,
        JSON.stringify(ALL_ERP_ROUTE_MODULES),
        userUid,
        ts,
        ts
      )
  );

  // 3. Roles & Departments
  const roles = [
    { code: 'admin', name: 'Administrateur Système', description: 'Accès intégral à tous les modules et paramètres.', allowedModules: ALL_ERP_ROUTE_MODULES, canWrite: true, canValidate: true, canDelete: true },
    { code: 'direction', name: 'Direction Générale', description: 'Pilotage exécutif et validations financières.', allowedModules: ALL_ERP_ROUTE_MODULES.filter((m) => m !== 'admin'), canWrite: true, canValidate: true, canDelete: false },
    { code: 'commercial', name: 'Responsable Commercial', description: 'CRM, devis, commandes et facturation.', allowedModules: ['launcher', 'dashboard', 'crm', 'sales', 'inventory', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
    { code: 'comptable', name: 'Chef Comptable OHADA', description: 'Comptabilité générale, journaux et trésorerie.', allowedModules: ['launcher', 'dashboard', 'sales', 'purchases', 'accounting', 'treasury', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
    { code: 'magasinier', name: 'Gestionnaire de Stocks', description: 'Entrepôts, transferts et réceptions.', allowedModules: ['launcher', 'dashboard', 'inventory', 'purchases', 'sales', 'docs', 'dynamic_module'], canWrite: true, canValidate: false, canDelete: false },
    { code: 'rh', name: 'Responsable RH', description: 'Collaborateurs, congés et bulletins de paie.', allowedModules: ['launcher', 'dashboard', 'hr', 'reporting', 'docs', 'dynamic_module'], canWrite: true, canValidate: true, canDelete: false },
  ];
  for (const r of roles) {
    stmts.push(buildInsertStmt(db, companyId, 'roles', generateId(), userUid, r, ts));
  }

  const depts = [
    { code: 'DIR', name: 'Direction Générale', managerName: displayName, budget: 2500000 },
    { code: 'COM', name: 'Ventes & CRM', managerName: 'Jean-Paul Mbarga', budget: 3200000 },
    { code: 'FIN', name: 'Finance & Comptabilité', managerName: 'Claire Ngo', budget: 1800000 },
    { code: 'LOG', name: 'Logistique & Stocks', managerName: 'Brice Tchoupo', budget: 8500000 },
    { code: 'RH', name: 'Ressources Humaines', managerName: 'Sandrine Etoa', budget: 1200000 },
  ];
  for (const d of depts) {
    stmts.push(buildInsertStmt(db, companyId, 'departments', generateId(), userUid, d, ts));
  }

  // 4. Categories, Warehouses & Products
  const catItId = generateId();
  const catBureauId = generateId();
  const catSrvId = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'categories', catItId, userUid, { code: 'CAT-IT', name: 'Équipements IT & Réseau', description: 'Postes informatiques, écrans et onduleurs.' }, ts),
    buildInsertStmt(db, companyId, 'categories', catBureauId, userUid, { code: 'CAT-BUR', name: 'Fournitures & Bureautique', description: 'Papeterie, consommables et accessoires.' }, ts),
    buildInsertStmt(db, companyId, 'categories', catSrvId, userUid, { code: 'CAT-SRV', name: 'Services & Conseil', description: 'Prestations d’installation, formation et audit.' }, ts)
  );

  const whCentralId = generateId();
  const whYdeId = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'warehouses', whCentralId, userUid, { code: 'ENT-DLA', name: 'Entrepôt Central Douala', location: 'Zone Industrielle Akwa', managerName: 'Brice Tchoupo', isDefault: true }, ts),
    buildInsertStmt(db, companyId, 'warehouses', whYdeId, userUid, { code: 'ENT-YDE', name: 'Dépôt Agence Yaoundé', location: 'Bastos, Yaoundé', managerName: 'Samuel Essomba', isDefault: false }, ts)
  );

  const prodLaptopId = generateId();
  const prodMonitorId = generateId();
  const prodUpsId = generateId();
  const prodPrinterId = generateId();
  const prodServiceId = generateId();

  stmts.push(
    buildInsertStmt(db, companyId, 'products', prodLaptopId, userUid, {
      sku: 'SKU-IT-001',
      name: 'PC Portable ProBook 15" i7',
      categoryId: catItId,
      categoryName: 'Équipements IT & Réseau',
      unit: 'Unité',
      purchasePrice: 360000,
      salePrice: 485000,
      taxRate: 19.25,
      stockQty: 14,
      minStock: 4,
      warehouseStocks: { [whCentralId]: 10, [whYdeId]: 4 },
      trackStock: true,
    }, ts),
    buildInsertStmt(db, companyId, 'products', prodMonitorId, userUid, {
      sku: 'SKU-IT-002',
      name: 'Écran LED IPS 24" Full HD',
      categoryId: catItId,
      categoryName: 'Équipements IT & Réseau',
      unit: 'Unité',
      purchasePrice: 82000,
      salePrice: 120000,
      taxRate: 19.25,
      stockQty: 22,
      minStock: 5,
      warehouseStocks: { [whCentralId]: 16, [whYdeId]: 6 },
      trackStock: true,
    }, ts),
    buildInsertStmt(db, companyId, 'products', prodUpsId, userUid, {
      sku: 'SKU-NRJ-003',
      name: 'Onduleur APC Smart 1500VA',
      categoryId: catItId,
      categoryName: 'Équipements IT & Réseau',
      unit: 'Unité',
      purchasePrice: 95000,
      salePrice: 145000,
      taxRate: 19.25,
      stockQty: 3,
      minStock: 5,
      warehouseStocks: { [whCentralId]: 3, [whYdeId]: 0 },
      trackStock: true,
    }, ts),
    buildInsertStmt(db, companyId, 'products', prodPrinterId, userUid, {
      sku: 'SKU-BUR-004',
      name: 'Imprimante Multifonction Laser Pro',
      categoryId: catBureauId,
      categoryName: 'Fournitures & Bureautique',
      unit: 'Unité',
      purchasePrice: 155000,
      salePrice: 215000,
      taxRate: 19.25,
      stockQty: 8,
      minStock: 3,
      warehouseStocks: { [whCentralId]: 6, [whYdeId]: 2 },
      trackStock: true,
    }, ts),
    buildInsertStmt(db, companyId, 'products', prodServiceId, userUid, {
      sku: 'SRV-DEP-005',
      name: 'Pack Déploiement & Formation Équipe',
      categoryId: catSrvId,
      categoryName: 'Services & Conseil',
      unit: 'Forfait',
      purchasePrice: 0,
      salePrice: 350000,
      taxRate: 19.25,
      stockQty: 99,
      minStock: 0,
      warehouseStocks: {},
      trackStock: false,
    }, ts)
  );

  // Stock Movements
  stmts.push(
    buildInsertStmt(db, companyId, 'stockMovements', generateId(), userUid, {
      productId: prodLaptopId,
      productName: 'PC Portable ProBook 15" i7',
      sku: 'SKU-IT-001',
      warehouseId: whCentralId,
      warehouseName: 'Entrepôt Central Douala',
      type: 'entree',
      quantity: 12,
      unitCost: 360000,
      totalValue: 4320000,
      referenceType: 'purchaseOrder',
      referenceNumber: 'PO-2026-0001',
      note: 'Réception arrivage fournisseur TechImport',
      date: isoDaysAgo(12),
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'stockMovements', generateId(), userUid, {
      productId: prodLaptopId,
      productName: 'PC Portable ProBook 15" i7',
      sku: 'SKU-IT-001',
      warehouseId: whCentralId,
      warehouseName: 'Entrepôt Central Douala',
      toWarehouseId: whYdeId,
      toWarehouseName: 'Dépôt Agence Yaoundé',
      type: 'transfert',
      quantity: 4,
      unitCost: 360000,
      totalValue: 1440000,
      referenceType: 'manuel',
      note: 'Dotation stock agence Yaoundé',
      date: isoDaysAgo(7),
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'stockMovements', generateId(), userUid, {
      productId: prodMonitorId,
      productName: 'Écran LED IPS 24" Full HD',
      sku: 'SKU-IT-002',
      warehouseId: whCentralId,
      warehouseName: 'Entrepôt Central Douala',
      type: 'sortie',
      quantity: 3,
      unitCost: 82000,
      totalValue: 246000,
      referenceType: 'salesOrder',
      referenceNumber: 'CMD-2026-0001',
      note: 'Livraison commande Groupe Sitracel',
      date: isoDaysAgo(5),
      authorEmail: userEmail,
    }, ts)
  );

  // 5. CRM: Leads, Customers, Opportunities, Interactions
  const cust1Id = generateId();
  const cust2Id = generateId();
  const cust3Id = generateId();

  stmts.push(
    buildInsertStmt(db, companyId, 'customers', cust1Id, userUid, {
      code: 'CLI-2026-0001',
      name: 'Groupe Sitracel SA',
      segment: 'B2B',
      email: 'achats@sitracel.cm',
      phone: '+237 677 12 34 56',
      address: 'Rue Castelnau, Akwa, Douala',
      taxId: 'M081200451234A',
      creditLimit: 10000000,
      balanceDue: 0,
      notes: 'Client grand compte équipement IT.',
    }, ts),
    buildInsertStmt(db, companyId, 'customers', cust2Id, userUid, {
      code: 'CLI-2026-0002',
      name: 'Société Atlantique BTP',
      segment: 'B2B',
      email: 'finance@atlantiquebtp.cm',
      phone: '+237 699 45 78 90',
      address: 'Bonapriso, Avenue Charles de Gaulle, Douala',
      taxId: 'M051900874112C',
      creditLimit: 8000000,
      balanceDue: 520000,
      notes: 'Règlement en 2 tranches convenu.',
    }, ts),
    buildInsertStmt(db, companyId, 'customers', cust3Id, userUid, {
      code: 'CLI-2026-0003',
      name: 'Clinique Espoir Plus',
      segment: 'Administration',
      email: 'direction@clinique-espoir.cm',
      phone: '+237 655 20 30 40',
      address: 'Bastos, Rue 1824, Yaoundé',
      taxId: 'M012100654321D',
      creditLimit: 5000000,
      balanceDue: 649000,
      notes: 'Client abonné maintenance mensuelle.',
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'leads', generateId(), userUid, {
      name: 'Hervé Fotso',
      companyName: 'Transit Littoral SARL',
      email: 'h.fotso@transit-littoral.cm',
      phone: '+237 690 11 22 33',
      source: 'Salon PME',
      status: 'qualifie',
      estimatedValue: 2400000,
      notes: 'Besoin de 5 postes portables et 2 imprimantes.',
    }, ts),
    buildInsertStmt(db, companyId, 'leads', generateId(), userUid, {
      name: 'Mireille Atangana',
      companyName: 'Cabinet Horizon Conseil',
      email: 'm.atangana@horizon.cm',
      phone: '+237 675 33 44 55',
      source: 'Recommandation',
      status: 'contacte',
      estimatedValue: 950000,
      notes: 'Démonstration JESSI programmée cette semaine.',
    }, ts),
    buildInsertStmt(db, companyId, 'leads', generateId(), userUid, {
      name: 'Patrick Ngassa',
      companyName: 'AgroDistrib Ouest',
      email: 'contact@agrodistrib.cm',
      phone: '+237 680 99 88 77',
      source: 'Campagne Web',
      status: 'nouveau',
      estimatedValue: 1750000,
      notes: 'Intéressé par la gestion multi-entrepôts.',
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'opportunities', generateId(), userUid, {
      title: 'Renouvellement Parc Bureautique 10 Postes',
      customerId: cust1Id,
      customerName: 'Groupe Sitracel SA',
      stage: 'negociation',
      amount: 5400000,
      probability: 80,
      expectedCloseDate: isoDaysFromNow(10),
    }, ts),
    buildInsertStmt(db, companyId, 'opportunities', generateId(), userUid, {
      title: 'Équipement Nouvelle Agence Yaoundé',
      customerId: cust2Id,
      customerName: 'Société Atlantique BTP',
      stage: 'proposition',
      amount: 3150000,
      probability: 60,
      expectedCloseDate: isoDaysFromNow(20),
    }, ts),
    buildInsertStmt(db, companyId, 'opportunities', generateId(), userUid, {
      title: 'Contrat Déploiement Informatique Annuel',
      customerId: cust3Id,
      customerName: 'Clinique Espoir Plus',
      stage: 'gagnee',
      amount: 1450000,
      probability: 100,
      expectedCloseDate: isoDaysAgo(2),
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'interactions', generateId(), userUid, {
      entityType: 'customer',
      entityId: cust1Id,
      entityName: 'Groupe Sitracel SA',
      channel: 'reunion',
      summary: 'Présentation de la nouvelle gamme ProBook et validation des délais de livraison.',
      date: isoDaysAgo(4),
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'interactions', generateId(), userUid, {
      entityType: 'customer',
      entityId: cust2Id,
      entityName: 'Société Atlantique BTP',
      channel: 'appel',
      summary: 'Point téléphonique sur le règlement du solde restant de la facture FAC-2026-0002.',
      date: isoDaysAgo(1),
      authorEmail: userEmail,
    }, ts)
  );

  // 6. Quotes, Sales Orders, Invoices + Invoice Lines
  const quote1Id = generateId();
  const order1Id = generateId();
  const inv1Id = generateId();
  const inv2Id = generateId();
  const inv3Id = generateId();

  const quoteLines1 = [
    {
      productId: prodLaptopId,
      sku: 'SKU-IT-001',
      name: 'PC Portable ProBook 15" i7',
      categoryName: 'Équipements IT & Réseau',
      qty: 2,
      unitPrice: 485000,
      discountPct: 0,
      taxRate: 19.25,
      lineTotal: 1156725,
    },
  ];
  stmts.push(
    buildInsertStmt(db, companyId, 'quotes', quote1Id, userUid, {
      number: 'DEV-2026-0001',
      customerId: cust1Id,
      customerName: 'Groupe Sitracel SA',
      date: isoDaysAgo(10),
      validUntil: isoDaysFromNow(20),
      status: 'converti',
      lines: quoteLines1,
      subtotal: 970000,
      discountTotal: 0,
      taxTotal: 186725,
      total: 1156725,
      salesOrderId: order1Id,
      notes: 'Devis validé et converti en commande client.',
    }, ts),
    buildInsertStmt(db, companyId, 'quotes', generateId(), userUid, {
      number: 'DEV-2026-0002',
      customerId: cust2Id,
      customerName: 'Société Atlantique BTP',
      date: isoDaysAgo(2),
      validUntil: isoDaysFromNow(28),
      status: 'envoye',
      lines: [
        {
          productId: prodPrinterId,
          sku: 'SKU-BUR-004',
          name: 'Imprimante Multifonction Laser Pro',
          categoryName: 'Fournitures & Bureautique',
          qty: 2,
          unitPrice: 215000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 512775,
        },
      ],
      subtotal: 430000,
      discountTotal: 0,
      taxTotal: 82775,
      total: 512775,
      notes: 'Offre envoyée pour l’équipement du service administratif.',
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'salesOrders', order1Id, userUid, {
      number: 'CMD-2026-0001',
      quoteId: quote1Id,
      customerId: cust1Id,
      customerName: 'Groupe Sitracel SA',
      warehouseId: whCentralId,
      date: isoDaysAgo(8),
      status: 'facturee',
      lines: quoteLines1,
      subtotal: 970000,
      discountTotal: 0,
      taxTotal: 186725,
      total: 1156725,
      invoiceId: inv1Id,
      notes: 'Livrée et facturée.',
    }, ts),
    buildInsertStmt(db, companyId, 'salesOrders', generateId(), userUid, {
      number: 'CMD-2026-0002',
      customerId: cust3Id,
      customerName: 'Clinique Espoir Plus',
      warehouseId: whCentralId,
      date: isoDaysAgo(1),
      status: 'validee',
      lines: [
        {
          productId: prodMonitorId,
          sku: 'SKU-IT-002',
          name: 'Écran LED IPS 24" Full HD',
          categoryName: 'Équipements IT & Réseau',
          qty: 3,
          unitPrice: 120000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 429300,
        },
      ],
      subtotal: 360000,
      discountTotal: 0,
      taxTotal: 69300,
      total: 429300,
      notes: 'Stock réservé pour livraison Yaoundé.',
    }, ts)
  );

  // Invoices in normalized tables (invoices + invoice_lines)
  const insertInvoice = (
    id: string,
    num: string,
    soId: string,
    custId: string,
    custName: string,
    custEmail: string,
    custPhone: string,
    custAddr: string,
    custTax: string,
    date: string,
    dueDate: string,
    status: string,
    subtotal: number,
    taxTotal: number,
    total: number,
    paidAmount: number,
    balanceDue: number,
    notes: string,
    lines: Array<{
      productId: string;
      sku: string;
      name: string;
      categoryName: string;
      qty: number;
      unitPrice: number;
      discountPct: number;
      taxRate: number;
      lineTotal: number;
    }>
  ) => {
    stmts.push(
      db
        .prepare(
          `INSERT INTO invoices (
            id, company_id, number, sales_order_id, customer_id, customer_name,
            customer_email, customer_phone, customer_address, customer_tax_id,
            seller_snapshot_json, currency, payment_terms, date, due_date, status,
            subtotal, discount_total, tax_total, total, paid_amount, balance_due,
            notes, owner_id, is_demo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(
          id,
          companyId,
          num,
          soId,
          custId,
          custName,
          custEmail,
          custPhone,
          custAddr,
          custTax,
          sellerSnapshot,
          currency,
          'Paiement à 30 jours net',
          date,
          dueDate,
          status,
          subtotal,
          taxTotal,
          total,
          paidAmount,
          balanceDue,
          notes,
          userUid,
          ts,
          ts
        )
    );
    lines.forEach((l, idx) => {
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
            id,
            companyId,
            idx,
            l.productId,
            l.sku,
            l.name,
            l.categoryName,
            l.qty,
            l.unitPrice,
            l.discountPct,
            l.taxRate,
            l.lineTotal
          )
      );
    });
  };

  insertInvoice(
    inv1Id,
    'FAC-2026-0001',
    order1Id,
    cust1Id,
    'Groupe Sitracel SA',
    'achats@sitracel.cm',
    '+237 677 12 34 56',
    'Rue Castelnau, Akwa, Douala',
    'M081200451234A',
    isoDaysAgo(7),
    isoDaysFromNow(23),
    'payee',
    970000,
    186725,
    1156725,
    1156725,
    0,
    'Facture intégralement réglée par virement bancaire.',
    quoteLines1
  );

  insertInvoice(
    inv2Id,
    'FAC-2026-0002',
    '',
    cust2Id,
    'Société Atlantique BTP',
    'finance@atlantiquebtp.cm',
    '+237 699 45 78 90',
    'Bonapriso, Douala',
    'M051900874112C',
    isoDaysAgo(4),
    isoDaysFromNow(26),
    'partielle',
    850000,
    160500,
    1010500,
    490500,
    520000,
    'Acompte encaissé, solde attendu sous 15 jours.',
    [
      {
        productId: prodLaptopId,
        sku: 'SKU-IT-001',
        name: 'PC Portable ProBook 15" i7',
        categoryName: 'Équipements IT & Réseau',
        qty: 1,
        unitPrice: 485000,
        discountPct: 0,
        taxRate: 19.25,
        lineTotal: 578362.5,
      },
      {
        productId: prodPrinterId,
        sku: 'SKU-BUR-004',
        name: 'Imprimante Multifonction Laser Pro',
        categoryName: 'Fournitures & Bureautique',
        qty: 1,
        unitPrice: 365000,
        discountPct: 0,
        taxRate: 18.4,
        lineTotal: 432137.5,
      },
    ]
  );

  insertInvoice(
    inv3Id,
    'FAC-2026-0003',
    '',
    cust3Id,
    'Clinique Espoir Plus',
    'direction@clinique-espoir.cm',
    '+237 655 20 30 40',
    'Bastos, Yaoundé',
    'M012100654321D',
    isoDaysAgo(1),
    isoDaysFromNow(29),
    'emise',
    545000,
    104000,
    649000,
    0,
    649000,
    'Prestation déploiement réseau + onduleurs.',
    [
      {
        productId: prodServiceId,
        sku: 'SRV-DEP-005',
        name: 'Pack Déploiement & Formation Équipe',
        categoryName: 'Services & Conseil',
        qty: 1,
        unitPrice: 350000,
        discountPct: 0,
        taxRate: 19.25,
        lineTotal: 417375,
      },
      {
        productId: prodUpsId,
        sku: 'SKU-NRJ-003',
        name: 'Onduleur APC Smart 1500VA',
        categoryName: 'Équipements IT & Réseau',
        qty: 1,
        unitPrice: 195000,
        discountPct: 0,
        taxRate: 18.78,
        lineTotal: 231625,
      },
    ]
  );

  // 7. Purchases: Suppliers, Purchase Requests, Purchase Orders, Supplier Invoices
  const sup1Id = generateId();
  const sup2Id = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'suppliers', sup1Id, userUid, {
      code: 'FRN-2026-0001',
      name: 'TechImport Grossiste CEMAC',
      email: 'commandes@techimport.cm',
      phone: '+237 699 77 66 55',
      address: 'Zone Portuaire, Douala',
      taxId: 'M031400221199F',
      paymentTerms: '30 jours fin de mois',
      balancePayable: 960000,
    }, ts),
    buildInsertStmt(db, companyId, 'suppliers', sup2Id, userUid, {
      code: 'FRN-2026-0002',
      name: 'Papeterie & Mobilier Pro',
      email: 'ventes@papeteriepro.cm',
      phone: '+237 677 88 99 00',
      address: 'Rue Joffre, Douala',
      taxId: 'M071800334455G',
      paymentTerms: 'Comptant à réception',
      balancePayable: 0,
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'purchaseRequests', generateId(), userUid, {
      number: 'DA-2026-0001',
      requesterName: 'Brice Tchoupo',
      departmentName: 'Logistique & Stocks',
      date: isoDaysAgo(6),
      status: 'approuvee',
      lines: [
        {
          productId: prodUpsId,
          sku: 'SKU-NRJ-003',
          name: 'Onduleur APC Smart 1500VA',
          qty: 8,
          unitPrice: 95000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 906300,
        },
      ],
      estimatedTotal: 906300,
      notes: 'Réapprovisionnement urgent suite seuil critique atteint.',
    }, ts),
    buildInsertStmt(db, companyId, 'purchaseRequests', generateId(), userUid, {
      number: 'DA-2026-0002',
      requesterName: 'Claire Ngo',
      departmentName: 'Finance & Comptabilité',
      date: isoDaysAgo(2),
      status: 'en_attente',
      lines: [
        {
          productId: prodPrinterId,
          sku: 'SKU-BUR-004',
          name: 'Imprimante Multifonction Laser Pro',
          qty: 2,
          unitPrice: 155000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 369775,
        },
      ],
      estimatedTotal: 369775,
      notes: 'Besoin équipement nouveau bureau comptable.',
    }, ts)
  );

  const po1Id = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'purchaseOrders', po1Id, userUid, {
      number: 'PO-2026-0001',
      supplierId: sup1Id,
      supplierName: 'TechImport Grossiste CEMAC',
      warehouseId: whCentralId,
      date: isoDaysAgo(14),
      expectedDate: isoDaysAgo(12),
      status: 'facturee',
      lines: [
        {
          productId: prodMonitorId,
          sku: 'SKU-IT-002',
          name: 'Écran LED IPS 24" Full HD',
          qty: 10,
          unitPrice: 82000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 977850,
        },
      ],
      subtotal: 820000,
      taxTotal: 157850,
      total: 977850,
      receivedAt: isoDaysAgo(12),
      notes: 'Marchandise réceptionnée et contrôlée conforme.',
    }, ts),
    buildInsertStmt(db, companyId, 'purchaseOrders', generateId(), userUid, {
      number: 'PO-2026-0002',
      supplierId: sup2Id,
      supplierName: 'Papeterie & Mobilier Pro',
      warehouseId: whCentralId,
      date: isoDaysAgo(3),
      expectedDate: isoDaysFromNow(4),
      status: 'envoyee',
      lines: [
        {
          productId: prodPrinterId,
          sku: 'SKU-BUR-004',
          name: 'Imprimante Multifonction Laser Pro',
          qty: 3,
          unitPrice: 155000,
          discountPct: 0,
          taxRate: 19.25,
          lineTotal: 554512.5,
        },
      ],
      subtotal: 465000,
      taxTotal: 89512.5,
      total: 554512.5,
      notes: 'Livraison attendue cette semaine.',
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'supplierInvoices', generateId(), userUid, {
      number: 'FFR-2026-0001',
      purchaseOrderId: po1Id,
      supplierId: sup1Id,
      supplierName: 'TechImport Grossiste CEMAC',
      date: isoDaysAgo(12),
      dueDate: isoDaysFromNow(18),
      status: 'en_attente',
      total: 960000,
      paidAmount: 0,
      balanceDue: 960000,
    }, ts),
    buildInsertStmt(db, companyId, 'supplierInvoices', generateId(), userUid, {
      number: 'FFR-2026-0002',
      supplierId: sup2Id,
      supplierName: 'Papeterie & Mobilier Pro',
      date: isoDaysAgo(18),
      dueDate: isoDaysAgo(3),
      status: 'payee',
      total: 420000,
      paidAmount: 420000,
      balanceDue: 0,
    }, ts)
  );

  // 8. Treasury Accounts & Payments
  const bankId = generateId();
  const cashId = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'treasuryAccounts', bankId, userUid, {
      name: 'Compte Bancaire Principal',
      type: 'banque',
      bankName: 'Afriland First Bank',
      iban: 'CM21 10005 00001 04589210112 88',
      accountCode: '521',
      balance: 4850000,
      currency,
    }, ts),
    buildInsertStmt(db, companyId, 'treasuryAccounts', cashId, userUid, {
      name: 'Caisse Principale Siège',
      type: 'caisse',
      bankName: 'Caisse interne',
      iban: '',
      accountCode: '571',
      balance: 640000,
      currency,
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'payments', generateId(), userUid, {
      number: 'ENC-2026-0001',
      direction: 'encaissement',
      partnerType: 'client',
      partnerId: cust1Id,
      partnerName: 'Groupe Sitracel SA',
      invoiceId: inv1Id,
      invoiceNumber: 'FAC-2026-0001',
      treasuryAccountId: bankId,
      treasuryAccountName: 'Compte Bancaire Principal',
      method: 'virement',
      amount: 1156725,
      date: isoDaysAgo(6),
      reference: 'VIR-AFB-88412',
      note: 'Règlement complet facture FAC-2026-0001',
    }, ts),
    buildInsertStmt(db, companyId, 'payments', generateId(), userUid, {
      number: 'ENC-2026-0002',
      direction: 'encaissement',
      partnerType: 'client',
      partnerId: cust2Id,
      partnerName: 'Société Atlantique BTP',
      invoiceId: inv2Id,
      invoiceNumber: 'FAC-2026-0002',
      treasuryAccountId: cashId,
      treasuryAccountName: 'Caisse Principale Siège',
      method: 'mobile_money',
      amount: 490500,
      date: isoDaysAgo(3),
      reference: 'MOMO-449012',
      note: 'Acompte sur facture FAC-2026-0002',
    }, ts),
    buildInsertStmt(db, companyId, 'payments', generateId(), userUid, {
      number: 'DEC-2026-0001',
      direction: 'decaissement',
      partnerType: 'fournisseur',
      partnerId: sup2Id,
      partnerName: 'Papeterie & Mobilier Pro',
      treasuryAccountId: bankId,
      treasuryAccountName: 'Compte Bancaire Principal',
      method: 'cheque',
      amount: 420000,
      date: isoDaysAgo(10),
      reference: 'CHQ-00491',
      note: 'Règlement facture fournisseur FFR-2026-0002',
    }, ts)
  );

  // 9. Accounting: OHADA Plan + Balanced Journal Entries
  for (const acc of OHADA_ACCOUNTS) {
    stmts.push(
      buildInsertStmt(db, companyId, 'accounts', generateId(), userUid, {
        code: acc.code,
        name: acc.name,
        classNumber: acc.classNumber,
        type: acc.type,
        balanceDebit: acc.debit,
        balanceCredit: acc.credit,
        isSystem: true,
      }, ts)
    );
  }

  stmts.push(
    buildInsertStmt(db, companyId, 'journalEntries', generateId(), userUid, {
      number: 'VE-2026-0001',
      date: isoDaysAgo(7),
      journalCode: 'VE',
      reference: 'FAC-2026-0001',
      label: 'Facture client FAC-2026-0001 - Groupe Sitracel SA',
      lines: [
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: 1156725, credit: 0 },
        { accountCode: '701', accountName: 'Ventes de marchandises', debit: 0, credit: 970000 },
        { accountCode: '443', accountName: 'État, TVA facturée (collectée)', debit: 0, credit: 186725 },
      ],
      totalDebit: 1156725,
      totalCredit: 1156725,
      sourceModule: 'sales',
      sourceId: inv1Id,
      status: 'validee',
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'journalEntries', generateId(), userUid, {
      number: 'BQ-2026-0001',
      date: isoDaysAgo(6),
      journalCode: 'BQ',
      reference: 'ENC-2026-0001',
      label: 'Encaissement FAC-2026-0001 - Groupe Sitracel SA',
      lines: [
        { accountCode: '521', accountName: 'Banques locales', debit: 1156725, credit: 0 },
        { accountCode: '411', accountName: 'Clients, créances en compte', debit: 0, credit: 1156725 },
      ],
      totalDebit: 1156725,
      totalCredit: 1156725,
      sourceModule: 'treasury',
      status: 'validee',
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'journalEntries', generateId(), userUid, {
      number: 'AC-2026-0001',
      date: isoDaysAgo(12),
      journalCode: 'AC',
      reference: 'FFR-2026-0001',
      label: 'Facture fournisseur FFR-2026-0001 - TechImport Grossiste CEMAC',
      lines: [
        { accountCode: '601', accountName: 'Achats de marchandises', debit: 805000, credit: 0 },
        { accountCode: '445', accountName: 'État, TVA récupérable', debit: 155000, credit: 0 },
        { accountCode: '401', accountName: 'Fournisseurs, dettes en compte', debit: 0, credit: 960000 },
      ],
      totalDebit: 960000,
      totalCredit: 960000,
      sourceModule: 'purchases',
      status: 'validee',
      authorEmail: userEmail,
    }, ts),
    buildInsertStmt(db, companyId, 'journalEntries', generateId(), userUid, {
      number: 'OD-2026-0001',
      date: isoDaysAgo(15),
      journalCode: 'OD',
      reference: 'PAIE-2026-02',
      label: 'Centralisation paie du personnel',
      lines: [
        { accountCode: '661', accountName: 'Rémunérations directes versées au personnel', debit: 680000, credit: 0 },
        { accountCode: '521', accountName: 'Banques locales', debit: 0, credit: 680000 },
      ],
      totalDebit: 680000,
      totalCredit: 680000,
      sourceModule: 'hr',
      status: 'validee',
      authorEmail: userEmail,
    }, ts)
  );

  // 10. HR: Employees, Leaves, Payrolls
  const emp1Id = generateId();
  const emp2Id = generateId();
  const emp3Id = generateId();
  stmts.push(
    buildInsertStmt(db, companyId, 'employees', emp1Id, userUid, {
      matricule: 'EMP-001',
      firstName: 'Jean-Paul',
      lastName: 'Mbarga',
      email: 'jp.mbarga@jessi-demo.cm',
      phone: '+237 699 10 20 30',
      departmentName: 'Ventes & CRM',
      position: 'Directeur Commercial',
      contractType: 'CDI',
      hireDate: '2024-03-01',
      baseSalary: 450000,
      status: 'actif',
    }, ts),
    buildInsertStmt(db, companyId, 'employees', emp2Id, userUid, {
      matricule: 'EMP-002',
      firstName: 'Claire',
      lastName: 'Ngo',
      email: 'c.ngo@jessi-demo.cm',
      phone: '+237 677 40 50 60',
      departmentName: 'Finance & Comptabilité',
      position: 'Chef Comptable OHADA',
      contractType: 'CDI',
      hireDate: '2023-09-15',
      baseSalary: 420000,
      status: 'actif',
    }, ts),
    buildInsertStmt(db, companyId, 'employees', emp3Id, userUid, {
      matricule: 'EMP-003',
      firstName: 'Brice',
      lastName: 'Tchoupo',
      email: 'b.tchoupo@jessi-demo.cm',
      phone: '+237 655 70 80 90',
      departmentName: 'Logistique & Stocks',
      position: 'Responsable Logistique',
      contractType: 'CDD',
      hireDate: '2025-01-10',
      baseSalary: 280000,
      status: 'actif',
    }, ts)
  );

  stmts.push(
    buildInsertStmt(db, companyId, 'leaves', generateId(), userUid, {
      employeeId: emp1Id,
      employeeName: 'Jean-Paul Mbarga',
      type: 'conge_paye',
      startDate: isoDaysFromNow(14),
      endDate: isoDaysFromNow(21),
      days: 7,
      reason: 'Congé annuel planifié',
      status: 'approuve',
    }, ts),
    buildInsertStmt(db, companyId, 'leaves', generateId(), userUid, {
      employeeId: emp3Id,
      employeeName: 'Brice Tchoupo',
      type: 'exceptionnel',
      startDate: isoDaysFromNow(5),
      endDate: isoDaysFromNow(6),
      days: 2,
      reason: 'Démarche administrative personnelle',
      status: 'en_attente',
    }, ts)
  );

  const currentPeriod = new Date().toISOString().slice(0, 7);
  stmts.push(
    buildInsertStmt(db, companyId, 'payrolls', generateId(), userUid, {
      period: currentPeriod,
      employeeId: emp1Id,
      employeeName: 'Jean-Paul Mbarga',
      departmentName: 'Ventes & CRM',
      baseSalary: 450000,
      bonuses: 75000,
      deductions: 45000,
      netSalary: 480000,
      status: 'payee',
      paidAt: isoDaysAgo(5),
    }, ts),
    buildInsertStmt(db, companyId, 'payrolls', generateId(), userUid, {
      period: currentPeriod,
      employeeId: emp2Id,
      employeeName: 'Claire Ngo',
      departmentName: 'Finance & Comptabilité',
      baseSalary: 420000,
      bonuses: 50000,
      deductions: 40000,
      netSalary: 430000,
      status: 'validee',
    }, ts)
  );

  // 11. Custom Modules + records
  const customTransitId = 'cust_demo_transit';
  const customChantierId = 'cust_demo_chantier';
  stmts.push(
    buildInsertStmt(db, companyId, 'customModules', customTransitId, userUid, {
      code: 'TRANSIT',
      name: 'Transit & Dédouanement',
      category: 'Achats & Logistique',
      description: 'Suivi des connaissements maritimes, déclarations douanières et frais portuaires.',
      iconName: 'Layers',
      accentColor: '#0891B2',
      active: true,
    }, ts),
    buildInsertStmt(db, companyId, 'customModules', customChantierId, userUid, {
      code: 'CHANTIER',
      name: 'Suivi Chantiers & Travaux',
      category: 'Opérations & Projets',
      description: 'Suivi des lots de travaux, décomptes mensuels et avancement sur site.',
      iconName: 'Layers',
      accentColor: '#FC3F1D',
      active: true,
    }, ts)
  );

  // 12. Specialized Module Records for ALL 34 dynamic_module catalog modules + 2 custom modules
  for (const modSeed of SPECIALIZED_MODULE_SEEDS) {
    for (const item of modSeed.items) {
      stmts.push(
        buildInsertStmt(db, companyId, 'moduleRecords', generateId(), userUid, {
          moduleId: modSeed.moduleId,
          title: item.title,
          reference: item.reference,
          partnerName: item.partnerName,
          category: item.category,
          amount: item.amount,
          quantity: item.quantity,
          status: item.status,
          date: isoDaysAgo(item.daysAgo),
          notes: item.notes,
        }, ts)
      );
    }
  }

  // Also add records for the 2 demo custom modules
  stmts.push(
    buildInsertStmt(db, companyId, 'moduleRecords', generateId(), userUid, {
      moduleId: customTransitId,
      title: 'Dossier Conteneur 40" Port de Douala',
      reference: 'TR-2026-019',
      partnerName: 'Port Autonome de Douala',
      category: 'Import Maritime',
      amount: 1850000,
      quantity: 1,
      status: 'en_cours',
      date: isoDaysAgo(2),
      notes: 'Déclaration en douane validée, sortie quai programmée.',
    }, ts),
    buildInsertStmt(db, companyId, 'moduleRecords', generateId(), userUid, {
      moduleId: customChantierId,
      title: 'Aménagement Bureaux Agence Bonapriso',
      reference: 'CH-2026-004',
      partnerName: 'Société Atlantique BTP',
      category: 'Second Oeuvre',
      amount: 4200000,
      quantity: 85,
      status: 'en_cours',
      date: isoDaysAgo(4),
      notes: 'Câblage réseau et faux plafonds achevés à 85%.',
    }, ts)
  );

  // 13. Notifications & Audit Logs
  stmts.push(
    buildInsertStmt(db, companyId, 'notifications', generateId(), userUid, {
      title: 'Alerte Stock Minimum',
      message: 'Onduleur APC Smart 1500VA (SKU-NRJ-003) : stock restant 3 <= seuil 5.',
      severity: 'warning',
      module: 'inventory',
      read: false,
    }, ts),
    buildInsertStmt(db, companyId, 'notifications', generateId(), userUid, {
      title: 'Espace Démo JESSI prêt',
      message: 'Les 66 modules métiers sont pré-remplis pour vos tests et démonstrations.',
      severity: 'success',
      module: 'launcher',
      read: false,
    }, ts),
    buildInsertStmt(db, companyId, 'auditLogs', generateId(), userUid, {
      userId: userUid,
      userEmail: userEmail,
      action: 'CREATE_DEMO_SPACE',
      module: 'admin',
      entityType: 'company',
      entityId: companyId,
      summary: 'Initialisation de l’espace de démonstration JESSI avec données sur les 66 modules.',
    }, ts)
  );

  // Execute in chunks of 50 statements to stay well within Cloudflare D1 batch limits
  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  return companyId;
}
