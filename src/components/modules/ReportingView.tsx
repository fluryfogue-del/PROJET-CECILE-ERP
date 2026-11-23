import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { formatMoney, todayIso } from '../../lib/format';
import { exportTablePdf, exportWorkbookExcel } from '../../lib/exports';
import { PageHeader, btnSecondaryCls, inputCls, labelCls } from '../ui/DataUI';

export const ReportingView: React.FC = () => {
  const {
    activeCompany,
    invoices,
    supplierInvoices,
    products,
    employees,
    opportunities,
    payrolls,
  } = useErp();

  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2027-12-31');

  const currency = activeCompany?.currency || 'XAF';

  const metrics = useMemo(() => {
    const inPeriod = (d?: string) => (!d ? true : d >= startDate && d <= endDate);

    const filtInvoices = invoices.filter((i) => i.status !== 'annulee' && inPeriod(i.date));
    const filtPurchases = supplierInvoices.filter((s) => inPeriod(s.date));

    const ca = filtInvoices.reduce((s, i) => s + i.total, 0);
    const encaisse = filtInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const achats = filtPurchases.reduce((s, i) => s + i.total, 0);
    const paie = payrolls.filter((p) => p.status !== 'brouillon').reduce((s, p) => s + p.netSalary, 0);
    const depenses = achats + paie;
    const benefice = ca - depenses;
    const marge = ca > 0 ? Math.round((benefice / ca) * 100) : 0;

    const stockValuation = products.reduce((s, p) => s + p.stockQty * p.purchasePrice, 0);
    const lowStock = products.filter((p) => p.stockQty <= p.minStock).length;

    const deptChart = Array.from(
      employees.reduce((m, e) => {
        m.set(e.departmentName, (m.get(e.departmentName) || 0) + e.baseSalary);
        return m;
      }, new Map<string, number>())
    ).map(([dept, masse]) => ({ dept, masse }));

    const wonOpps = opportunities.filter((o) => o.stage === 'gagnee').length;
    const totalOpps = opportunities.length;

    return {
      ca,
      encaisse,
      depenses,
      benefice,
      marge,
      stockValuation,
      lowStock,
      deptChart,
      wonOpps,
      totalOpps,
      filtInvoices,
    };
  }, [startDate, endDate, invoices, supplierInvoices, payrolls, products, employees, opportunities]);

  if (!activeCompany) return null;

  const exportFullExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Synthèse Financière',
          rows: [
            { Indicateur: 'Chiffre d’affaires TTC', Valeur: metrics.ca },
            { Indicateur: 'Montant encaissé', Valeur: metrics.encaisse },
            { Indicateur: 'Dépenses totales', Valeur: metrics.depenses },
            { Indicateur: 'Bénéfice net estimé', Valeur: metrics.benefice },
            { Indicateur: 'Valeur des stocks', Valeur: metrics.stockValuation },
          ],
        },
        {
          name: 'Ventes Période',
          rows: metrics.filtInvoices.map((i) => ({
            Numero: i.number,
            Date: i.date,
            Client: i.customerName,
            TotalTTC: i.total,
            Paye: i.paidAmount,
            Statut: i.status,
          })),
        },
        {
          name: 'État des Stocks',
          rows: products.map((p) => ({
            SKU: p.sku,
            Article: p.name,
            Stock: p.stockQty,
            SeuilMin: p.minStock,
            ValeurAchat: p.stockQty * p.purchasePrice,
          })),
        },
      ],
      `Reporting_NEXUS_${todayIso()}`
    );
  };

  const exportSummaryPdf = () => {
    exportTablePdf(
      'Rapport Analytique & Financier',
      `${activeCompany.name} · Période du ${startDate} au ${endDate}`,
      ['Indicateur', 'Valeur calculée'],
      [
        ['Chiffre d’affaires (période)', formatMoney(metrics.ca, currency)],
        ['Montant encaissé', formatMoney(metrics.encaisse, currency)],
        ['Dépenses (Achats + Paie)', formatMoney(metrics.depenses, currency)],
        ['Bénéfice net', formatMoney(metrics.benefice, currency)],
        ['Taux de marge net', `${metrics.marge} %`],
        ['Valorisation des stocks', formatMoney(metrics.stockValuation, currency)],
        ['Articles sous seuil', String(metrics.lowStock)],
        ['Opportunités gagnées', `${metrics.wonOpps} / ${metrics.totalOpps}`],
      ],
      `Rapport_NEXUS_${todayIso()}`
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporting & Analytics"
        subtitle="Analyse financière, commerciale, logistique et RH filtrée par période avec exports PDF & Excel"
        actions={
          <>
            <button type="button" onClick={exportSummaryPdf} className={btnSecondaryCls}>
              <FileDown className="w-3.5 h-3.5" /> Rapport PDF
            </button>
            <button type="button" onClick={exportFullExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Classeur Excel
            </button>
          </>
        }
      />

      {/* Period Filter */}
      <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className={labelCls}>Date de début</label>
          <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Date de fin</label>
          <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Chiffre d’affaires période</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatMoney(metrics.ca, currency)}</p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Dépenses période</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-600">{formatMoney(metrics.depenses, currency)}</p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Bénéfice net ({metrics.marge}% marge)</p>
          <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${metrics.benefice >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(metrics.benefice, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Opportunités gagnées</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {metrics.wonOpps} / {metrics.totalOpps}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Masse salariale par département</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.deptChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                <Bar dataKey="masse" name="Masse salariale" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <h3 className="font-display text-sm font-semibold mb-4">Synthèse financière comparative</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { label: 'Chiffre d’affaires', montant: metrics.ca },
                  { label: 'Encaissements', montant: metrics.encaisse },
                  { label: 'Dépenses', montant: metrics.depenses },
                  { label: 'Bénéfice net', montant: metrics.benefice },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.18} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatMoney(Number(val ?? 0), currency)} />
                <Bar dataKey="montant" name="Montant" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
