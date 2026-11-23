import React, { useState } from 'react';
import { Plus, PackageCheck, CreditCard, Check, X, Trash2 } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { addDaysIso, formatDateFr, formatMoney, generateDocNumber, todayIso } from '../../lib/format';
import {
  computeDocumentTotals,
  createErpDoc,
  deleteErpDoc,
  receivePurchaseOrderWithStock,
  recordSupplierInvoicePayment,
  updateErpDoc,
} from '../../services/erpEngine';
import { DocumentLine, PurchaseOrder, Supplier, SupplierInvoice } from '../../types/erp';
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

export const PurchasesView: React.FC = () => {
  const {
    user,
    activeCompany,
    suppliers,
    products,
    warehouses,
    purchaseRequests,
    purchaseOrders,
    supplierInvoices,
    accounts,
    treasuryAccounts,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'orders' | 'requests' | 'invoices' | 'suppliers'>('orders');

  // Supplier Modal
  const [supModal, setSupModal] = useState(false);
  const [supForm, setSupForm] = useState({
    code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    paymentTerms: '30 jours net',
  });

  // Purchase Order Modal
  const [poModal, setPoModal] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poWarehouseId, setPoWarehouseId] = useState('');
  const [poLines, setPoLines] = useState<DocumentLine[]>([]);

  // Purchase Request Modal
  const [reqModal, setReqModal] = useState(false);
  const [reqDept, setReqDept] = useState('Logistique & Stocks');
  const [reqNotes, setReqNotes] = useState('');
  const [reqLines, setReqLines] = useState<DocumentLine[]>([]);

  // Supplier Payment Modal
  const [paySinv, setPaySinv] = useState<SupplierInvoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payTreasuryId, setPayTreasuryId] = useState('');
  const [payMethod, setPayMethod] = useState<'virement' | 'especes' | 'cheque' | 'mobile_money'>('virement');
  const [busy, setBusy] = useState(false);

  const currency = activeCompany?.currency || 'XAF';
  if (!activeCompany || !user) return null;

  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openPoBuilder = () => {
    setPoSupplierId(suppliers[0]?.id || '');
    setPoWarehouseId(warehouses[0]?.id || '');
    if (products.length > 0) {
      const p = products[0];
      setPoLines([
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 5,
          unitPrice: p.purchasePrice,
          discountPct: 0,
          taxRate: p.taxRate ?? 19.25,
          lineTotal: p.purchasePrice * 5,
        },
      ]);
    }
    setPoModal(true);
  };

  const openReqBuilder = () => {
    setReqNotes('');
    if (products.length > 0) {
      const p = products[0];
      setReqLines([
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 5,
          unitPrice: p.purchasePrice,
          discountPct: 0,
          taxRate: 0,
          lineTotal: p.purchasePrice * 5,
        },
      ]);
    }
    setReqModal(true);
  };

  const saveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createErpDoc(
        activeCompany.id,
        'suppliers',
        {
          ...supForm,
          code: supForm.code || `FRN-${String(suppliers.length + 1).padStart(3, '0')}`,
          balancePayable: 0,
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Fournisseur enregistré.', 'success');
      setSupModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur fournisseur', 'error');
    }
  };

  const savePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup || poLines.length === 0) {
      notify('Sélectionnez un fournisseur et au moins un article.', 'warning');
      return;
    }
    const totals = computeDocumentTotals(poLines);
    setBusy(true);
    try {
      await createErpDoc(
        activeCompany.id,
        'purchaseOrders',
        {
          number: generateDocNumber('BCF'),
          supplierId: sup.id,
          supplierName: sup.name,
          warehouseId: poWarehouseId || warehouses[0]?.id || 'default',
          date: todayIso(),
          expectedDate: addDaysIso(7),
          status: 'envoyee',
          lines: totals.lines,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Commande fournisseur créée.', 'success');
      setPoModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur commande fournisseur', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveReq = async (e: React.FormEvent) => {
    e.preventDefault();
    const totals = computeDocumentTotals(reqLines);
    try {
      await createErpDoc(
        activeCompany.id,
        'purchaseRequests',
        {
          number: generateDocNumber('DA'),
          requesterName: user.displayName || user.email || 'Collaborateur',
          departmentName: reqDept,
          date: todayIso(),
          status: 'en_attente',
          lines: totals.lines,
          estimatedTotal: totals.total,
          notes: reqNotes,
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Demande d’achat soumise.', 'success');
      setReqModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur demande d’achat', 'error');
    }
  };

  const handleReceivePo = async (po: PurchaseOrder) => {
    const whName = warehouses.find((w) => w.id === po.warehouseId)?.name || 'Entrepôt Central';
    try {
      await receivePurchaseOrderWithStock({
        companyId: activeCompany.id,
        po,
        warehouseName: whName,
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Marchandises réceptionnées : stock augmenté et facture fournisseur générée.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur réception', 'error');
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paySinv) return;
    const treas = treasuryAccounts.find((t) => t.id === payTreasuryId);
    if (!treas) return;
    setBusy(true);
    try {
      await recordSupplierInvoicePayment({
        companyId: activeCompany.id,
        sinv: paySinv,
        treasuryAccount: treas,
        amount: Number(payAmount),
        method: payMethod,
        reference: generateDocNumber('DEC'),
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Règlement fournisseur enregistré.`, 'success');
      setPaySinv(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur règlement', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achats & Approvisionnements"
        subtitle="Fournisseurs, demandes internes, bons de commande, réceptions en stock et factures fournisseurs"
        actions={
          <>
            <button type="button" onClick={openReqBuilder} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Demande d’achat
            </button>
            <button type="button" onClick={() => setSupModal(true)} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Fournisseur
            </button>
            <button type="button" onClick={openPoBuilder} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Commande fournisseur
            </button>
          </>
        }
      />

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'orders', label: 'Commandes fournisseurs', count: purchaseOrders.length },
          { id: 'requests', label: 'Demandes d’achat', count: purchaseRequests.length },
          { id: 'invoices', label: 'Factures fournisseurs', count: supplierInvoices.length },
          { id: 'suppliers', label: 'Fournisseurs', count: suppliers.length },
        ]}
      />

      {tab === 'orders' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {purchaseOrders.length === 0 ? (
            <EmptyState
              title="Aucune commande fournisseur"
              description="Créez un bon de commande pour réapprovisionner vos entrepôts."
              actionLabel="Nouvelle commande fournisseur"
              onAction={openPoBuilder}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">N° Commande</th>
                  <th className="py-3 px-4 font-medium">Fournisseur</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold">{po.number}</td>
                    <td className="py-3 px-4 font-medium">{po.supplierName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(po.date)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(po.total, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={po.status} tone={po.status === 'receptionnee' ? 'success' : 'info'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {po.status !== 'receptionnee' && po.status !== 'annulee' && (
                        <button
                          type="button"
                          onClick={() => handleReceivePo(po)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                        >
                          <PackageCheck className="w-3 h-3 inline mr-1" />
                          Réceptionner en stock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {purchaseRequests.length === 0 ? (
            <EmptyState
              title="Aucune demande d’achat"
              description="Soumettez une demande interne pour approbation par la direction."
              actionLabel="Créer une demande"
              onAction={openReqBuilder}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">N° Demande</th>
                  <th className="py-3 px-4 font-medium">Demandeur / Service</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium text-right">Estimation</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {purchaseRequests.map((req) => (
                  <tr key={req.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{req.number}</td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{req.requesterName}</p>
                      <p className="text-slate-400">{req.departmentName}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(req.date)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatMoney(req.estimatedTotal, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel
                        label={req.status}
                        tone={req.status === 'approuvee' ? 'success' : req.status === 'rejetee' ? 'danger' : 'warning'}
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {req.status === 'en_attente' && (
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() => updateErpDoc(activeCompany.id, 'purchaseRequests', req.id, { status: 'approuvee' })}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Approuver"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => updateErpDoc(activeCompany.id, 'purchaseRequests', req.id, { status: 'rejetee' })}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Rejeter"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {supplierInvoices.length === 0 ? (
            <EmptyState
              title="Aucune facture fournisseur"
              description="Les factures fournisseurs sont générées lors de la réception des commandes."
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">N° Facture</th>
                  <th className="py-3 px-4 font-medium">Fournisseur</th>
                  <th className="py-3 px-4 font-medium">Échéance</th>
                  <th className="py-3 px-4 font-medium text-right">Total</th>
                  <th className="py-3 px-4 font-medium text-right">Reste à payer</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {supplierInvoices.map((sinv) => (
                  <tr key={sinv.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{sinv.number}</td>
                    <td className="py-3 px-4 font-medium">{sinv.supplierName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(sinv.dueDate)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(sinv.total, currency)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-600">
                      {formatMoney(sinv.balanceDue, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={sinv.status} tone={sinv.status === 'payee' ? 'success' : 'warning'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {sinv.balanceDue > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaySinv(sinv);
                            setPayAmount(sinv.balanceDue);
                            setPayTreasuryId(treasuryAccounts[0]?.id || '');
                          }}
                          className="px-2 py-1 text-[11px] font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded"
                        >
                          <CreditCard className="w-3 h-3 inline mr-1" />
                          Régler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {suppliers.length === 0 ? (
            <EmptyState
              title="Aucun fournisseur"
              description="Ajoutez vos partenaires fournisseurs."
              actionLabel="Nouveau fournisseur"
              onAction={() => setSupModal(true)}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Fournisseur</th>
                  <th className="py-3 px-4 font-medium">Coordonnées</th>
                  <th className="py-3 px-4 font-medium">Conditions</th>
                  <th className="py-3 px-4 font-medium text-right">Dette fournisseur</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-mono">{s.code}</td>
                    <td className="py-3 px-4 font-semibold">{s.name}</td>
                    <td className="py-3 px-4 text-slate-500">{s.email || s.phone || '—'}</td>
                    <td className="py-3 px-4">{s.paymentTerms || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(s.balancePayable, currency)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'suppliers', s.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Supplier Modal */}
      <Modal open={supModal} title="Nouveau fournisseur" onClose={() => setSupModal(false)}>
        <form onSubmit={saveSupplier} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code</label>
              <input className={inputCls} value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} placeholder="FRN-003" />
            </div>
            <div>
              <label className={labelCls}>Raison sociale *</label>
              <input required className={inputCls} value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Conditions de paiement</label>
              <input className={inputCls} value={supForm.paymentTerms} onChange={(e) => setSupForm({ ...supForm, paymentTerms: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSupModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* PO Modal */}
      <Modal open={poModal} title="Nouvelle commande fournisseur" onClose={() => setPoModal(false)} maxWidth="max-w-3xl">
        <form onSubmit={savePo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fournisseur *</label>
              <select required className={inputCls} value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Entrepôt de réception *</label>
              <select required className={inputCls} value={poWarehouseId} onChange={(e) => setPoWarehouseId(e.target.value)}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            {poLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <select
                    className={inputCls}
                    value={line.productId}
                    onChange={(e) => {
                      const p = products.find((item) => item.id === e.target.value);
                      if (p) {
                        setPoLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, productId: p.id, sku: p.sku, name: p.name, unitPrice: p.purchasePrice } : l))
                        );
                      }
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input type="number" min="1" className={inputCls} value={line.qty} onChange={(e) => setPoLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) || 1 } : l)))} />
                </div>
                <div className="col-span-3">
                  <input type="number" min="0" className={inputCls} value={line.unitPrice} onChange={(e) => setPoLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPoModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy} className={btnPrimaryCls}>Créer la commande</button>
          </div>
        </form>
      </Modal>

      {/* Request Modal */}
      <Modal open={reqModal} title="Nouvelle demande d’achat" onClose={() => setReqModal(false)}>
        <form onSubmit={saveReq} className="space-y-4">
          <div>
            <label className={labelCls}>Département</label>
            <input className={inputCls} value={reqDept} onChange={(e) => setReqDept(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Justification / Besoin</label>
            <textarea rows={2} className={inputCls} value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReqModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Soumettre</button>
          </div>
        </form>
      </Modal>

      {/* Supplier Payment Modal */}
      <Modal open={paySinv !== null} title={`Régler fournisseur · ${paySinv?.number || ''}`} onClose={() => setPaySinv(null)} maxWidth="max-w-md">
        <form onSubmit={handlePaySupplier} className="space-y-4">
          <div>
            <label className={labelCls}>Montant ({currency})</label>
            <input type="number" required min="1" max={paySinv?.balanceDue || 0} className={inputCls} value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Compte émetteur</label>
            <select required className={inputCls} value={payTreasuryId} onChange={(e) => setPayTreasuryId(e.target.value)}>
              {treasuryAccounts.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({formatMoney(t.balance, currency)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Mode</label>
            <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}>
              <option value="virement">Virement</option>
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPaySinv(null)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy} className={btnPrimaryCls}>Valider le paiement</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
