import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  FileDown,
  FileSpreadsheet,
  ArrowLeft,
  Upload,
  Download,
} from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { getCatalogModule } from '../../catalog/moduleCatalog';
import { createErpDoc, deleteErpDoc, logAudit, updateErpDoc } from '../../services/erpEngine';
import { exportRowsCsv, exportWorkbookExcel, exportTablePdf } from '../../lib/exports';
import { formatMoney, todayIso } from '../../lib/format';
import { ModuleRecord } from '../../types/erp';
import { ImportSpreadsheetModal } from '../ImportSpreadsheetModal';
import {
  EmptyState,
  Modal,
  PageHeader,
  StatusLabel,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
} from '../ui/DataUI';

const STATUS_LABELS: Record<ModuleRecord['status'], string> = {
  brouillon: 'Brouillon',
  en_cours: 'En cours',
  valide: 'Validé',
  termine: 'Terminé',
  annule: 'Annulé',
};

const STATUS_TONES: Record<ModuleRecord['status'], 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  brouillon: 'neutral',
  en_cours: 'warning',
  valide: 'info',
  termine: 'success',
  annule: 'danger',
};

export const DynamicModuleView: React.FC = () => {
  const {
    user,
    activeCompany,
    activeCatalogModuleId,
    customModules,
    moduleRecords,
    setActiveModule,
    notify,
  } = useErp();

  const builtInMod = getCatalogModule(activeCatalogModuleId);
  const customMod = customModules.find((c) => c.id === activeCatalogModuleId);

  const moduleMeta = {
    id: builtInMod?.id || customMod?.id || activeCatalogModuleId,
    name: builtInMod?.name || customMod?.name || 'Module Spécialisé',
    desc:
      builtInMod?.shortDesc ||
      customMod?.description ||
      'Gestion opérationnelle et suivi structuré des enregistrements.',
    family: builtInMod?.family || customMod?.category || 'Opérations',
    color: builtInMod?.color || customMod?.accentColor || '#FC3F1D',
    partnerLabel: builtInMod?.partnerLabel || 'Tiers / Responsable',
    amountLabel: builtInMod?.amountLabel || 'Montant',
    qtyLabel: builtInMod?.qtyLabel || 'Quantité',
    categoryLabel: builtInMod?.categoryLabel || 'Catégorie',
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ModuleRecord['status']>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState({
    title: '',
    reference: '',
    partnerName: '',
    category: '',
    amount: 0,
    quantity: 1,
    status: 'en_cours' as ModuleRecord['status'],
    date: todayIso(),
    notes: '',
  });

  if (!activeCompany || !user) return null;
  const currency = activeCompany.currency;

  const scopedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return moduleRecords
      .filter((r) => r.moduleId === moduleMeta.id)
      .filter((r) => statusFilter === 'ALL' || r.status === statusFilter)
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          (r.reference || '').toLowerCase().includes(q) ||
          (r.partnerName || '').toLowerCase().includes(q) ||
          (r.category || '').toLowerCase().includes(q)
      )
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [moduleRecords, moduleMeta.id, search, statusFilter]);

  const totalAmount = scopedRecords
    .filter((r) => r.status !== 'annule')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const inProgressCount = scopedRecords.filter((r) => r.status === 'en_cours').length;
  const doneCount = scopedRecords.filter((r) => r.status === 'termine' || r.status === 'valide').length;

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      reference: `REF-${Date.now().toString().slice(-5)}`,
      partnerName: '',
      category: '',
      amount: 0,
      quantity: 1,
      status: 'en_cours',
      date: todayIso(),
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (rec: ModuleRecord) => {
    setEditing(rec);
    setForm({
      title: rec.title,
      reference: rec.reference || '',
      partnerName: rec.partnerName || '',
      category: rec.category || '',
      amount: rec.amount || 0,
      quantity: rec.quantity || 1,
      status: rec.status,
      date: rec.date || todayIso(),
      notes: rec.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      notify('Veuillez renseigner un libellé.', 'warning');
      return;
    }

    const payload = {
      moduleId: moduleMeta.id,
      title: form.title.trim(),
      reference: form.reference.trim(),
      partnerName: form.partnerName.trim(),
      category: form.category.trim(),
      amount: Number(form.amount) || 0,
      quantity: Number(form.quantity) || 0,
      status: form.status,
      date: form.date || todayIso(),
      notes: form.notes.trim(),
      isDemo: false,
    };

    try {
      if (editing) {
        await updateErpDoc(activeCompany.id, 'moduleRecords', editing.id, payload);
        notify('Enregistrement mis à jour.', 'success');
      } else {
        const newId = await createErpDoc(
          activeCompany.id,
          'moduleRecords',
          payload,
          activeCompany.ownerId,
          activeCompany.memberUids
        );
        await logAudit({
          companyId: activeCompany.id,
          uid: user.uid,
          email: user.email || '',
          ownerId: activeCompany.ownerId,
          memberUids: activeCompany.memberUids,
          action: 'CREATE_MODULE_RECORD',
          module: moduleMeta.id,
          entityId: newId,
          summary: `Nouvel enregistrement « ${payload.title} » dans ${moduleMeta.name}.`,
        });
        notify(`Enregistrement ajouté dans ${moduleMeta.name}.`, 'success');
      }
      setModalOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur d’enregistrement', 'error');
    }
  };

  const handleDelete = async (rec: ModuleRecord) => {
    await deleteErpDoc(activeCompany.id, 'moduleRecords', rec.id);
    notify(`Enregistrement « ${rec.title} » supprimé.`, 'info');
  };

  const exportPdf = () => {
    exportTablePdf(
      moduleMeta.name,
      `${activeCompany.name} · ${moduleMeta.family}`,
      ['Référence', 'Libellé', moduleMeta.partnerLabel, moduleMeta.categoryLabel, 'Date', moduleMeta.amountLabel, 'Statut'],
      scopedRecords.map((r) => [
        r.reference || '-',
        r.title,
        r.partnerName || '-',
        r.category || '-',
        r.date,
        formatMoney(r.amount || 0, currency),
        STATUS_LABELS[r.status],
      ]),
      `JESSI_${moduleMeta.id}_${todayIso()}`
    );
  };

  const exportExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: moduleMeta.name.slice(0, 28),
          rows: scopedRecords.map((r) => ({
            Reference: r.reference || '',
            Libelle: r.title,
            Tiers: r.partnerName || '',
            Categorie: r.category || '',
            Date: r.date,
            Quantite: r.quantity || 0,
            Montant: r.amount || 0,
            Statut: STATUS_LABELS[r.status],
            Notes: r.notes || '',
          })),
        },
      ],
      `JESSI_${moduleMeta.id}_${todayIso()}`
    );
  };

  const exportCsv = () => {
    exportRowsCsv(
      scopedRecords.map((r) => ({
        Reference: r.reference || '',
        Libelle: r.title,
        Tiers: r.partnerName || '',
        Categorie: r.category || '',
        Date: r.date,
        Quantite: r.quantity || 0,
        Montant: r.amount || 0,
        Statut: STATUS_LABELS[r.status],
        Notes: r.notes || '',
      })),
      `JESSI_${moduleMeta.id}_${todayIso()}`
    );
    notify('Export CSV téléchargé.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveModule('launcher')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#FC3F1D] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux Applications
        </button>
      </div>

      <PageHeader
        title={moduleMeta.name}
        subtitle={`${moduleMeta.family} · ${moduleMeta.desc}`}
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className={btnSecondaryCls}>
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button type="button" onClick={exportCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportPdf} className={btnSecondaryCls}>
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
            <button type="button" onClick={exportExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" onClick={openCreate} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvel enregistrement
            </button>
          </>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total dossiers</p>
          <p className="mt-1 font-mono text-xl font-bold text-[#111216] dark:text-white tabular-nums">
            {scopedRecords.length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">En cours</p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-600 tabular-nums">
            {inProgressCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Validés / Terminés</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-600 tabular-nums">
            {doneCount}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cumul ({moduleMeta.amountLabel})
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-[#FC3F1D] tabular-nums">
            {formatMoney(totalAmount, currency)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, référence, tiers ou catégorie..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FC3F1D]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ModuleRecord['status'])}
          className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-xl"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="en_cours">En cours</option>
          <option value="valide">Validé</option>
          <option value="termine">Terminé</option>
          <option value="annule">Annulé</option>
        </select>
      </div>

      {/* Data Table */}
      {scopedRecords.length === 0 ? (
        <EmptyState
          title={`Aucune opération dans ${moduleMeta.name}`}
          description="Ajoutez votre premier enregistrement opérationnel dans ce module. Toutes vos saisies sont persistées en temps réel."
          actionLabel="Nouvel enregistrement"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8EC] dark:border-[#262933] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-[#F5F6F8] dark:bg-[#0D0E12]">
                  <th className="py-3 px-4 font-semibold">Référence</th>
                  <th className="py-3 px-4 font-semibold">Libellé</th>
                  <th className="py-3 px-4 font-semibold">{moduleMeta.partnerLabel}</th>
                  <th className="py-3 px-4 font-semibold">{moduleMeta.categoryLabel}</th>
                  <th className="py-3 px-4 font-semibold">Date</th>
                  <th className="py-3 px-4 font-semibold text-right">{moduleMeta.qtyLabel}</th>
                  <th className="py-3 px-4 font-semibold text-right">{moduleMeta.amountLabel}</th>
                  <th className="py-3 px-4 font-semibold">Statut</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8EC] dark:divide-[#262933] text-xs">
                {scopedRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-4 font-mono font-semibold text-[#111216] dark:text-white whitespace-nowrap">
                      {rec.reference || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#111216] dark:text-white">{rec.title}</p>
                      {rec.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs">
                          {rec.notes}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {rec.partnerName || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {rec.category || '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4 font-mono text-right tabular-nums">
                      {rec.quantity ?? 0}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-right tabular-nums text-[#111216] dark:text-white whitespace-nowrap">
                      {formatMoney(rec.amount || 0, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={STATUS_LABELS[rec.status]} tone={STATUS_TONES[rec.status]} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(rec)}
                        className="p-1.5 text-slate-500 hover:text-[#FC3F1D] rounded"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rec)}
                        className="p-1.5 text-slate-500 hover:text-red-600 rounded ml-1"
                        title="Supprimer"
                      >
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

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        title={editing ? `Modifier · ${moduleMeta.name}` : `Nouvel ajout · ${moduleMeta.name}`}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Libellé / Objet *</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={`Objet dans ${moduleMeta.name}`}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Référence</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{moduleMeta.partnerLabel}</label>
              <input
                type="text"
                value={form.partnerName}
                onChange={(e) => setForm({ ...form, partnerName: e.target.value })}
                placeholder="Nom du client, responsable ou actif"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{moduleMeta.categoryLabel}</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Catégorie ou segment"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>{moduleMeta.amountLabel} ({currency})</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{moduleMeta.qtyLabel}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ModuleRecord['status'] })}
                className={inputCls}
              >
                <option value="brouillon">Brouillon</option>
                <option value="en_cours">En cours</option>
                <option value="valide">Validé</option>
                <option value="termine">Terminé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes & Détails opérationnels</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Informations complémentaires..."
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className={btnSecondaryCls}>
              Annuler
            </button>
            <button type="submit" className={btnPrimaryCls}>
              {editing ? 'Enregistrer les modifications' : 'Créer l’enregistrement'}
            </button>
          </div>
        </form>
      </Modal>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="moduleRecords"
        moduleId={moduleMeta.id}
        moduleLabel={moduleMeta.name}
      />
    </div>
  );
};
