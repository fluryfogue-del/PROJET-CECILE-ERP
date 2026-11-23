import React, { useEffect, useState } from 'react';
import { Plus, Download, Trash2, Building2, ShieldAlert } from 'lucide-react';
import { doc, serverTimestamp, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useErp } from '../../contexts/ErpContext';
import { db } from '../../lib/firebase';
import { downloadJsonFile } from '../../lib/exports';
import { formatMoney, todayIso } from '../../lib/format';
import {
  ALL_MODULES,
  createCompanyWorkspace,
  createErpDoc,
  deleteErpDoc,
  exportCompanyBackup,
  logAudit,
  purgeDemoData,
  updateErpDoc,
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
    setActiveCompanyId,
    members,
    roles,
    departments,
    auditLogs,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'company' | 'members' | 'roles' | 'departments' | 'audit' | 'backup'>('company');

  // Company Settings Form
  const [compName, setCompName] = useState(activeCompany?.name || '');
  const [compTaxId, setCompTaxId] = useState(activeCompany?.taxId || '');
  const [compRccm, setCompRccm] = useState(activeCompany?.rccm || '');
  const [compAddress, setCompAddress] = useState(activeCompany?.address || '');
  const [compPhone, setCompPhone] = useState(activeCompany?.phone || '');
  const [compCurrency, setCompCurrency] = useState<CurrencyCode>(activeCompany?.currency || 'XAF');
  const [compStandard, setCompStandard] = useState<AccountingStandard>(activeCompany?.accountingStandard || 'OHADA');

  useEffect(() => {
    if (!activeCompany) return;
    setCompName(activeCompany.name || '');
    setCompTaxId(activeCompany.taxId || '');
    setCompRccm(activeCompany.rccm || '');
    setCompAddress(activeCompany.address || '');
    setCompPhone(activeCompany.phone || '');
    setCompCurrency(activeCompany.currency || 'XAF');
    setCompStandard(activeCompany.accountingStandard || 'OHADA');
  }, [activeCompany]);

  // New Company Modal (Multi-company)
  const [newCompModal, setNewCompModal] = useState(false);
  const [newCompForm, setNewCompForm] = useState({
    name: '',
    currency: 'XAF' as CurrencyCode,
    accountingStandard: 'OHADA' as AccountingStandard,
    withDemoData: false,
  });

  // Member Modal
  const [memberModal, setMemberModal] = useState(false);
  const [memberForm, setMemberForm] = useState({
    uid: '',
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
    try {
      await updateDoc(doc(db, 'companies', activeCompany.id), {
        name: compName,
        taxId: compTaxId,
        rccm: compRccm,
        address: compAddress,
        phone: compPhone,
        currency: compCurrency,
        accountingStandard: compStandard,
        updatedAt: serverTimestamp(),
      });
      await logAudit({
        companyId: activeCompany.id,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
        action: 'UPDATE_SETTINGS',
        module: 'admin',
        summary: `Mise à jour des paramètres généraux de ${compName}.`,
      });
      notify('Paramètres de l’entreprise enregistrés.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur paramètres', 'error');
    }
  };

  const handleCreateNewCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const id = await createCompanyWorkspace({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Administrateur',
        name: newCompForm.name,
        currency: newCompForm.currency,
        accountingStandard: newCompForm.accountingStandard,
        withDemoData: newCompForm.withDemoData,
      });
      setActiveCompanyId(id);
      setNewCompModal(false);
      notify(`Société "${newCompForm.name}" créée et activée.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur création société', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const roleDef = roles.find((r) => r.code === memberForm.roleCode);
    const targetUid = memberForm.uid.trim();
    if (!targetUid) return;
    try {
      const updatedMemberUids = Array.from(new Set([...memberUids, targetUid]));
      await updateDoc(doc(db, 'companies', activeCompany.id), {
        memberUids: arrayUnion(targetUid),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, `companies/${activeCompany.id}/members/${targetUid}`), {
        uid: targetUid,
        email: memberForm.email.trim(),
        displayName: memberForm.displayName.trim(),
        roleCode: memberForm.roleCode,
        departmentName: memberForm.departmentName,
        allowedModules: roleDef?.allowedModules || ['dashboard', 'crm', 'sales'],
        canWrite: roleDef?.canWrite ?? true,
        canValidate: roleDef?.canValidate ?? false,
        canDelete: roleDef?.canDelete ?? false,
        active: true,
        ownerId,
        memberUids: updatedMemberUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('Utilisateur ajouté à la société.', 'success');
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
        title="Administration, Sécurité & Multi-Société"
        subtitle="Utilisateurs, rôles RBAC, départements, paramètres entreprise, journal d’audit et sauvegarde"
        actions={
          <button type="button" onClick={() => setNewCompModal(true)} className={btnPrimaryCls}>
            <Building2 className="w-3.5 h-3.5" /> Nouvelle société
          </button>
        }
      />

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'company', label: 'Paramètres Société' },
          { id: 'members', label: 'Utilisateurs', count: members.length },
          { id: 'roles', label: 'Rôles & Permissions', count: roles.length },
          { id: 'departments', label: 'Départements', count: departments.length },
          { id: 'audit', label: 'Journal d’audit', count: auditLogs.length },
          { id: 'backup', label: 'Sauvegarde & Démo' },
        ]}
      />

      {tab === 'company' && (
        <form onSubmit={saveCompanySettings} className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Raison sociale *</label>
              <input required className={inputCls} value={compName} onChange={(e) => setCompName(e.target.value)} />
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
              <label className={labelCls}>NIF / Identifiant Fiscal</label>
              <input className={inputCls} value={compTaxId} onChange={(e) => setCompTaxId(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>RCCM / Registre de commerce</label>
              <input className={inputCls} value={compRccm} onChange={(e) => setCompRccm(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={compPhone} onChange={(e) => setCompPhone(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Adresse du siège</label>
              <input className={inputCls} value={compAddress} onChange={(e) => setCompAddress(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className={btnPrimaryCls}>Enregistrer les paramètres</button>
          </div>
        </form>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setMemberModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Ajouter un utilisateur
            </button>
          </div>
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
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
                    <td className="py-3 px-4">{m.departmentName || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {[m.canWrite && 'Écriture', m.canValidate && 'Validation', m.canDelete && 'Suppression'].filter(Boolean).join(' · ') || 'Lecture'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => updateErpDoc(activeCompany.id, 'members', m.id, { active: !m.active })}
                        className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
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
            <div key={r.id} className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
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
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
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
                    <td className="py-3 px-4">{d.managerName || '—'}</td>
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
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
            <h3 className="font-display font-semibold text-sm">Sauvegarde complète de la base de données</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Exportez l’intégralité des collections de l’entreprise active (clients, factures, stocks, comptabilité, RH, journaux d’audit) au format JSON structuré.
            </p>
            <button type="button" disabled={busy} onClick={handleBackup} className={btnPrimaryCls}>
              <Download className="w-3.5 h-3.5" /> Télécharger la sauvegarde JSON
            </button>
          </div>

          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
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
              <Trash2 className="w-3.5 h-3.5" /> Supprimer toutes les données de démonstration
            </button>
          </div>
        </div>
      )}

      {/* New Company Modal */}
      <Modal open={newCompModal} title="Créer une nouvelle entreprise (Multi-Société)" onClose={() => setNewCompModal(false)} maxWidth="max-w-md">
        <form onSubmit={handleCreateNewCompany} className="space-y-4">
          <div>
            <label className={labelCls}>Nom de la société *</label>
            <input required className={inputCls} value={newCompForm.name} onChange={(e) => setNewCompForm({ ...newCompForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Devise</label>
              <select className={inputCls} value={newCompForm.currency} onChange={(e) => setNewCompForm({ ...newCompForm, currency: e.target.value as CurrencyCode })}>
                <option value="XAF">XAF</option>
                <option value="XOF">XOF</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Plan comptable</label>
              <select className={inputCls} value={newCompForm.accountingStandard} onChange={(e) => setNewCompForm({ ...newCompForm, accountingStandard: e.target.value as AccountingStandard })}>
                <option value="OHADA">OHADA</option>
                <option value="GENERAL">Général</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={newCompForm.withDemoData} onChange={(e) => setNewCompForm({ ...newCompForm, withDemoData: e.target.checked })} />
            Inclure les données de démonstration
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setNewCompModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy} className={btnPrimaryCls}>Créer la société</button>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={memberModal} title="Ajouter un membre à la société" onClose={() => setMemberModal(false)} maxWidth="max-w-md">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className={labelCls}>UID Firebase Auth de l’utilisateur *</label>
            <input required className={inputCls} value={memberForm.uid} onChange={(e) => setMemberForm({ ...memberForm, uid: e.target.value })} placeholder="Ex: XyZ123..." />
          </div>
          <div>
            <label className={labelCls}>Nom complet *</label>
            <input required className={inputCls} value={memberForm.displayName} onChange={(e) => setMemberForm({ ...memberForm, displayName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input type="email" required className={inputCls} value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
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
    </div>
  );
};
