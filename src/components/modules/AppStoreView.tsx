import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Check,
  Power,
  Trash2,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { MODULE_CATALOG, MODULE_FAMILIES, ModuleFamily } from '../../data/moduleCatalog';
import {
  createErpDoc,
  deleteErpDoc,
  logAudit,
  updateErpDoc,
  updateWorkspaceEnabledModules,
} from '../../services/erpEngine';
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

export const AppStoreView: React.FC = () => {
  const {
    user,
    activeCompany,
    enabledCatalogIds,
    customModules,
    openCatalogModule,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [family, setFamily] = useState<'ALL' | ModuleFamily>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [customModal, setCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    code: '',
    name: '',
    category: 'Opérations & Projets',
    description: '',
    accentColor: '#FC3F1D',
  });

  if (!activeCompany || !user) return null;

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULE_CATALOG.filter((m) => {
      const matchFam = family === 'ALL' || m.family === family;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.shortDesc.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q);
      return matchFam && matchQ;
    });
  }, [family, search]);

  const toggleBuiltInModule = async (modId: string, modName: string) => {
    const isEnabled = enabledCatalogIds.includes(modId);
    if (isEnabled && enabledCatalogIds.length <= 1) {
      notify('Au moins un module doit rester actif dans votre espace.', 'warning');
      return;
    }

    const next = isEnabled
      ? enabledCatalogIds.filter((id) => id !== modId)
      : [...enabledCatalogIds, modId];

    setBusyId(modId);
    try {
      await updateWorkspaceEnabledModules(activeCompany.id, next);
      await logAudit({
        companyId: activeCompany.id,
        uid: user.uid,
        email: user.email || '',
        ownerId: activeCompany.ownerId,
        memberUids: activeCompany.memberUids,
        action: isEnabled ? 'DISABLE_MODULE' : 'ENABLE_MODULE',
        module: 'appstore',
        entityId: modId,
        summary: `${isEnabled ? 'Désactivation' : 'Activation'} du module « ${modName} ».`,
      });
      notify(
        isEnabled ? `Module « ${modName} » désactivé.` : `Module « ${modName} » activé dans votre espace.`,
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur de mise à jour du module.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateCustomModule = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = customForm.code.trim().toUpperCase() || `MOD-${Date.now().toString().slice(-4)}`;
    const cleanName = customForm.name.trim();
    if (cleanName.length < 2) {
      notify('Le nom du module doit contenir au moins 2 caractères.', 'warning');
      return;
    }

    try {
      const newId = await createErpDoc(
        activeCompany.id,
        'customModules',
        {
          code: cleanCode,
          name: cleanName,
          category: customForm.category.trim() || 'Métier Spécialisé',
          description: customForm.description.trim() || 'Module personnalisé FUREX ERP.',
          iconName: 'Layers',
          accentColor: customForm.accentColor || '#FC3F1D',
          active: true,
        },
        activeCompany.ownerId,
        activeCompany.memberUids
      );

      await logAudit({
        companyId: activeCompany.id,
        uid: user.uid,
        email: user.email || '',
        ownerId: activeCompany.ownerId,
        memberUids: activeCompany.memberUids,
        action: 'CREATE_CUSTOM_MODULE',
        module: 'appstore',
        entityId: newId,
        summary: `Création du module personnalisé « ${cleanName} » (${cleanCode}).`,
      });

      notify(`Module personnalisé « ${cleanName} » créé et activé.`, 'success');
      setCustomForm({
        code: '',
        name: '',
        category: 'Opérations & Projets',
        description: '',
        accentColor: '#FC3F1D',
      });
      setCustomModal(false);
      setTab('custom');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur création module', 'error');
    }
  };

  const toggleCustomActive = async (id: string, currentActive: boolean, name: string) => {
    await updateErpDoc(activeCompany.id, 'customModules', id, { active: !currentActive });
    notify(
      !currentActive ? `Module « ${name} » réactivé.` : `Module « ${name} » mis en pause.`,
      'info'
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue des Modules (66+ Applications)"
        subtitle={`Activez, désactivez ou créez vos propres modules métiers dans l’espace ${activeCompany.name}`}
        actions={
          <button
            type="button"
            onClick={() => setCustomModal(true)}
            className={btnPrimaryCls}
          >
            <Plus className="w-3.5 h-3.5" /> Créer un module sur mesure
          </button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          activeId={tab}
          onChange={(id) => setTab(id as 'catalog' | 'custom')}
          tabs={[
            { id: 'catalog', label: 'Catalogue officiel FUREX', count: MODULE_CATALOG.length },
            { id: 'custom', label: 'Modules sur mesure', count: customModules.length },
          ]}
        />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
          {enabledCatalogIds.length} / {MODULE_CATALOG.length} modules standards actifs
        </span>
      </div>

      {tab === 'catalog' && (
        <div className="space-y-5">
          {/* Search & Family Filter */}
          <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-3">
            <div className="relative max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un module (POS, Flotte, Immobilisations, Paie, Budget, SAV...)"
                className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FC3F1D]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFamily('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  family === 'ALL'
                    ? 'bg-[#111216] dark:bg-white text-white dark:text-[#111216]'
                    : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300'
                }`}
              >
                Tous ({MODULE_CATALOG.length})
              </button>
              {MODULE_FAMILIES.map((fam) => {
                const cnt = MODULE_CATALOG.filter((m) => m.family === fam).length;
                return (
                  <button
                    key={fam}
                    type="button"
                    onClick={() => setFamily(fam)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      family === fam
                        ? 'bg-[#111216] dark:bg-white text-white dark:text-[#111216]'
                        : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {fam} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((mod) => {
              const isEnabled = enabledCatalogIds.includes(mod.id);
              const isBusy = busyId === mod.id;
              return (
                <div
                  key={mod.id}
                  className={`bg-white dark:bg-[#16181F] border rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all ${
                    isEnabled
                      ? 'border-[#E6E8EC] dark:border-[#262933]'
                      : 'border-[#E6E8EC] dark:border-[#262933] opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-display font-extrabold text-xs shrink-0"
                          style={{ backgroundColor: mod.color }}
                        >
                          {mod.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-[#111216] dark:text-white truncate">
                            {mod.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {mod.family}
                          </p>
                        </div>
                      </div>
                      <StatusLabel
                        label={isEnabled ? 'Installé' : 'Disponible'}
                        tone={isEnabled ? 'success' : 'neutral'}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {mod.shortDesc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E6E8EC] dark:border-[#262933]">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => toggleBuiltInModule(mod.id, mod.name)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                        isEnabled
                          ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                          : 'bg-[#FC3F1D] border-[#FC3F1D] text-white hover:bg-[#E03212]'
                      }`}
                    >
                      {isEnabled ? (
                        <>
                          <Power className="w-3.5 h-3.5" /> Désactiver
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" /> Installer
                        </>
                      )}
                    </button>

                    {isEnabled && (
                      <button
                        type="button"
                        onClick={() => openCatalogModule(mod.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FC3F1D] hover:underline cursor-pointer"
                      >
                        Ouvrir <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <div className="space-y-4">
          {customModules.length === 0 ? (
            <div className="bg-white dark:bg-[#16181F] border border-dashed border-[#D8DCE3] dark:border-[#2A2E39] rounded-2xl p-10 text-center space-y-3">
              <Layers className="w-8 h-8 text-[#FC3F1D] mx-auto" />
              <h3 className="font-display text-sm font-bold text-[#111216] dark:text-white">
                Aucun module personnalisé pour le moment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Créez un module adapté à votre secteur (ex : Gestion Chantiers, Location Engins, Dossiers Médicaux, Suivi Douane) avec persistance directe en base de données.
              </p>
              <button
                type="button"
                onClick={() => setCustomModal(true)}
                className={btnPrimaryCls}
              >
                <Plus className="w-3.5 h-3.5" /> Créer mon premier module
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customModules.map((cm) => (
                <div
                  key={cm.id}
                  className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-display font-bold text-xs shrink-0"
                          style={{ backgroundColor: cm.accentColor || '#FC3F1D' }}
                        >
                          {cm.code.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-bold text-[#111216] dark:text-white truncate">
                            {cm.name}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {cm.code} · {cm.category}
                          </p>
                        </div>
                      </div>
                      <StatusLabel
                        label={cm.active ? 'Actif' : 'Inactif'}
                        tone={cm.active ? 'success' : 'neutral'}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {cm.description || 'Module métier personnalisé FUREX ERP.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#E6E8EC] dark:border-[#262933]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCustomActive(cm.id, cm.active, cm.name)}
                        className={btnSecondaryCls}
                      >
                        {cm.active ? 'Mettre en pause' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteErpDoc(activeCompany.id, 'customModules', cm.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                        title="Supprimer ce module"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {cm.active && (
                      <button
                        type="button"
                        onClick={() => openCatalogModule(cm.id)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FC3F1D] hover:underline cursor-pointer"
                      >
                        Ouvrir <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Custom Module Modal */}
      <Modal
        open={customModal}
        title="Créer un module métier personnalisé"
        onClose={() => setCustomModal(false)}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateCustomModule} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Code court</label>
              <input
                type="text"
                required
                maxLength={10}
                value={customForm.code}
                onChange={(e) => setCustomForm({ ...customForm, code: e.target.value })}
                placeholder="EX: DOUANE"
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Nom du module</label>
              <input
                type="text"
                required
                value={customForm.name}
                onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                placeholder="Ex: Dossiers Transit & Douane"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Famille / Catégorie</label>
              <select
                value={customForm.category}
                onChange={(e) => setCustomForm({ ...customForm, category: e.target.value })}
                className={inputCls}
              >
                {MODULE_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Couleur de tuile</label>
              <select
                value={customForm.accentColor}
                onChange={(e) => setCustomForm({ ...customForm, accentColor: e.target.value })}
                className={inputCls}
              >
                <option value="#FC3F1D">Rouge FUREX (#FC3F1D)</option>
                <option value="#111216">Obsidienne (#111216)</option>
                <option value="#2563EB">Bleu Exécutif (#2563EB)</option>
                <option value="#059669">Émeraude (#059669)</option>
                <option value="#D97706">Ambre (#D97706)</option>
                <option value="#7C3AED">Violet (#7C3AED)</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description fonctionnelle</label>
            <textarea
              rows={3}
              value={customForm.description}
              onChange={(e) => setCustomForm({ ...customForm, description: e.target.value })}
              placeholder="Décrivez le rôle de ce module dans votre organisation..."
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCustomModal(false)} className={btnSecondaryCls}>
              Annuler
            </button>
            <button type="submit" className={btnPrimaryCls}>
              Créer et activer le module
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
