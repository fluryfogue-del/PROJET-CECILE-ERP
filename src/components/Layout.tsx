import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
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
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { ModuleId } from '../types/erp';
import { updateErpDoc } from '../services/erpEngine';
import { formatMoney } from '../lib/format';

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
    activeModule,
    setActiveModule,
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

  const navItems: NavItem[] = [
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

  const visibleNav = navItems.filter((item) => hasModuleAccess(item.id));
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
    const hits: Array<{ type: string; title: string; subtitle: string; module: ModuleId }> = [];

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
  }, [searchQuery, customers, leads, products, invoices, salesOrders, suppliers, employees, activeCompany]);

  const markAllRead = async () => {
    if (!activeCompany) return;
    for (const n of unreadNotifs) {
      await updateErpDoc(activeCompany.id, 'notifications', n.id, { read: true }, false);
    }
  };

  const activeNavLabel = navItems.find((n) => n.id === activeModule)?.label || 'NEXUS ERP';

  const SidebarContent = (
    <div className="h-full flex flex-col bg-[#0B1426] text-slate-200 border-r border-slate-800">
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-blue-600 text-white flex items-center justify-center font-display font-bold text-sm">
            NX
          </div>
          <div>
            <p className="font-display font-bold text-sm tracking-tight text-white leading-none">
              {t.brand}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Projet CECILE</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white"
          aria-label="Fermer le menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Company Switcher */}
      <div className="px-3 py-3 border-b border-slate-800/80">
        <label className="block text-[11px] text-slate-400 mb-1 px-1">Société active</label>
        <div className="relative">
          <Building2 className="w-3.5 h-3.5 text-blue-400 absolute left-2.5 top-2.5 pointer-events-none" />
          <select
            value={activeCompany?.id || ''}
            onChange={(e) => setActiveCompanyId(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-900 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.currency})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {visibleNav.map((item) => {
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
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <div className="px-2 py-1">
          <p className="text-xs font-medium text-white truncate">
            {user?.displayName || user?.email}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t.common.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070D19] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 h-full">{SidebarContent}</div>
          <div
            className="flex-1 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-30 bg-white dark:bg-[#0B1426] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                {activeCompany?.name || 'NEXUS ERP'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="text-blue-700 dark:text-blue-400 font-medium truncate">
                {activeNavLabel}
              </span>
              {activeCompany?.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-medium whitespace-nowrap">
                    {t.common.demoBadge}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md hover:border-blue-500 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Recherche globale</span>
              <kbd className="font-mono text-[10px] px-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
                Ctrl+K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="sm:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              aria-label="Recherche globale"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((p) => !p)}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-mono font-bold bg-red-600 text-white rounded">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-40">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Notifications ({unreadNotifs.length} non lues)
                    </span>
                    {unreadNotifs.length > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Tout marquer lu
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
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
                          className={`p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            n.read ? 'opacity-60' : 'bg-blue-50/40 dark:bg-blue-950/20'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle
                              className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                                n.severity === 'warning' || n.severity === 'error'
                                  ? 'text-amber-600'
                                  : 'text-blue-600'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
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
              className="px-2 py-1.5 text-xs font-mono font-medium border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Changer la langue"
            >
              {language.toUpperCase()}
            </button>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
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
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 p-4">
          <div className="w-full max-w-xl bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.common.searchPlaceholder}
                className="w-full bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                Échap
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchQuery.trim() === '' ? (
                <p className="p-6 text-xs text-slate-500 text-center">
                  Tapez un nom de client, un code article SKU, un numéro de facture ou un employé.
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
                      setActiveModule(hit.module);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {hit.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {hit.subtitle}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400 shrink-0">
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
      <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-md border text-xs font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : toast.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-white dark:bg-[#0B1426] border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
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
