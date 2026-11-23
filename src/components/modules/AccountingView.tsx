import React, { useMemo, useState } from 'react';
import { Plus, FileDown, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { formatDateFr, formatMoney, todayIso } from '../../lib/format';
import { exportTablePdf, exportWorkbookExcel } from '../../lib/exports';
import { createErpDoc, postManualJournalEntry } from '../../services/erpEngine';
import { JournalLine } from '../../types/erp';
import {
  EmptyState,
  Modal,
  PageHeader,
  SegmentedTabs,
  StatusLabel,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
} from '../ui/DataUI';

export const AccountingView: React.FC = () => {
  const {
    user,
    activeCompany,
    accounts,
    journalEntries,
    customers,
    suppliers,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'journal' | 'accounts' | 'ledger' | 'balance' | 'statements'>('journal');
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('411');

  // New Account Modal
  const [accModal, setAccModal] = useState(false);
  const [accForm, setAccForm] = useState({
    code: '',
    name: '',
    classNumber: 6,
    type: 'charge' as 'actif' | 'passif' | 'charge' | 'produit',
  });

  // New Journal Entry Modal
  const [entryModal, setEntryModal] = useState(false);
  const [journalCode, setJournalCode] = useState<'VE' | 'AC' | 'BQ' | 'CA' | 'OD'>('OD');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [entryRef, setEntryRef] = useState('');
  const [entryLabel, setEntryLabel] = useState('');
  const [entryLines, setEntryLines] = useState<JournalLine[]>([
    { accountCode: '624', accountName: 'Entretien, réparations et maintenance', debit: 0, credit: 0 },
    { accountCode: '521', accountName: 'Banques locales', debit: 0, credit: 0 },
  ]);

  const currency = activeCompany?.currency || 'XAF';

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  // Grand Livre lines for selected account
  const ledgerRows = useMemo(() => {
    const rows: Array<{
      date: string;
      number: string;
      journal: string;
      label: string;
      debit: number;
      credit: number;
    }> = [];
    journalEntries.forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountCode === selectedAccountCode) {
          rows.push({
            date: entry.date,
            number: entry.number,
            journal: entry.journalCode,
            label: entry.label,
            debit: line.debit,
            credit: line.credit,
          });
        }
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [journalEntries, selectedAccountCode]);

  // Bilan & Compte de résultat (OHADA)
  const statements = useMemo(() => {
    const netBalance = (acc: typeof accounts[0]) => (acc.balanceDebit || 0) - (acc.balanceCredit || 0);
    const actifs = sortedAccounts.filter((a) => a.type === 'actif');
    const passifs = sortedAccounts.filter((a) => a.type === 'passif');
    const charges = sortedAccounts.filter((a) => a.type === 'charge');
    const produits = sortedAccounts.filter((a) => a.type === 'produit');

    const totalActif = actifs.reduce((s, a) => s + Math.max(0, netBalance(a)), 0);
    const totalPassif = passifs.reduce((s, a) => s + Math.max(0, -netBalance(a)), 0);
    const totalCharges = charges.reduce((s, a) => s + Math.max(0, netBalance(a)), 0);
    const totalProduits = produits.reduce((s, a) => s + Math.max(0, -netBalance(a)), 0);
    const resultatNet = totalProduits - totalCharges;

    const totalCreances = customers.reduce((s, c) => s + (c.balanceDue || 0), 0);
    const totalDettes = suppliers.reduce((s, sup) => s + (sup.balancePayable || 0), 0);

    return {
      actifs,
      passifs,
      charges,
      produits,
      totalActif,
      totalPassif,
      totalCharges,
      totalProduits,
      resultatNet,
      totalCreances,
      totalDettes,
    };
  }, [sortedAccounts, customers, suppliers]);

  if (!activeCompany || !user) return null;
  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const totalEntryDebit = entryLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalEntryCredit = entryLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createErpDoc(
        activeCompany.id,
        'accounts',
        {
          code: accForm.code.trim(),
          name: accForm.name.trim(),
          classNumber: Number(accForm.classNumber),
          type: accForm.type,
          balanceDebit: 0,
          balanceCredit: 0,
          isSystem: false,
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Compte comptable ajouté au plan.', 'success');
      setAccModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur compte', 'error');
    }
  };

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalEntryDebit <= 0 || Math.abs(totalEntryDebit - totalEntryCredit) >= 0.01) {
      notify('L’écriture doit être strictement équilibrée (Débit = Crédit > 0).', 'error');
      return;
    }
    try {
      await postManualJournalEntry({
        companyId: activeCompany.id,
        journalCode,
        date: entryDate,
        reference: entryRef,
        label: entryLabel,
        lines: entryLines.map((l) => ({
          ...l,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify('Écriture comptable validée et reportée au grand livre.', 'success');
      setEntryModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur écriture', 'error');
    }
  };

  const exportAccountingExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Balance Comptable',
          rows: sortedAccounts.map((a) => ({
            Code: a.code,
            Intitule: a.name,
            Classe: a.classNumber,
            Type: a.type,
            TotalDebit: a.balanceDebit,
            TotalCredit: a.balanceCredit,
            Solde: a.balanceDebit - a.balanceCredit,
          })),
        },
        {
          name: 'Journal Comptable',
          rows: journalEntries.map((j) => ({
            Numero: j.number,
            Date: j.date,
            Journal: j.journalCode,
            Libelle: j.label,
            Debit: j.totalDebit,
            Credit: j.totalCredit,
          })),
        },
      ],
      `Comptabilite_${activeCompany.accountingStandard}_${todayIso()}`
    );
  };

  const exportBalancePdf = () => {
    exportTablePdf(
      `Balance Générale (${activeCompany.accountingStandard})`,
      `${activeCompany.name} · Éditée le ${formatDateFr(todayIso())}`,
      ['Compte', 'Intitulé', 'Classe', 'Total Débit', 'Total Crédit', 'Solde'],
      sortedAccounts.map((a) => [
        a.code,
        a.name,
        String(a.classNumber),
        formatMoney(a.balanceDebit, currency),
        formatMoney(a.balanceCredit, currency),
        formatMoney(a.balanceDebit - a.balanceCredit, currency),
      ]),
      `Balance_OHADA_${todayIso()}`
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Comptabilité Générale (${activeCompany.accountingStandard})`}
        subtitle="Plan comptable OHADA classes 1–8, journal en partie double, grand livre, balance, bilan et compte de résultat"
        actions={
          <>
            <button type="button" onClick={exportBalancePdf} className={btnSecondaryCls}>
              <FileDown className="w-3.5 h-3.5" /> Balance PDF
            </button>
            <button type="button" onClick={exportAccountingExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
            </button>
            <button type="button" onClick={() => setAccModal(true)} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Compte
            </button>
            <button type="button" onClick={() => setEntryModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Saisir écriture
            </button>
          </>
        }
      />

      {/* Receivables / Payables / Net Result Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Créances clients (411)</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {formatMoney(statements.totalCreances, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Dettes fournisseurs (401)</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {formatMoney(statements.totalDettes, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Résultat comptable net (Produits - Charges)</p>
          <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${statements.resultatNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(statements.resultatNet, currency)}
          </p>
        </div>
      </div>

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'journal', label: 'Journal comptable', count: journalEntries.length },
          { id: 'accounts', label: 'Plan comptable', count: accounts.length },
          { id: 'ledger', label: 'Grand livre' },
          { id: 'balance', label: 'Balance' },
          { id: 'statements', label: 'Bilan & Résultat' },
        ]}
      />

      {tab === 'journal' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
          {journalEntries.length === 0 ? (
            <EmptyState
              title="Aucune écriture comptable"
              description="Les factures, paiements et saisies manuelles génèrent automatiquement des écritures équilibrées."
              actionLabel="Saisir une écriture"
              onAction={() => setEntryModal(true)}
            />
          ) : (
            journalEntries.map((entry) => (
              <div key={entry.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <StatusLabel label={entry.journalCode} tone="info" />
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">{entry.number}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{entry.label}</span>
                  </div>
                  <span className="text-slate-500">{formatDateFr(entry.date)}</span>
                </div>
                <table className="w-full text-xs border-collapse">
                  <tbody>
                    {entry.lines.map((l, idx) => (
                      <tr key={idx} className="border-t border-slate-100 dark:border-slate-800/70">
                        <td className="py-1.5 w-24 font-mono text-blue-700 dark:text-blue-400">{l.accountCode}</td>
                        <td className="py-1.5 text-slate-700 dark:text-slate-300">{l.accountName}</td>
                        <td className="py-1.5 text-right font-mono tabular-nums w-36">
                          {l.debit > 0 ? formatMoney(l.debit, currency) : '—'}
                        </td>
                        <td className="py-1.5 text-right font-mono tabular-nums w-36">
                          {l.credit > 0 ? formatMoney(l.credit, currency) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'accounts' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Compte</th>
                <th className="py-3 px-4 font-medium">Intitulé OHADA</th>
                <th className="py-3 px-4 font-medium">Classe</th>
                <th className="py-3 px-4 font-medium">Nature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sortedAccounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="py-2.5 px-4 font-mono font-semibold text-blue-700 dark:text-blue-400">{acc.code}</td>
                  <td className="py-2.5 px-4 font-medium">{acc.name}</td>
                  <td className="py-2.5 px-4 font-mono">Classe {acc.classNumber}</td>
                  <td className="py-2.5 px-4"><StatusLabel label={acc.type} tone="neutral" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Compte du Grand Livre :</label>
            <select
              className="px-3 py-1.5 text-xs bg-white dark:bg-[#0B1426] border border-slate-300 dark:border-slate-700 rounded-md"
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
            >
              {sortedAccounts.map((a) => (
                <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {ledgerRows.length === 0 ? (
              <EmptyState title="Aucun mouvement sur ce compte" description="Sélectionnez un autre compte ou saisissez une écriture." />
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Pièce</th>
                    <th className="py-3 px-4 font-medium">Libellé</th>
                    <th className="py-3 px-4 font-medium text-right">Débit</th>
                    <th className="py-3 px-4 font-medium text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {ledgerRows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-4 text-slate-500">{formatDateFr(r.date)}</td>
                      <td className="py-2.5 px-4 font-mono">{r.number}</td>
                      <td className="py-2.5 px-4">{r.label}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{r.debit > 0 ? formatMoney(r.debit, currency) : '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{r.credit > 0 ? formatMoney(r.credit, currency) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'balance' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-3 px-4 font-medium">Compte</th>
                <th className="py-3 px-4 font-medium">Intitulé</th>
                <th className="py-3 px-4 font-medium text-right">Mvt Débit</th>
                <th className="py-3 px-4 font-medium text-right">Mvt Crédit</th>
                <th className="py-3 px-4 font-medium text-right">Solde Débiteur</th>
                <th className="py-3 px-4 font-medium text-right">Solde Créditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {sortedAccounts.map((a) => {
                const net = a.balanceDebit - a.balanceCredit;
                return (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 font-mono font-semibold">{a.code}</td>
                    <td className="py-2.5 px-4">{a.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatMoney(a.balanceDebit, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatMoney(a.balanceCredit, currency)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                      {net > 0 ? formatMoney(net, currency) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium">
                      {net < 0 ? formatMoney(-net, currency) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'statements' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bilan */}
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Bilan Synthétique ({activeCompany.accountingStandard})
            </h3>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-blue-700 dark:text-blue-400">ACTIF</p>
              {statements.actifs.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.code} · {a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(Math.max(0, a.balanceDebit - a.balanceCredit), currency)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>Total Actif</span>
                <span className="font-mono tabular-nums">{formatMoney(statements.totalActif, currency)}</span>
              </div>
            </div>
            <div className="space-y-2 text-xs pt-2">
              <p className="font-semibold text-blue-700 dark:text-blue-400">PASSIF</p>
              {statements.passifs.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.code} · {a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(Math.max(0, a.balanceCredit - a.balanceDebit), currency)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>Total Passif</span>
                <span className="font-mono tabular-nums">{formatMoney(statements.totalPassif, currency)}</span>
              </div>
            </div>
          </div>

          {/* Compte de résultat */}
          <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Compte de Résultat
            </h3>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">PRODUITS (Classe 7)</p>
              {statements.produits.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.code} · {a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(Math.max(0, a.balanceCredit - a.balanceDebit), currency)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>Total Produits</span>
                <span className="font-mono tabular-nums">{formatMoney(statements.totalProduits, currency)}</span>
              </div>
            </div>
            <div className="space-y-2 text-xs pt-2">
              <p className="font-semibold text-amber-700 dark:text-amber-400">CHARGES (Classe 6)</p>
              {statements.charges.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span>{a.code} · {a.name}</span>
                  <span className="font-mono tabular-nums">{formatMoney(Math.max(0, a.balanceDebit - a.balanceCredit), currency)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-2">
                <span>Total Charges</span>
                <span className="font-mono tabular-nums">{formatMoney(statements.totalCharges, currency)}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-300 dark:border-slate-700 flex justify-between text-sm font-bold">
              <span>Résultat Net de l’Exercice</span>
              <span className={`font-mono tabular-nums ${statements.resultatNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatMoney(statements.resultatNet, currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* New Account Modal */}
      <Modal open={accModal} title="Ajouter un compte comptable" onClose={() => setAccModal(false)} maxWidth="max-w-md">
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Numéro de compte *</label>
              <input required className={inputCls} value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} placeholder="605" />
            </div>
            <div>
              <label className={labelCls}>Classe OHADA (1–8)</label>
              <input type="number" min="1" max="8" required className={inputCls} value={accForm.classNumber} onChange={(e) => setAccForm({ ...accForm, classNumber: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Intitulé du compte *</label>
            <input required className={inputCls} value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Nature</label>
            <select className={inputCls} value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value as typeof accForm.type })}>
              <option value="actif">Actif</option>
              <option value="passif">Passif</option>
              <option value="charge">Charge</option>
              <option value="produit">Produit</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAccModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Créer</button>
          </div>
        </form>
      </Modal>

      {/* Journal Entry Modal */}
      <Modal open={entryModal} title="Saisir une écriture comptable (Partie double)" onClose={() => setEntryModal(false)} maxWidth="max-w-2xl">
        <form onSubmit={handlePostEntry} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Journal</label>
              <select className={inputCls} value={journalCode} onChange={(e) => setJournalCode(e.target.value as typeof journalCode)}>
                <option value="OD">OD — Opérations diverses</option>
                <option value="VE">VE — Ventes</option>
                <option value="AC">AC — Achats</option>
                <option value="BQ">BQ — Banque</option>
                <option value="CA">CA — Caisse</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" required className={inputCls} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Référence</label>
              <input className={inputCls} value={entryRef} onChange={(e) => setEntryRef(e.target.value)} placeholder="PIECE-001" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Libellé de l’opération *</label>
            <input required className={inputCls} value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} placeholder="Ex : Règlement facture maintenance informatique" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Lignes d’imputation</span>
              <button
                type="button"
                onClick={() => setEntryLines((p) => [...p, { accountCode: sortedAccounts[0]?.code || '601', accountName: sortedAccounts[0]?.name || '', debit: 0, credit: 0 }])}
                className="text-blue-700 dark:text-blue-400 hover:underline"
              >
                + Ajouter ligne
              </button>
            </div>
            {entryLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <select
                    className={inputCls}
                    value={line.accountCode}
                    onChange={(e) => {
                      const acc = sortedAccounts.find((a) => a.code === e.target.value);
                      if (acc) {
                        setEntryLines((prev) => prev.map((l, i) => (i === idx ? { ...l, accountCode: acc.code, accountName: acc.name } : l)));
                      }
                    }}
                  >
                    {sortedAccounts.map((a) => (
                      <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" placeholder="Débit" className={inputCls} value={line.debit} onChange={(e) => setEntryLines((prev) => prev.map((l, i) => (i === idx ? { ...l, debit: Number(e.target.value) } : l)))} />
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" placeholder="Crédit" className={inputCls} value={line.credit} onChange={(e) => setEntryLines((prev) => prev.map((l, i) => (i === idx ? { ...l, credit: Number(e.target.value) } : l)))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>Total Débit : {formatMoney(totalEntryDebit, currency)}</span>
            <span>Total Crédit : {formatMoney(totalEntryCredit, currency)}</span>
            <StatusLabel
              label={Math.abs(totalEntryDebit - totalEntryCredit) < 0.01 && totalEntryDebit > 0 ? 'Équilibrée' : 'Déséquilibrée'}
              tone={Math.abs(totalEntryDebit - totalEntryCredit) < 0.01 && totalEntryDebit > 0 ? 'success' : 'warning'}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEntryModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Valider l’écriture</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
