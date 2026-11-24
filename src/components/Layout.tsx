import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  LayoutGrid,
  Store,
  Users,
  ShoppingCart,
  Truck,
  Package,
  BookOpen,
  Landmark,
  UserCheck,
  BarChart3,
  Settings,
  FileText,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Building2,
  User,
  Plus,
  CheckCheck,
  AlertTriangle,
  Layers,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { ModuleId } from '../types/erp';
import { updateErpDoc } from '../services/erpEngine';
import { formatMoney } from '../lib/format';
import { getCatalogModule, MODULE_CATALOG } from '../catalog/moduleCatalog';

interface NavItem {
  id: ModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    logout,
    companies,
    activeCompany,
    setActiveCompanyId,
    openDemoWorkspace,
    lockWorkspace,
    setCreateWorkspaceOpen,
    activeModule,
    setActiveModule,
    activeCatalogModuleId,
    openCatalogModule,
    enabledCatalogIds,
    customModules,
    hasModuleAccess,
    theme,
    toggleTheme,
    language,
    setLanguage,
    t,
    toasts,
    dismissToast,
    notifications,
    customers,
    leads,
    products,
    invoices,
    salesOrders,
    suppliers,
    employees,
  } = useErp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const coreNavItems: NavItem[] = [
    { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { id: 'crm', label: t.nav.crm, icon: Users },
    { id: 'sales', label: t.nav.sales, icon: ShoppingCart },
    { id: 'purchases', label: t.nav.purchases, icon: Truck },
    { id: 'inventory', label: t.nav.inventory, icon: Package },
    { id: 'accounting', label: t.nav.accounting, icon: BookOpen },
    { id: 'treasury', label: t.nav.treasury, icon: Landmark },
    { id: 'hr', label: t.nav.hr, icon: UserCheck },
    { id: 'reporting', label: t.nav.reporting, icon: BarChart3 },
    { id: 'admin', label: t.nav.admin, icon: Settings },
    { id: 'docs', label: t.nav.docs, icon: FileText },
  ];

  // Filter core nav by RBAC AND workspace enabled modules (always keeping dashboard/admin/docs accessible)
  const visibleCoreNav = coreNavItems.filter((item) => {
    if (!hasModuleAccess(item.id)) return false;
    if (item.id === 'dashboard' || item.id === 'admin' || item.id === 'docs') return true;
    const mapped = MODULE_CATALOG.filter((m) => m.targetModule === item.id);
    if (mapped.length === 0) return true;
    return mapped.some((m) => enabledCatalogIds.includes(m.id));
  });

  const activeSpecializedModules = useMemo(
    () =>
      MODULE_CATALOG.filter(
        (m) => m.targetModule === 'dynamic_module' && enabledCatalogIds.includes(m.id)
      ),
    [enabledCatalogIds]
  );

  const activeCustomList = useMemo(
    () => customModules.filter((cm) => cm.active),
    [customModules]
  );

  const unreadNotifs = notifications.filter((n) => !n.read);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const currency = activeCompany?.currency || 'XAF';
    const hits: Array<{
      type: string;
      title: string;
      subtitle: string;
      module?: ModuleId;
      catalogId?: string;
    }> = [];

    // Modules from 66+ catalog
    MODULE_CATALOG.filter(
      (m) => m.name.toLowerCase().includes(q) || m.family.toLowerCase().includes(q)
    )
      .slice(0, 5)
      .forEach((m) =>
        hits.push({
          type: 'Module',
          title: m.name,
          subtitle: `${m.family} · ${m.shortDesc}`,
          catalogId: m.id,
        })
      );

    customModules
      .filter((cm) => cm.active && cm.name.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((cm) =>
        hits.push({
          type: 'Module perso',
          title: cm.name,
          subtitle: `${cm.code} · ${cm.category}`,
          catalogId: cm.id,
        })
      );

    customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((c) =>
        hits.push({
          type: 'Client',
          title: c.name,
          subtitle: `${c.code} · Solde ${formatMoney(c.balanceDue, currency)}`,
          module: 'crm',
        })
      );

    leads
      .filter((l) => l.name.toLowerCase().includes(q) || (l.companyName || '').toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((l) =>
        hits.push({
          type: 'Prospect',
          title: l.name,
          subtitle: `${l.companyName || 'Particulier'} · ${l.status}`,
          module: 'crm',
        })
      );

    products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((p) =>
        hits.push({
          type: 'Article',
          title: p.name,
          subtitle: `${p.sku} · Stock: ${p.stockQty} · ${formatMoney(p.salePrice, currency)}`,
          module: 'inventory',
        })
      );

    invoices
      .filter((i) => i.number.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((i) =>
        hits.push({
          type: 'Facture',
          title: i.number,
          subtitle: `${i.customerName} · ${formatMoney(i.total, currency)} (${i.status})`,
          module: 'sales',
        })
      );

    salesOrders
      .filter((o) => o.number.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((o) =>
        hits.push({
          type: 'Commande',
          title: o.number,
          subtitle: `${o.customerName} · ${formatMoney(o.total, currency)}`,
          module: 'sales',
        })
      );

    suppliers
      .filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((s) =>
        hits.push({
          type: 'Fournisseur',
          title: s.name,
          subtitle: `${s.code} · Dette ${formatMoney(s.balancePayable, currency)}`,
          module: 'purchases',
        })
      );

    employees
      .filter((e) => `${e.firstName} ${e.lastName} ${e.matricule}`.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((e) =>
        hits.push({
          type: 'Employé',
          title: `${e.firstName} ${e.lastName}`,
          subtitle: `${e.matricule} · ${e.position}`,
          module: 'hr',
        })
      );

    return hits;
  }, [searchQuery, customModules, customers, leads, products, invoices, salesOrders, suppliers, employees, activeCompany]);

  const markAllRead = async () => {
    if (!activeCompany) return;
    for (const n of unreadNotifs) {
      await updateErpDoc(activeCompany.id, 'notifications', n.id, { read: true }, false);
    }
  };

  const activeNavLabel = useMemo(() => {
    if (activeModule === 'launcher') return 'Applications';
    if (activeModule === 'appstore') return 'Catalogue Modules (66+)';
    if (activeModule === 'dynamic_module') {
      const builtIn = getCatalogModule(activeCatalogModuleId);
      if (builtIn) return builtIn.name;
      const cust = customModules.find((c) => c.id === activeCatalogModuleId);
      if (cust) return cust.name;
      return 'Module Spécialisé';
    }
    return coreNavItems.find((n) => n.id === activeModule)?.label || 'JESSI';
  }, [activeModule, activeCatalogModuleId, customModules, coreNavItems]);

  const SidebarContent = (
    <div className="h-full flex flex-col bg-[#111216] text-slate-200 border-r border-[#262933]">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-[#262933] flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setActiveModule('launcher');
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <img
            src="/assets/aistudio/image_2c55d81b.png"
            alt="JESSI"
            className="w-9 h-9 rounded-xl object-cover border border-[#262933]"
          />
          <div>
            <p className="font-display font-extrabold text-sm tracking-tight text-white leading-none">
              JESSI
            </p>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              {activeCompany?.accountType === 'particulier' ? (
                <>
                  <User className="w-3 h-3 text-[#FC3F1D]" /> Espace Particulier
                </>
              ) : (
                <>
                  <Building2 className="w-3 h-3 text-[#FC3F1D]" /> Espace Entreprise
                </>
              )}
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Switcher + New Workspace */}
      <div className="px-3 py-3 border-b border-[#262933] space-y-2">
        <div className="flex items-center justify-between px-1">
          <label className="text-[11px] font-medium text-slate-400">Espace de travail</label>
          <button
            type="button"
            onClick={() => {
              setCreateWorkspaceOpen(true);
              setMobileMenuOpen(false);
            }}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC3F1D] hover:underline cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Nouveau
          </button>
        </div>
        <div className="relative">
          <Building2 className="w-3.5 h-3.5 text-[#FC3F1D] absolute left-2.5 top-2.5 pointer-events-none" />
          <select
            value={activeCompany?.id || ''}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-[#1B1D24] border border-[#2C303C] rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-[#FC3F1D]"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.currency})
              </option>
            ))}
          </select>
        </div>
        {!activeCompany?.isDemo && (
          <button
            type="button"
            disabled={demoLoading}
            onClick={async () => {
              setDemoLoading(true);
              try {
                await openDemoWorkspace(false);
                setMobileMenuOpen(false);
              } finally {
                setDemoLoading(false);
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg border border-[#2C303C] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#FC3F1D]" />
            <span>{demoLoading ? 'Chargement...' : 'Espace Démo (66 modules)'}</span>
          </button>
        )}
      </div>

      {/* Super-App Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Odoo-style Launcher & App Store */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => {
              setActiveModule('launcher');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left cursor-pointer ${
              activeModule === 'launcher'
                ? 'bg-[#FC3F1D] text-white'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutGrid className="w-4 h-4 shrink-0" />
              <span>Applications (Grille)</span>
            </span>
            <span className="font-mono text-[10px] opacity-80">
              {enabledCatalogIds.length + activeCustomList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveModule('appstore');
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left cursor-pointer ${
              activeModule === 'appstore'
                ? 'bg-[#FC3F1D] text-white'
                : 'text-slate-200 hover:bg-white/10'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Store className="w-4 h-4 shrink-0" />
              <span>Catalogue Modules</span>
            </span>
            <span className="font-mono text-[10px] opacity-80">66+</span>
          </button>
        </div>

        {/* Core Modules */}
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Cœur de gestion
          </p>
          {visibleCoreNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveModule(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#FC3F1D] text-white font-semibold'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Modules */}
        {activeCustomList.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Modules sur mesure
            </p>
            {activeCustomList.map((cm) => {
              const isActive =
                activeModule === 'dynamic_module' && activeCatalogModuleId === cm.id;
              return (
                <button
                  key={cm.id}
                  type="button"
                  onClick={() => {
                    openCatalogModule(cm.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#FC3F1D] text-white font-semibold'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{cm.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Specialized Catalog Modules */}
        {activeSpecializedModules.length > 0 && (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Modules spécialisés ({activeSpecializedModules.length})
            </p>
            {activeSpecializedModules.map((mod) => {
              const isActive =
                activeModule === 'dynamic_module' && activeCatalogModuleId === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    openCatalogModule(mod.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#FC3F1D] text-white font-semibold'
                      : 'text-slate-400 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: mod.color }}
                  />
                  <span className="truncate">{mod.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-[#262933] space-y-2">
        <div className="px-2 py-1">
          <p className="text-xs font-semibold text-white truncate">
            {user?.displayName || user?.email}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
        </div>
        {activeCompany && (
          <button
            type="button"
            onClick={() => {
              lockWorkspace(activeCompany.id);
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Verrouiller l’espace</span>
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F5F6F8] dark:bg-[#0D0E12] text-[#111216] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 h-full">{SidebarContent}</div>
          <div
            className="flex-1 bg-[#0D0E12]/70"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Single Compact Sticky Top Bar (56px <= 15% cap on mobile) */}
        <header className="no-print sticky top-0 z-30 bg-white dark:bg-[#16181F] border-b border-[#E6E8EC] dark:border-[#262933] px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('launcher')}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-[#FC3F1D] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors shrink-0 cursor-pointer"
              title="Grille des applications"
              aria-label="Grille des applications"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-bold text-[#111216] dark:text-white truncate">
                {activeCompany?.name || 'JESSI'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="text-[#FC3F1D] font-semibold truncate">
                {activeNavLabel}
              </span>
              {activeCompany?.isDemo && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline text-amber-700 dark:text-amber-400 font-medium whitespace-nowrap">
                    {t.common.demoBadge}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] rounded-xl hover:border-[#FC3F1D] transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Rechercher modules & données</span>
              <kbd className="font-mono text-[10px] px-1.5 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded">
                Ctrl+K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="sm:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
              aria-label="Recherche globale"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((p) => !p)}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-mono font-bold bg-[#FC3F1D] text-white rounded-md">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl shadow-xl z-40">
                  <div className="px-4 py-3 border-b border-[#E6E8EC] dark:border-[#262933] flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111216] dark:text-white">
                      Notifications ({unreadNotifs.length} non lues)
                    </span>
                    {unreadNotifs.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC3F1D] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#E6E8EC] dark:divide-[#262933]">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">Aucune notification.</p>
                    ) : (
                      notifications.slice(0, 12).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read && activeCompany) {
                              void updateErpDoc(activeCompany.id, 'notifications', n.id, { read: true }, false);
                            }
                            setNotifOpen(false);
                            if (n.module) setActiveModule(n.module as ModuleId);
                          }}
                          className={`p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${
                            n.read ? 'opacity-60' : 'bg-[#FC3F1D]/[0.04]'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                n.severity === 'warning' || n.severity === 'error'
                                  ? 'text-amber-600'
                                  : 'text-[#FC3F1D]'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#111216] dark:text-white">{n.title}</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{n.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
              className="px-2.5 py-1.5 text-xs font-mono font-semibold border border-[#E6E8EC] dark:border-[#262933] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              title="Changer la langue"
            >
              {language.toUpperCase()}
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl cursor-pointer"
              aria-label="Basculer le thème"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 bg-[#0D0E12]/65 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E6E8EC] dark:border-[#262933]">
              <Search className="w-4 h-4 text-[#FC3F1D] shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un module (66+), client, article SKU, facture, employé..."
                className="w-full bg-transparent text-sm text-[#111216] dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs font-semibold text-slate-400 hover:text-[#111216] dark:hover:text-white"
              >
                Échap
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E6E8EC] dark:divide-[#262933]">
              {searchQuery.trim() === '' ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  Tapez le nom d’un des 66 modules, un client, un article en stock ou un numéro de facture.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  Aucun résultat pour « {searchQuery} ».
                </p>
              ) : (
                searchResults.map((hit, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (hit.catalogId) {
                        openCatalogModule(hit.catalogId);
                      } else if (hit.module) {
                        setActiveModule(hit.module);
                      }
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111216] dark:text-white truncate">
                        {hit.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {hit.subtitle}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-[#FC3F1D] shrink-0">
                      {hit.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg ${
              toast.type === 'error'
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : toast.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-white dark:bg-[#16181F] border-[#E6E8EC] dark:border-[#262933] text-[#111216] dark:text-slate-100'
            }`}
          >
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
