import React, { useMemo, useState } from 'react';
import { Plus, ArrowDownLeft, ArrowUpRight, FileDown } from 'lucide-react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useErp } from '../../contexts/ErpContext';
import { db } from '../../lib/firebase';
import { formatDateFr, formatMoney, generateDocNumber, round2, todayIso } from '../../lib/format';
import { exportTablePdf } from '../../lib/exports';
import { createErpDoc, postManualJournalEntry } from '../../services/erpEngine';
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

export const TreasuryView: React.FC = () => {
  const { user, activeCompany, treasuryAccounts, payments, accounts, notify } = useErp();

  const [tab, setTab] = useState<'accounts' | 'payments'>('accounts');
  const [accModal, setAccModal] = useState(false);
  const [accForm, setAccForm] = useState({
    name: '',
    type: 'banque' as 'banque' | 'caisse',
    bankName: '',
    iban: '',
    accountCode: '521',
    balance: 0,
  });

  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState({
    direction: 'encaissement' as 'encaissement' | 'decaissement',
    partnerName: '',
    treasuryAccountId: '',
    method: 'virement' as 'virement' | 'especes' | 'cheque' | 'mobile_money',
    amount: 0,
    note: '',
  });

  const currency = activeCompany?.currency || 'XAF';

  const summary = useMemo(() => {
    const bankTotal = treasuryAccounts.filter((a) => a.type === 'banque').reduce((s, a) => s + a.balance, 0);
    const cashTotal = treasuryAccounts.filter((a) => a.type === 'caisse').reduce((s, a) => s + a.balance, 0);
    const inflows = payments.filter((p) => p.direction === 'encaissement').reduce((s, p) => s + p.amount, 0);
    const outflows = payments.filter((p) => p.direction === 'decaissement').reduce((s, p) => s + p.amount, 0);
    return { bankTotal, cashTotal, total: bankTotal + cashTotal, inflows, outflows };
  }, [treasuryAccounts, payments]);

  if (!activeCompany || !user) return null;
  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const createTreasuryAcc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createErpDoc(
        activeCompany.id,
        'treasuryAccounts',
        {
          ...accForm,
          accountCode: accForm.type === 'caisse' ? '571' : '521',
          balance: Number(accForm.balance) || 0,
          currency,
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Compte de trésorerie créé.', 'success');
      setAccModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur création compte', 'error');
    }
  };

  const recordDirectTreasuryMove = async (e: React.FormEvent) => {
    e.preventDefault();
    const tAcc = treasuryAccounts.find((t) => t.id === movForm.treasuryAccountId);
    const amount = Number(movForm.amount);
    if (!tAcc || amount <= 0) return;

    try {
      const payRef = doc(collection(db, `companies/${activeCompany.id}/payments`));
      const tRef = doc(db, `companies/${activeCompany.id}/treasuryAccounts`, tAcc.id);
      const payNum = generateDocNumber(movForm.direction === 'encaissement' ? 'ENC' : 'DEC');

      await runTransaction(db, async (tx) => {
        const tSnap = await tx.get(tRef);
        if (!tSnap.exists()) throw new Error('Compte introuvable.');
        const delta = movForm.direction === 'encaissement' ? amount : -amount;
        tx.update(tRef, {
          balance: round2((tSnap.data().balance || 0) + delta),
          updatedAt: serverTimestamp(),
        });
        tx.set(payRef, {
          number: payNum,
          direction: movForm.direction,
          partnerType: 'autre',
          partnerName: movForm.partnerName,
          treasuryAccountId: tAcc.id,
          treasuryAccountName: tAcc.name,
          method: movForm.method,
          amount,
          date: todayIso(),
          reference: payNum,
          note: movForm.note || 'Opération de trésorerie diverse',
          ownerId,
          memberUids,
          isDemo: false,
          createdAt: serverTimestamp(),
        });
      });

      const accCode = tAcc.accountCode || (tAcc.type === 'caisse' ? '571' : '521');
      await postManualJournalEntry({
        companyId: activeCompany.id,
        journalCode: tAcc.type === 'caisse' ? 'CA' : 'BQ',
        date: todayIso(),
        reference: payNum,
        label: `${movForm.direction === 'encaissement' ? 'Encaissement' : 'Décaissement'} — ${movForm.partnerName}`,
        lines:
          movForm.direction === 'encaissement'
            ? [
                { accountCode: accCode, accountName: tAcc.name, debit: amount, credit: 0 },
                { accountCode: '706', accountName: 'Services vendus', debit: 0, credit: amount },
              ]
            : [
                { accountCode: '624', accountName: 'Entretien, réparations et maintenance', debit: amount, credit: 0 },
                { accountCode: accCode, accountName: tAcc.name, debit: 0, credit: amount },
              ],
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });

      notify('Opération de trésorerie enregistrée.', 'success');
      setMovModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur trésorerie', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie, Banques & Caisse"
        subtitle="Suivi des soldes bancaires, caisses physiques, encaissements, décaissements et rapprochement comptable"
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                exportTablePdf(
                  'Rapport de Trésorerie',
                  `${activeCompany.name} · ${formatDateFr(todayIso())}`,
                  ['N° Pièce', 'Date', 'Sens', 'Tiers', 'Compte', 'Mode', 'Montant'],
                  payments.map((p) => [
                    p.number,
                    formatDateFr(p.date),
                    p.direction,
                    p.partnerName,
                    p.treasuryAccountName || '',
                    p.method,
                    formatMoney(p.amount, currency),
                  ]),
                  `Tresorerie_${todayIso()}`
                )
              }
              className={btnSecondaryCls}
            >
              <FileDown className="w-3.5 h-3.5" /> Rapport PDF
            </button>
            <button type="button" onClick={() => setAccModal(true)} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Compte / Caisse
            </button>
            <button
              type="button"
              onClick={() => {
                setMovForm({
                  direction: 'encaissement',
                  partnerName: '',
                  treasuryAccountId: treasuryAccounts[0]?.id || '',
                  method: 'virement',
                  amount: 0,
                  note: '',
                });
                setMovModal(true);
              }}
              className={btnPrimaryCls}
            >
              <Plus className="w-3.5 h-3.5" /> Opération de trésorerie
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Trésorerie consolidée</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {formatMoney(summary.total, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Disponibilités en banque</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatMoney(summary.bankTotal, currency)}</p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Encaissements cumulés</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-600">{formatMoney(summary.inflows, currency)}</p>
        </div>
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Décaissements cumulés</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-600">{formatMoney(summary.outflows, currency)}</p>
        </div>
      </div>

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'accounts', label: 'Comptes & Caisses', count: treasuryAccounts.length },
          { id: 'payments', label: 'Mouvements financiers', count: payments.length },
        ]}
      />

      {tab === 'accounts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {treasuryAccounts.map((acc) => (
            <div key={acc.id} className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <StatusLabel label={acc.type === 'banque' ? 'Banque (521)' : 'Caisse (571)'} tone="info" />
                  {acc.bankName && <span className="text-xs text-slate-500">{acc.bankName}</span>}
                </div>
                <p className="font-display font-semibold text-sm text-slate-900 dark:text-white mt-2">{acc.name}</p>
                {acc.iban && <p className="font-mono text-[11px] text-slate-400 mt-0.5">{acc.iban}</p>}
              </div>
              <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {formatMoney(acc.balance, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {payments.length === 0 ? (
            <EmptyState title="Aucun mouvement financier" description="Les encaissements et décaissements apparaîtront ici." />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">N° Pièce</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Sens</th>
                  <th className="py-3 px-4 font-medium">Tiers / Motif</th>
                  <th className="py-3 px-4 font-medium">Compte</th>
                  <th className="py-3 px-4 font-medium">Mode</th>
                  <th className="py-3 px-4 font-medium text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{p.number}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(p.date)}</td>
                    <td className="py-3 px-4">
                      {p.direction === 'encaissement' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <ArrowDownLeft className="w-3.5 h-3.5" /> Encaissement
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <ArrowUpRight className="w-3.5 h-3.5" /> Décaissement
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{p.partnerName}</p>
                      {p.invoiceNumber && <p className="font-mono text-[11px] text-slate-400">{p.invoiceNumber}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{p.treasuryAccountName}</td>
                    <td className="py-3 px-4 uppercase text-[11px]">{p.method}</td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${p.direction === 'encaissement' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {p.direction === 'encaissement' ? '+' : '-'} {formatMoney(p.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Treasury Account Modal */}
      <Modal open={accModal} title="Ajouter un compte bancaire ou une caisse" onClose={() => setAccModal(false)} maxWidth="max-w-md">
        <form onSubmit={createTreasuryAcc} className="space-y-4">
          <div>
            <label className={labelCls}>Type</label>
            <select className={inputCls} value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value as 'banque' | 'caisse' })}>
              <option value="banque">Compte bancaire (521)</option>
              <option value="caisse">Caisse physique (571)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Intitulé du compte *</label>
            <input required className={inputCls} value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} />
          </div>
          {accForm.type === 'banque' && (
            <>
              <div>
                <label className={labelCls}>Banque</label>
                <input className={inputCls} value={accForm.bankName} onChange={(e) => setAccForm({ ...accForm, bankName: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>IBAN / RIB</label>
                <input className={inputCls} value={accForm.iban} onChange={(e) => setAccForm({ ...accForm, iban: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Solde initial ({currency})</label>
            <input type="number" className={inputCls} value={accForm.balance} onChange={(e) => setAccForm({ ...accForm, balance: Number(e.target.value) })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAccModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Créer</button>
          </div>
        </form>
      </Modal>

      {/* Direct Treasury Move Modal */}
      <Modal open={movModal} title="Enregistrer une opération de trésorerie" onClose={() => setMovModal(false)} maxWidth="max-w-md">
        <form onSubmit={recordDirectTreasuryMove} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sens</label>
              <select className={inputCls} value={movForm.direction} onChange={(e) => setMovForm({ ...movForm, direction: e.target.value as typeof movForm.direction })}>
                <option value="encaissement">Encaissement (+)</option>
                <option value="decaissement">Décaissement (-)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Mode</label>
              <select className={inputCls} value={movForm.method} onChange={(e) => setMovForm({ ...movForm, method: e.target.value as typeof movForm.method })}>
                <option value="virement">Virement</option>
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Compte concerné *</label>
            <select required className={inputCls} value={movForm.treasuryAccountId} onChange={(e) => setMovForm({ ...movForm, treasuryAccountId: e.target.value })}>
              {treasuryAccounts.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tiers / Bénéficiaire *</label>
            <input required className={inputCls} value={movForm.partnerName} onChange={(e) => setMovForm({ ...movForm, partnerName: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Montant ({currency}) *</label>
            <input type="number" min="1" required className={inputCls} value={movForm.amount} onChange={(e) => setMovForm({ ...movForm, amount: Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Motif</label>
            <input className={inputCls} value={movForm.note} onChange={(e) => setMovForm({ ...movForm, note: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMovModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Valider</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
