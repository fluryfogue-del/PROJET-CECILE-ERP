import React, { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Building2, ShieldAlert, Lock, KeyRound, Upload, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { downloadJsonFile, exportWorkbookExcel } from '../../lib/exports';
import { formatMoney, todayIso } from '../../lib/format';
import { ImportSpreadsheetModal } from '../ImportSpreadsheetModal';
import {
  isNonEmptyText,
  validateWorkspacePasswordPair,
} from '../../lib/security';
import {
  ALL_MODULES,
  addWorkspaceMember,
  createErpDoc,
  deleteErpDoc,
  exportCompanyBackup,
  purgeDemoData,
  updateErpDoc,
  updateWorkspacePassword,
  updateWorkspaceSettings,
} from '../../services/erpEngine';
import { AccountingStandard, CurrencyCode, RoleCode } from '../../types/erp';
import {
  Modal,
  PageHeader,
  SegmentedTabs,
  StatusLabel,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
} from '../ui/DataUI';

export const AdminView: React.FC = () => {
  const {
    user,
    activeCompany,
    setCreateWorkspaceOpen,
    members,
    roles,
    departments,
    auditLogs,
    products,
    customers,
    leads,
    suppliers,
    employees,
    invoices,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'company' | 'members' | 'roles' | 'departments' | 'audit' | 'backup'>('company');
  const [importOpen, setImportOpen] = useState(false);

  // Company Settings Form
  const [compName, setCompName] = useState(activeCompany?.name || '');
  const [ownerLastName, setOwnerLastName] = useState(activeCompany?.ownerLastName || '');
  const [ownerFirstName, setOwnerFirstName] = useState(activeCompany?.ownerFirstName || '');
  const [compSector, setCompSector] = useState(activeCompany?.sector || '');
  const [compCity, setCompCity] = useState(activeCompany?.city || '');
  const [compTaxId, setCompTaxId] = useState(activeCompany?.taxId || '');
  const [compRccm, setCompRccm] = useState(activeCompany?.rccm || '');
  const [compAddress, setCompAddress] = useState(activeCompany?.address || '');
  const [compPhone, setCompPhone] = useState(activeCompany?.phone || '');
  const [compCurrency, setCompCurrency] = useState<CurrencyCode>(activeCompany?.currency || 'XAF');
  const [compStandard, setCompStandard] = useState<AccountingStandard>(activeCompany?.accountingStandard || 'OHADA');
  const [invoicePrefix, setInvoicePrefix] = useState(activeCompany?.invoicePrefix || 'FAC');
  const [invoicePaymentTerms, setInvoicePaymentTerms] = useState(
    activeCompany?.invoicePaymentTerms || 'Paiement à 30 jours net'
  );
  const [invoiceNotesDefault, setInvoiceNotesDefault] = useState(
    activeCompany?.invoiceNotesDefault || ''
  );

  // Workspace Password Update Form
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    if (!activeCompany) return;
    setCompName(activeCompany.name || '');
    setOwnerLastName(activeCompany.ownerLastName || '');
    setOwnerFirstName(activeCompany.ownerFirstName || '');
    setCompSector(activeCompany.sector || '');
    setCompCity(activeCompany.city || '');
    setCompTaxId(activeCompany.taxId || '');
    setCompRccm(activeCompany.rccm || '');
    setCompAddress(activeCompany.address || '');
    setCompPhone(activeCompany.phone || '');
    setCompCurrency(activeCompany.currency || 'XAF');
    setCompStandard(activeCompany.accountingStandard || 'OHADA');
    setInvoicePrefix(activeCompany.invoicePrefix || 'FAC');
    setInvoicePaymentTerms(activeCompany.invoicePaymentTerms || 'Paiement à 30 jours net');
    setInvoiceNotesDefault(activeCompany.invoiceNotesDefault || '');
  }, [activeCompany]);

  // Member Modal
  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    email: '',
    displayName: '',
    roleCode: 'commercial' as RoleCode,
    departmentName: 'Ventes & CRM',
  });

  // Department Modal
  const [deptModal, setDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ code: '', name: '', managerName: '', budget: 0 });
  const [busy, setBusy] = useState(false);

  if (!activeCompany || !user) return null;
  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const saveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNonEmptyText(compName, 2)) {
      notify('Le nom ou la raison sociale ne peut pas être vide.', 'error');
      return;
    }
    if (!isNonEmptyText(compPhone, 6)) {
      notify('Un numéro de téléphone valide est obligatoire.', 'error');
      return;
    }
    if (!isNonEmptyText(compAddress, 3)) {
      notify('L’adresse ne peut pas être vide.', 'error');
      return;
    }
    try {
      await updateWorkspaceSettings(activeCompany.id, {
        name: compName.trim(),
        ownerLastName: ownerLastName.trim(),
        ownerFirstName: ownerFirstName.trim(),
        sector: compSector.trim(),
        city: compCity.trim(),
        taxId: compTaxId.trim(),
        rccm: compRccm.trim(),
        address: compAddress.trim(),
        phone: compPhone.trim(),
        currency: compCurrency,
        accountingStandard: compStandard,
        invoicePrefix: invoicePrefix.trim().toUpperCase() || 'FAC',
        invoicePaymentTerms: invoicePaymentTerms.trim(),
        invoiceNotesDefault: invoiceNotesDefault.trim(),
      });
      notify('Paramètres et modèle de facture enregistrés.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur paramètres', 'error');
    }
  };

  const handleUpdateWorkspacePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasExistingPwd = activeCompany.hasPassword ?? Boolean(activeCompany.passwordHash);
    if (hasExistingPwd && !isNonEmptyText(currentPwd)) {
      notify('Veuillez saisir le mot de passe actuel de l’espace.', 'error');
      return;
    }
    const pairErr = validateWorkspacePasswordPair(newPwd, confirmPwd);
    if (pairErr) {
      notify(pairErr, 'error');
      return;
    }
    setPwdBusy(true);
    try {
      await updateWorkspacePassword(activeCompany.id, currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      notify('Mot de passe de l’espace mis à jour avec succès.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur mot de passe', 'error');
    } finally {
      setPwdBusy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.email.trim()) return;
    try {
      await addWorkspaceMember(activeCompany.id, {
        email: memberForm.email.trim(),
        displayName: memberForm.displayName.trim(),
        roleCode: memberForm.roleCode,
        departmentName: memberForm.departmentName,
      });
      notify('Utilisateur ajouté à l’espace.', 'success');
      setMemberModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur ajout utilisateur', 'error');
    }
  };

  const handleBackup = async () => {
    setBusy(true);
    try {
      const data = await exportCompanyBackup(activeCompany.id, user.uid);
      downloadJsonFile(data, `Backup_${activeCompany.name.replace(/\s+/g, '_')}_${todayIso()}`);
      notify('Sauvegarde JSON téléchargée.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur sauvegarde', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleGlobalExcelExport = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Articles & Stocks',
          rows: products.map((p) => ({
            SKU: p.sku,
            Designation: p.name,
            Categorie: p.categoryName || 'Général',
            PrixAchat: p.purchasePrice,
            PrixVente: p.salePrice,
            Stock: p.stockQty,
          })),
        },
        {
          name: 'Clients',
          rows: customers.map((c) => ({
            Code: c.code,
            Nom: c.name,
            Segment: c.segment,
            Email: c.email || '',
            Telephone: c.phone || '',
            SoldeDu: c.balanceDue || 0,
          })),
        },
        {
          name: 'Prospects',
          rows: leads.map((l) => ({
            Nom: l.name,
            Entreprise: l.companyName || '',
            Email: l.email || '',
            Telephone: l.phone || '',
            Statut: l.status,
            ValeurEstimee: l.estimatedValue,
          })),
        },
        {
          name: 'Fournisseurs',
          rows: suppliers.map((s) => ({
            Code: s.code,
            Nom: s.name,
            Email: s.email || '',
            Telephone: s.phone || '',
            Dette: s.balancePayable,
          })),
        },
        {
          name: 'Employes',
          rows: employees.map((e) => ({
            Matricule: e.matricule,
            Prenom: e.firstName,
            Nom: e.lastName,
            Departement: e.departmentName,
            Poste: e.position,
            SalaireBase: e.baseSalary,
          })),
        },
        {
          name: 'Factures',
          rows: invoices.map((i) => ({
            Numero: i.number,
            Client: i.customerName,
            Date: i.date,
            TotalTTC: i.total,
            Paye: i.paidAmount,
            Statut: i.status,
          })),
        },
      ],
      `Export_Global_${activeCompany.name.replace(/\s+/g, '_')}_${todayIso()}`
    );
    notify('Classeur Excel complet téléchargé.', 'success');
  };

  const handlePurgeDemo = async () => {
    setBusy(true);
    try {
      const count = await purgeDemoData({
        companyId: activeCompany.id,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`${count} enregistrements de démonstration supprimés.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur suppression démo', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration, Sécurité & Multi-Espace"
        subtitle="Utilisateurs, rôles RBAC, départements, sécurité par mot de passe, journal d’audit et sauvegarde"
        actions={
          <button type="button" onClick={() => setCreateWorkspaceOpen(true)} className={btnPrimaryCls}>
            <Building2 className="w-3.5 h-3.5" /> Nouvel espace
          </button>
        }
      />

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'company', label: 'Paramètres & Sécurité' },
          { id: 'members', label: 'Utilisateurs', count: members.length },
          { id: 'roles', label: 'Rôles & Permissions', count: roles.length },
          { id: 'departments', label: 'Départements', count: departments.length },
          { id: 'audit', label: 'Journal d’audit', count: auditLogs.length },
          { id: 'backup', label: 'Import / Export & Sauvegarde' },
        ]}
      />

      {tab === 'company' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form onSubmit={saveCompanySettings} className="xl:col-span-2 bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
              Informations de l’espace & du responsable
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nom / Raison sociale *</label>
                <input required className={inputCls} value={compName} onChange={(e) => setCompName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Secteur / Activité</label>
                <input className={inputCls} value={compSector} onChange={(e) => setCompSector(e.target.value)} placeholder="Commerce, Services, Industrie..." />
              </div>
              <div>
                <label className={labelCls}>Nom du responsable</label>
                <input className={inputCls} value={ownerLastName} onChange={(e) => setOwnerLastName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prénoms du responsable</label>
                <input className={inputCls} value={ownerFirstName} onChange={(e) => setOwnerFirstName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Devise principale</label>
                <select className={inputCls} value={compCurrency} onChange={(e) => setCompCurrency(e.target.value as CurrencyCode)}>
                  <option value="XAF">XAF (Franc CFA BEAC)</option>
                  <option value="XOF">XOF (Franc CFA BCEAO)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="USD">USD (Dollar US)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Référentiel comptable</label>
                <select className={inputCls} value={compStandard} onChange={(e) => setCompStandard(e.target.value as AccountingStandard)}>
                  <option value="OHADA">Système Comptable OHADA (SYSCOHADA)</option>
                  <option value="GENERAL">Plan Comptable Général</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>NIF / CNI</label>
                <input className={inputCls} value={compTaxId} onChange={(e) => setCompTaxId(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>RCCM / Registre</label>
                <input className={inputCls} value={compRccm} onChange={(e) => setCompRccm(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Téléphone *</label>
                <input required className={inputCls} value={compPhone} onChange={(e) => setCompPhone(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ville / Pays</label>
                <input className={inputCls} value={compCity} onChange={(e) => setCompCity(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Adresse physique *</label>
                <input required className={inputCls} value={compAddress} onChange={(e) => setCompAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Préfixe de facturation</label>
                <input className={inputCls} value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} placeholder="FAC" maxLength={8} />
              </div>
              <div>
                <label className={labelCls}>Conditions de paiement par défaut</label>
                <input className={inputCls} value={invoicePaymentTerms} onChange={(e) => setInvoicePaymentTerms(e.target.value)} placeholder="Paiement à 30 jours net" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Mentions légales / Pied de facture</label>
                <input className={inputCls} value={invoiceNotesDefault} onChange={(e) => setInvoiceNotesDefault(e.target.value)} placeholder="Règlement par virement bancaire, chèque ou Mobile Money." />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className={btnPrimaryCls}>Enregistrer les paramètres</button>
            </div>
          </form>

          <form onSubmit={handleUpdateWorkspacePassword} className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FC3F1D]/10 text-[#FC3F1D] flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Sécurité de l’espace
                </h3>
                <p className="text-[11px] text-slate-500">Protection PBKDF2 des métriques</p>
              </div>
            </div>
            {(activeCompany.hasPassword ?? Boolean(activeCompany.passwordHash)) && (
              <div>
                <label className={labelCls}>Mot de passe actuel *</label>
                <input
                  type="password"
                  required
                  className={inputCls}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Mot de passe actuel"
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Nouveau mot de passe *</label>
              <input
                type="password"
                required
                className={inputCls}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Minimum 4 caractères"
              />
            </div>
            <div>
              <label className={labelCls}>Confirmer le mot de passe *</label>
              <input
                type="password"
                required
                className={inputCls}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Confirmer"
              />
            </div>
            <button type="submit" disabled={pwdBusy} className={`${btnPrimaryCls} w-full justify-center`}>
              <KeyRound className="w-3.5 h-3.5" />
              {pwdBusy ? 'Chiffrement...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setMemberModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Ajouter un utilisateur
            </button>
          </div>
          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Utilisateur</th>
                  <th className="py-3 px-4 font-medium">Rôle</th>
                  <th className="py-3 px-4 font-medium">Département</th>
                  <th className="py-3 px-4 font-medium">Droits</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold">{m.displayName}</p>
                      <p className="text-slate-400">{m.email}</p>
                    </td>
                    <td className="py-3 px-4"><StatusLabel label={m.roleCode} tone="info" /></td>
                    <td className="py-3 px-4">{m.departmentName || '-'}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {[m.canWrite && 'Écriture', m.canValidate && 'Validation', m.canDelete && 'Suppression'].filter(Boolean).join(' · ') || 'Lecture'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => updateErpDoc(activeCompany.id, 'members', m.id, { active: !m.active })}
                        className="text-xs font-medium text-[#FC3F1D] hover:underline"
                      >
                        {m.active ? 'Actif (désactiver)' : 'Inactif (activer)'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roles.map((r) => (
            <div key={r.id} className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-semibold text-sm">{r.name}</span>
                <StatusLabel label={r.code} tone="info" />
              </div>
              <p className="text-xs text-slate-500">{r.description}</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Modules : {r.allowedModules.length === ALL_MODULES.length ? 'Tous les modules' : r.allowedModules.join(', ')}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setDeptModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouveau département
            </button>
          </div>
          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Département</th>
                  <th className="py-3 px-4 font-medium">Responsable</th>
                  <th className="py-3 px-4 font-medium text-right">Budget annuel</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-mono">{d.code}</td>
                    <td className="py-3 px-4 font-semibold">{d.name}</td>
                    <td className="py-3 px-4">{d.managerName || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatMoney(d.budget || 0, activeCompany.currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'departments', d.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Action</th>
                <th className="py-3 px-4 font-medium">Module</th>
                <th className="py-3 px-4 font-medium">Opérateur</th>
                <th className="py-3 px-4 font-medium">Détail de l’opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 font-mono font-semibold">{log.action}</td>
                  <td className="py-2.5 px-4"><StatusLabel label={log.module} tone="neutral" /></td>
                  <td className="py-2.5 px-4 text-slate-500">{log.userEmail}</td>
                  <td className="py-2.5 px-4">{log.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
            <h3 className="font-display font-semibold text-sm">Import & Export CSV / Excel</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Importez vos articles, clients, prospects, fournisseurs, employés ou comptes OHADA depuis CSV ou Excel, ou exportez tout votre espace vers un classeur multi-onglets.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setImportOpen(true)} className={btnPrimaryCls}>
                <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
              </button>
              <button type="button" onClick={handleGlobalExcelExport} className={btnSecondaryCls}>
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel global
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
            <h3 className="font-display font-semibold text-sm">Sauvegarde complète de la base de données</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Exportez l’intégralité des collections de l’entreprise active (clients, factures, stocks, comptabilité, RH, journaux d’audit) au format JSON structuré.
            </p>
            <button type="button" disabled={busy} onClick={handleBackup} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> Télécharger la sauvegarde JSON
            </button>
          </div>

          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="w-4 h-4" />
              <h3 className="font-display font-semibold text-sm">Gestion des données de démonstration</h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Toutes les données de démonstration sont marquées <code className="font-mono">isDemo: true</code>. Vous pouvez les purger définitivement pour passer en production réelle.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={handlePurgeDemo}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purger les données démo
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal open={memberModal} title="Ajouter un membre à l’espace" onClose={() => setMemberModal(false)} maxWidth="max-w-md">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className={labelCls}>Adresse e-mail du compte FUREX ERP *</label>
            <input type="email" required className={inputCls} value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="collaborateur@entreprise.com" />
          </div>
          <div>
            <label className={labelCls}>Nom complet (optionnel)</label>
            <input className={inputCls} value={memberForm.displayName} onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })} placeholder="Ex: Claire Mbarga" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Rôle</label>
              <select className={inputCls} value={memberForm.roleCode} onChange={(e) => setMemberForm({ ...memberForm, roleCode: e.target.value as RoleCode })}>
                <option value="admin">Administrateur</option>
                <option value="direction">Direction</option>
                <option value="commercial">Commercial</option>
                <option value="comptable">Comptable</option>
                <option value="magasinier">Magasinier</option>
                <option value="rh">RH</option>
                <option value="lecture">Lecture seule</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Département</label>
              <input className={inputCls} value={memberForm.departmentName} onChange={(e) => setMemberForm({ ...memberForm, departmentName: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMemberModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Ajouter</button>
          </div>
        </form>
      </Modal>

      {/* Department Modal */}
      <Modal open={deptModal} title="Nouveau département" onClose={() => setDeptModal(false)} maxWidth="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createErpDoc(activeCompany.id, 'departments', { ...deptForm, budget: Number(deptForm.budget), isDemo: false }, ownerId, memberUids);
            notify('Département créé.', 'success');
            setDeptModal(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Code *</label>
              <input required className={inputCls} value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="IT" />
            </div>
            <div>
              <label className={labelCls}>Budget annuel</label>
              <input type="number" min="0" className={inputCls} value={deptForm.budget} onChange={(e) => setDeptForm({ ...deptForm, budget: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Nom du département *</label>
            <input required className={inputCls} value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Responsable</label>
            <input className={inputCls} value={deptForm.managerName} onChange={(e) => setDeptForm({ ...deptForm, managerName: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDeptModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Créer</button>
          </div>
        </form>
      </Modal>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="products"
        allowTargetSwitch
      />
    </div>
  );
};
