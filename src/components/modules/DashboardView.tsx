import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { formatMoney, formatNumber } from '../../lib/format';
import { computePredictiveInsights } from '../../services/aiInsights';
import { PageHeader, StatusLabel, btnSecondaryCls } from '../ui/DataUI';

const CHART_COLORS = ['#1D4ED8', '#0EA5E9', '#10B981', '#F59E0B', '#6366F1'];

export const DashboardView: React.FC = () => {
  const {
    activeCompany,
    setActiveModule,
    customers,
    salesOrders,
    invoices,
    products,
    supplierInvoices,
    payrolls,
    payments,
    employees,
    opportunities,
    treasuryAccounts,
  } = useErp();

  const currency = activeCompany?.currency || 'XAF';

  // Real calculated KPIs from live Firestore data
  const kpis = useMemo(() => {
    const validInvoices = invoices.filter((i) => i.status !== 'annulee');
    const totalRevenue = validInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const unpaidInvoicesCount = validInvoices.filter((i) => i.balanceDue > 0).length;
    const totalStockValue = products.reduce((s, p) => s + (p.stockQty || 0) * (p.purchasePrice || 0), 0);

    const supplierExpenses = supplierInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const payrollExpenses = payrolls
      .filter((p) => p.status === 'payee' || p.status === 'validee')
      .reduce((s, p) => s + (p.netSalary || 0), 0);
    const totalExpenses = supplierExpenses + payrollExpenses;
    const financialResult = totalRevenue - totalExpenses;
    const activeEmployeesCount = employees.filter((e) => e.status !== 'sorti').length;

    return {
      totalRevenue,
      customersCount: customers.length,
      ordersCount: salesOrders.length,
      unpaidInvoicesCount,
      totalStockValue,
      totalExpenses,
      financialResult,
      employeesCount: activeEmployeesCount,
    };
  }, [invoices, products, supplierInvoices, payrolls, employees, customers, salesOrders]);

  // Chart 1: Monthly Revenue & Expenses evolution
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; ca: number; depenses: number }>();
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

    invoices
      .filter((i) => i.status !== 'annulee')
      .forEach((inv) => {
        const key = (inv.date || '').slice(0, 7);
        if (!key) return;
        const mIdx = parseInt(key.slice(5, 7), 10) - 1;
        const label = `${monthNames[mIdx] || key} ${key.slice(2, 4)}`;
        const curr = map.get(key) || { month: label, ca: 0, depenses: 0 };
        curr.ca += inv.total || 0;
        map.set(key, curr);
      });

    supplierInvoices.forEach((sinv) => {
      const key = (sinv.date || '').slice(0, 7);
      if (!key) return;
      const mIdx = parseInt(key.slice(5, 7), 10) - 1;
      const label = `${monthNames[mIdx] || key} ${key.slice(2, 4)}`;
      const curr = map.get(key) || { month: label, ca: 0, depenses: 0 };
      curr.depenses += sinv.total || 0;
      map.set(key, curr);
    });

    payments
      .filter((p) => p.direction === 'decaissement' && p.partnerType === 'autre')
      .forEach((p) => {
        const key = (p.date || '').slice(0, 7);
        if (!key) return;
        const mIdx = parseInt(key.slice(5, 7), 10) - 1;
        const label = `${monthNames[mIdx] || key} ${key.slice(2, 4)}`;
        const curr = map.get(key) || { month: label, ca: 0, depenses: 0 };
        curr.depenses += p.amount || 0;
        map.set(key, curr);
      });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [invoices, supplierInvoices, payments]);

  // Chart 2: Sales by Category
  const salesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    invoices
      .filter((i) => i.status !== 'annulee')
      .forEach((inv) => {
        inv.lines.forEach((line) => {
          const cat =
            line.categoryName ||
            products.find((p) => p.id === line.productId)?.categoryName ||
            'Autres';
          map.set(cat, (map.get(cat) || 0) + (line.lineTotal || 0));
        });
      });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [invoices, products]);

  // Chart 3: Top Sold Products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; total: number; qty: number }>();
    invoices
      .filter((i) => i.status !== 'annulee')
      .forEach((inv) => {
        inv.lines.forEach((line) => {
          const curr = map.get(line.name) || { name: line.name, total: 0, qty: 0 };
          curr.total += line.lineTotal || 0;
          curr.qty += line.qty || 0;
          map.set(line.name, curr);
        });
      });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [invoices]);

  // Chart 4: Commercial Pipeline Performance
  const commercialStages = useMemo(() => {
    const stageLabels: Record<string, string> = {
      prospection: 'Prospection',
      qualification: 'Qualification',
      proposition: 'Proposition',
      negociation: 'Négociation',
      gagnee: 'Gagnée',
      perdue: 'Perdue',
    };
    const map = new Map<string, number>();
    opportunities.forEach((opp) => {
      const label = stageLabels[opp.stage] || opp.stage;
      map.set(label, (map.get(label) || 0) + (opp.amount || 0));
    });
    return Array.from(map.entries()).map(([stage, montant]) => ({ stage, montant }));
  }, [opportunities]);

  const totalTreasury = treasuryAccounts.reduce((s, t) => s + (t.balance || 0), 0);
  const insights = useMemo(
    () =>
      computePredictiveInsights({
        products,
        invoices,
        opportunities,
        payments,
        totalTreasuryBalance: totalTreasury,
      }),
    [products, invoices, opportunities, payments, totalTreasury]
  );

  const kpiCards = [
    { label: 'Chiffre d’affaires total', value: formatMoney(kpis.totalRevenue, currency), module: 'sales' as const },
    { label: 'Nombre de clients', value: formatNumber(kpis.customersCount), module: 'crm' as const },
    { label: 'Nombre de commandes', value: formatNumber(kpis.ordersCount), module: 'sales' as const },
    { label: 'Factures impayées', value: formatNumber(kpis.unpaidInvoicesCount), module: 'sales' as const },
    { label: 'Valeur totale du stock', value: formatMoney(kpis.totalStockValue, currency), module: 'inventory' as const },
    { label: 'Dépenses totales', value: formatMoney(kpis.totalExpenses, currency), module: 'purchases' as const },
    {
      label: 'Résultat financier',
      value: formatMoney(kpis.financialResult, currency),
      module: 'accounting' as const,
      highlight: kpis.financialResult >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
    },
    { label: 'Nombre d’employés', value: formatNumber(kpis.employeesCount), module: 'hr' as const },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord exécutif"
        subtitle={`Indicateurs calculés en direct sur ${activeCompany?.name || 'votre entreprise'} · Norme ${activeCompany?.accountingStandard || 'OHADA'}`}
        actions={
          <>
            <button type="button" onClick={() => setActiveModule('sales')} className={btnSecondaryCls}>
              Nouvelle vente
            </button>
            <button type="button" onClick={() => setActiveModule('reporting')} className={btnSecondaryCls}>
              Rapports & Exports
            </button>
          </>
        }
      />

      {/* 8 Real KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setActiveModule(card.module)}
            className="text-left bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 hover:border-blue-500 rounded-lg p-4 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </div>
            <p className={`mt-2 font-mono text-xl font-bold tabular-nums ${card.highlight || 'text-slate-900 dark:text-white'}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Charts Row 1: Monthly Revenue + Expenses & Sales by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                Évolution mensuelle du chiffre d’affaires et des dépenses
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculé depuis les factures clients, achats fournisseurs et décaissements
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            {monthlySeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune transaction datée pour générer la courbe.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                  <Area type="monotone" dataKey="ca" name="Chiffre d'affaires" stroke="#1D4ED8" fill="#1D4ED8" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.12} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Ventes par catégorie
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Répartition du chiffre d’affaires facturé
          </p>
          <div className="h-52 w-full">
            {salesByCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune ligne facturée.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={76}
                    paddingAngle={2}
                  >
                    {salesByCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5 mt-2">
            {salesByCategory.map((item, i) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatMoney(item.value, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Top Products & Commercial Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Produits les plus vendus
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Classement par montant TTC facturé
          </p>
          <div className="h-56 w-full">
            {topProducts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune vente enregistrée.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                  <Bar dataKey="total" name="Ventes" fill="#1D4ED8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
            Performances commerciales (Pipeline CRM)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Volume des opportunités par étape
          </p>
          <div className="h-56 w-full">
            {commercialStages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Aucune opportunité CRM.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commercialStages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                  <Bar dataKey="montant" name="Montant" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Predictive Insights & Operational Alerts */}
      <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
              Recommandations analytiques et points d’attention
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synthèse automatique issue des modules Stocks, Ventes, CRM et Trésorerie
            </p>
          </div>
        </div>
        {insights.length === 0 ? (
          <p className="text-xs text-slate-500">Tous les indicateurs opérationnels sont nominaux.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="flex items-start justify-between gap-3 p-3.5 border border-slate-200 dark:border-slate-800 rounded-md"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertCircle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      ins.priority === 'haute' ? 'text-amber-600' : 'text-blue-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {ins.title}
                      </p>
                      <StatusLabel
                        label={ins.priority === 'haute' ? 'Prioritaire' : 'Analyse'}
                        tone={ins.priority === 'haute' ? 'warning' : 'info'}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ins.detail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule(ins.targetModule)}
                  className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline shrink-0"
                >
                  Ouvrir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
