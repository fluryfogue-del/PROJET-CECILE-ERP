import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Store,
  ArrowUpRight,
  Users,
  Package,
  FileText,
  Landmark,
  Sparkles,
  Building2,
  User,
  Upload,
} from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { MODULE_CATALOG, MODULE_FAMILIES, ModuleFamily } from '../../catalog/moduleCatalog';
import { formatMoney } from '../../lib/format';
import { ImportSpreadsheetModal } from '../ImportSpreadsheetModal';
import { PageHeader, btnPrimaryCls, btnSecondaryCls } from '../ui/DataUI';

export const AppLauncherView: React.FC = () => {
  const {
    activeCompany,
    enabledCatalogIds,
    customModules,
    openCatalogModule,
    setActiveModule,
    setCreateWorkspaceOpen,
    customers,
    products,
    invoices,
    treasuryAccounts,
  } = useErp();

  const [search, setSearch] = useState('');
  const [family, setFamily] = useState<'ALL' | ModuleFamily>('ALL');
  const [importOpen, setImportOpen] = useState(false);

  const currency = activeCompany?.currency || 'XAF';
  const totalRevenue = invoices
    .filter((i) => i.status !== 'annulee')
    .reduce((sum, i) => sum + (i.total || 0), 0);
  const totalCash = treasuryAccounts.reduce((sum, t) => sum + (t.balance || 0), 0);
  const stockValue = products.reduce(
    (sum, p) => sum + (p.stockQty || 0) * (p.purchasePrice || 0),
    0
  );

  const activeBuiltInModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULE_CATALOG.filter((m) => {
      if (!enabledCatalogIds.includes(m.id)) return false;
      const matchFam = family === 'ALL' || m.family === family;
      const matchQ =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.shortDesc.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q);
      return matchFam && matchQ;
    });
  }, [enabledCatalogIds, family, search]);

  const activeCustomModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customModules.filter((cm) => {
      if (!cm.active) return false;
      if (family !== 'ALL') return false;
      return (
        !q ||
        cm.name.toLowerCase().includes(q) ||
        cm.category.toLowerCase().includes(q) ||
        (cm.description || '').toLowerCase().includes(q)
      );
    });
  }, [customModules, family, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Applications · ${activeCompany?.name || 'FUREX ERP'}`}
        subtitle={`Lanceur modulaire (${enabledCatalogIds.length + customModules.filter((c) => c.active).length} applications actives) · Accès direct à vos opérations`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className={btnSecondaryCls}
            >
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button
              type="button"
              onClick={() => setCreateWorkspaceOpen(true)}
              className={btnSecondaryCls}
            >
              <Plus className="w-3.5 h-3.5" /> Nouvel espace
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('appstore')}
              className={btnPrimaryCls}
            >
              <Store className="w-3.5 h-3.5" /> Catalogue & Modules (66+)
            </button>
          </>
        }
      />

      {/* Yango Executive Summary Strip + Quick Add Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setActiveModule('sales')}
            className="text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-semibold">Chiffre d’affaires</span>
              <FileText className="w-3.5 h-3.5 text-[#FC3F1D]" />
            </div>
            <p className="mt-2 font-mono text-base sm:text-lg font-bold text-[#111216] dark:text-white tabular-nums truncate">
              {formatMoney(totalRevenue, currency)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{invoices.length} factures</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('treasury')}
            className="text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-semibold">Trésorerie</span>
              <Landmark className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="mt-2 font-mono text-base sm:text-lg font-bold text-[#111216] dark:text-white tabular-nums truncate">
              {formatMoney(totalCash, currency)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{treasuryAccounts.length} comptes</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('inventory')}
            className="text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-semibold">Valeur Stock</span>
              <Package className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="mt-2 font-mono text-base sm:text-lg font-bold text-[#111216] dark:text-white tabular-nums truncate">
              {formatMoney(stockValue, currency)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">{products.length} articles</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('crm')}
            className="text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[11px] font-semibold">Portefeuille Clients</span>
              <Users className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="mt-2 font-mono text-base sm:text-lg font-bold text-[#111216] dark:text-white tabular-nums">
              {customers.length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Clients actifs</p>
          </button>
        </div>

        {/* Quick Actions Card */}
        <div className="md:col-span-4 bg-[#111216] text-white rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#FC3F1D]">
                Ajouts rapides
              </p>
              <p className="text-xs text-slate-300 mt-0.5">
                {activeCompany?.accountType === 'particulier' ? (
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3" /> Profil Particulier
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> Profil Entreprise
                  </span>
                )}
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-[#FC3F1D]" />
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() => setActiveModule('inventory')}
              className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-[#FC3F1D] rounded-xl text-left transition-colors cursor-pointer"
            >
              + Stock / Produit
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('crm')}
              className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-[#FC3F1D] rounded-xl text-left transition-colors cursor-pointer"
            >
              + Client / Prospect
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('sales')}
              className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-[#FC3F1D] rounded-xl text-left transition-colors cursor-pointer"
            >
              + Devis / Facture
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('appstore')}
              className="px-3 py-2 text-xs font-semibold bg-[#FC3F1D] hover:bg-[#E03212] rounded-xl text-left transition-colors cursor-pointer"
            >
              + Ajouter Module
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer vos applications actives (Stocks, CRM, POS, Flotte, Paie...)"
              className="w-full pl-10 pr-4 py-2 text-xs bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FC3F1D]"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
            {activeBuiltInModules.length + activeCustomModules.length} application(s) affichée(s)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFamily('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              family === 'ALL'
                ? 'bg-[#FC3F1D] text-white'
                : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
          >
            Toutes les familles
          </button>
          {MODULE_FAMILIES.map((fam) => (
            <button
              key={fam}
              type="button"
              onClick={() => setFamily(fam)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                family === fam
                  ? 'bg-[#FC3F1D] text-white'
                  : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {fam}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Modules Row (if any) */}
      {activeCustomModules.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Vos modules sur mesure ({activeCustomModules.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {activeCustomModules.map((cm) => (
              <button
                key={cm.id}
                type="button"
                onClick={() => openCatalogModule(cm.id)}
                className="group text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="w-11 h-11 rounded-2xl text-white flex items-center justify-center font-display font-extrabold text-sm shadow-xs"
                    style={{ backgroundColor: cm.accentColor || '#FC3F1D' }}
                  >
                    {cm.code.slice(0, 3)}
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#FC3F1D] transition-colors" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-[#111216] dark:text-white truncate">
                    {cm.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {cm.category}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Yango-style Odoo App Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
        {activeBuiltInModules.map((mod) => (
          <button
            key={mod.id}
            type="button"
            onClick={() => openCatalogModule(mod.id)}
            className="group text-left bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] rounded-2xl p-4 transition-all flex flex-col justify-between gap-3 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div
                className="w-11 h-11 rounded-2xl text-white flex items-center justify-center font-display font-extrabold text-sm shadow-xs"
                style={{ backgroundColor: mod.color }}
              >
                {mod.name.slice(0, 2).toUpperCase()}
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#FC3F1D] transition-colors" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-[#111216] dark:text-white leading-snug line-clamp-1">
                {mod.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                {mod.shortDesc}
              </p>
            </div>
          </button>
        ))}

        {/* Add More Modules Tile */}
        <button
          type="button"
          onClick={() => setActiveModule('appstore')}
          className="text-left border-2 border-dashed border-[#D8DCE3] dark:border-[#2A2E39] hover:border-[#FC3F1D] rounded-2xl p-4 transition-colors flex flex-col items-center justify-center text-center gap-2 min-h-[136px] cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-[#FC3F1D]/10 text-[#FC3F1D] flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <p className="font-display text-xs font-bold text-[#111216] dark:text-white">
            Ajouter des modules
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Parcourir les {MODULE_CATALOG.length} apps
          </p>
        </button>
      </div>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="products"
        allowTargetSwitch
      />
    </div>
  );
};
