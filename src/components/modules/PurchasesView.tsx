import React, { useState } from 'react';
import {
  Plus,
  PackageCheck,
  CreditCard,
  Check,
  X,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  FileDown,
  AlertCircle,
} from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { addDaysIso, formatDateFr, formatMoney, generateDocNumber, todayIso } from '../../lib/format';
import {
  exportPurchaseOrderPdf,
  exportRowsCsv,
  exportSupplierInvoicePdf,
  exportWorkbookExcel,
} from '../../lib/exports';
import {
  computeDocumentTotals,
  createErpDoc,
  deleteErpDoc,
  receivePurchaseOrderWithStock,
  recordSupplierInvoicePayment,
  updateErpDoc,
} from '../../services/erpEngine';
import { DocumentLine, PurchaseOrder, SupplierInvoice } from '../../types/erp';
import { ImportSpreadsheetModal } from '../ImportSpreadsheetModal';
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
    setActiveModule,
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
  const [poReceiveNow, setPoReceiveNow] = useState(false);

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
  const [importOpen, setImportOpen] = useState(false);

  const currency = activeCompany?.currency || 'XAF';
  if (!activeCompany || !user) return null;

  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openPoBuilder = () => {
    setPoSupplierId(suppliers[0]?.id || '');
    setPoWarehouseId(warehouses[0]?.id || '');
    setPoReceiveNow(false);
    if (products.length > 0) {
      const p = products[0];
      setPoLines([
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 1,
          unitPrice: p.purchasePrice,
          discountPct: 0,
          taxRate: p.taxRate ?? 0,
          lineTotal: p.purchasePrice,
        },
      ]);
    } else {
      setPoLines([]);
    }
    setPoModal(true);
  };

  const addPoLine = () => {
    if (products.length === 0) return;
    const p = products[0];
    setPoLines((prev) => [
      ...prev,
      {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        qty: 1,
        unitPrice: p.purchasePrice,
        discountPct: 0,
        taxRate: p.taxRate ?? 0,
        lineTotal: p.purchasePrice,
      },
    ]);
  };

  const poTotals = computeDocumentTotals(poLines);

  const openReqBuilder = () => {
    setReqNotes('');
    if (products.length > 0) {
      const p = products[0];
      setReqLines([
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          qty: 1,
          unitPrice: p.purchasePrice,
          discountPct: 0,
          taxRate: 0,
          lineTotal: p.purchasePrice,
        },
      ]);
    } else {
      setReqLines([]);
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
    const whId = poWarehouseId || warehouses[0]?.id || 'default';
    const whName = warehouses.find((w) => w.id === whId)?.name || 'Entrepôt Central';
    const poNumber = generateDocNumber('BCF');
    const dateStr = todayIso();
    const expectedDateStr = addDaysIso(7);

    setBusy(true);
    try {
      const poId = await createErpDoc(
        activeCompany.id,
        'purchaseOrders',
        {
          number: poNumber,
          supplierId: sup.id,
          supplierName: sup.name,
          warehouseId: whId,
          date: dateStr,
          expectedDate: expectedDateStr,
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

      if (poReceiveNow) {
        const createdPo: PurchaseOrder = {
          id: poId,
          number: poNumber,
          supplierId: sup.id,
          supplierName: sup.name,
          warehouseId: whId,
          date: dateStr,
          expectedDate: expectedDateStr,
          status: 'envoyee',
          lines: totals.lines,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          ownerId,
          memberUids,
          isDemo: false,
        };
        await receivePurchaseOrderWithStock({
          companyId: activeCompany.id,
          po: createdPo,
          warehouseName: whName,
          accounts,
          uid: user.uid,
          email: user.email || '',
          ownerId,
          memberUids,
        });
        notify('Achat réceptionné : stock mis à jour et facture fournisseur générée.', 'success');
        setTab('invoices');
      } else {
        notify('Commande fournisseur créée.', 'success');
        setTab('orders');
      }
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
      setTab('invoices');
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

  const exportPurchasesCsv = () => {
    if (tab === 'suppliers') {
      exportRowsCsv(
        suppliers.map((s) => ({
          Code: s.code,
          Nom: s.name,
          Email: s.email || '',
          Telephone: s.phone || '',
          Adresse: s.address || '',
          NIF: s.taxId || '',
          ConditionsPaiement: s.paymentTerms || '',
          Dette: s.balancePayable,
        })),
        `Fournisseurs_${todayIso()}`
      );
    } else if (tab === 'requests') {
      exportRowsCsv(
        purchaseRequests.map((r) => ({
          Numero: r.number,
          Demandeur: r.requesterName,
          Departement: r.departmentName,
          Date: r.date,
          Estimation: r.estimatedTotal,
          Statut: r.status,
        })),
        `Demandes_Achat_${todayIso()}`
      );
    } else if (tab === 'invoices') {
      exportRowsCsv(
        supplierInvoices.map((i) => ({
          Numero: i.number,
          Fournisseur: i.supplierName,
          Date: i.date,
          Echeance: i.dueDate,
          Total: i.total,
          ResteAPayer: i.balanceDue,
          Statut: i.status,
        })),
        `Factures_Fournisseurs_${todayIso()}`
      );
    } else {
      exportRowsCsv(
        purchaseOrders.map((p) => ({
          Numero: p.number,
          Fournisseur: p.supplierName,
          Date: p.date,
          TotalTTC: p.total,
          Statut: p.status,
        })),
        `Commandes_Fournisseurs_${todayIso()}`
      );
    }
    notify('Export CSV téléchargé.', 'success');
  };

  const exportPurchasesExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Fournisseurs',
          rows: suppliers.map((s) => ({
            Code: s.code,
            Nom: s.name,
            Email: s.email || '',
            Telephone: s.phone || '',
            ConditionsPaiement: s.paymentTerms || '',
            Dette: s.balancePayable,
          })),
        },
        {
          name: 'Commandes',
          rows: purchaseOrders.map((p) => ({
            Numero: p.number,
            Fournisseur: p.supplierName,
            Date: p.date,
            TotalTTC: p.total,
            Statut: p.status,
          })),
        },
        {
          name: 'Factures fournisseurs',
          rows: supplierInvoices.map((i) => ({
            Numero: i.number,
            Fournisseur: i.supplierName,
            Echeance: i.dueDate,
            Total: i.total,
            ResteAPayer: i.balanceDue,
            Statut: i.status,
          })),
        },
      ],
      `Achats_FUREX_${todayIso()}`
    );
    notify('Classeur Excel Achats téléchargé.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achats & Approvisionnements"
        subtitle="Fournisseurs, commandes d'achat, réception automatique en stock et factures fournisseurs exportables"
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className={btnSecondaryCls}>
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button type="button" onClick={exportPurchasesCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportPurchasesExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
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
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {purchaseOrders.length === 0 ? (
            <EmptyState
              title="Aucune commande fournisseur"
              description="Créez un bon de commande pour réapprovisionner vos entrepôts et générer la facture fournisseur."
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
                      <div className="inline-flex items-center gap-1.5">
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
                        <button
                          type="button"
                          onClick={() => {
                            exportPurchaseOrderPdf(po, activeCompany, currency);
                            notify(`Bon de commande ${po.number} exporté en PDF.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <FileDown className="w-3 h-3 inline mr-1" />
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
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
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {supplierInvoices.length === 0 ? (
            <EmptyState
              title="Aucune facture fournisseur"
              description="Les factures fournisseurs sont générées lors de la réception des commandes d’achat."
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
                  <th className="py-3 px-4 font-medium text-right">Exports & Action</th>
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
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {sinv.balanceDue > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaySinv(sinv);
                              setPayAmount(sinv.balanceDue);
                              setPayTreasuryId(treasuryAccounts[0]?.id || '');
                            }}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded"
                          >
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            Régler
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const linked = purchaseOrders.find((p) => p.id === sinv.purchaseOrderId);
                            exportSupplierInvoicePdf(sinv, linked, activeCompany, currency);
                            notify(`Facture fournisseur ${sinv.number} exportée en PDF.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <FileDown className="w-3 h-3 inline mr-1" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            exportRowsCsv(
                              [
                                {
                                  Numero: sinv.number,
                                  Fournisseur: sinv.supplierName,
                                  Date: sinv.date,
                                  Echeance: sinv.dueDate,
                                  Total: sinv.total,
                                  Paye: sinv.paidAmount,
                                  ResteAPayer: sinv.balanceDue,
                                  Statut: sinv.status,
                                },
                              ],
                              sinv.number
                            );
                            notify(`Facture ${sinv.number} exportée en CSV.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Download className="w-3 h-3 inline mr-1" />
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
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
                    <td className="py-3 px-4 text-slate-500">{s.email || s.phone || '-'}</td>
                    <td className="py-3 px-4">{s.paymentTerms || '-'}</td>
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
              <input className={inputCls} value={supForm.code} onChange={(e) => setSupForm({ ...supForm, code: e.target.value })} placeholder="FRN-001" />
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
          {(suppliers.length === 0 || products.length === 0) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {suppliers.length === 0 && products.length === 0
                    ? 'Ajoutez un fournisseur et un produit pour passer une commande d’achat.'
                    : suppliers.length === 0
                    ? 'Aucun fournisseur enregistré.'
                    : 'Aucun article enregistré dans le module Stocks.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {suppliers.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPoModal(false);
                      setSupModal(true);
                    }}
                    className="px-2.5 py-1 bg-amber-600 text-white font-semibold rounded text-[11px]"
                  >
                    Créer un fournisseur
                  </button>
                )}
                {products.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPoModal(false);
                      setActiveModule('inventory');
                    }}
                    className="px-2.5 py-1 bg-amber-600 text-white font-semibold rounded text-[11px]"
                  >
                    Créer un produit
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fournisseur *</label>
              <select required className={inputCls} value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                <option value="">Sélectionner un fournisseur</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Entrepôt de réception *</label>
              <select required className={inputCls} value={poWarehouseId} onChange={(e) => setPoWarehouseId(e.target.value)}>
                <option value="">Sélectionner un entrepôt</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lignes de commande</span>
              <button
                type="button"
                onClick={addPoLine}
                disabled={products.length === 0}
                className="text-xs font-medium text-[#FC3F1D] hover:underline disabled:opacity-50"
              >
                + Ajouter une ligne
              </button>
            </div>

            {poLines.length > 0 && (
              <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-[11px] font-medium text-slate-500">
                <div className="col-span-5">Article</div>
                <div className="col-span-2">Qté</div>
                <div className="col-span-2">P.U. Achat HT</div>
                <div className="col-span-2">TVA %</div>
                <div className="col-span-1 text-right">Suppr.</div>
              </div>
            )}

            {poLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
                <div className="col-span-12 sm:col-span-5">
                  <select
                    className={inputCls}
                    value={line.productId}
                    onChange={(e) => {
                      const p = products.find((item) => item.id === e.target.value);
                      if (p) {
                        setPoLines((prev) =>
                          prev.map((l, i) =>
                            i === idx
                              ? { ...l, productId: p.id, sku: p.sku, name: p.name, unitPrice: p.purchasePrice, taxRate: p.taxRate ?? 0 }
                              : l
                          )
                        );
                      }
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    className={inputCls}
                    placeholder="Qté"
                    value={line.qty}
                    onChange={(e) => setPoLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) || 1 } : l)))}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="P.U."
                    value={line.unitPrice}
                    onChange={(e) => setPoLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)))}
                  />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={inputCls}
                    placeholder="TVA %"
                    value={line.taxRate}
                    onChange={(e) => setPoLines((prev) => prev.map((l, i) => (i === idx ? { ...l, taxRate: Number(e.target.value) || 0 } : l)))}
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => setPoLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={poReceiveNow}
              onChange={(e) => setPoReceiveNow(e.target.checked)}
              className="rounded border-slate-300 text-[#FC3F1D] focus:ring-[#FC3F1D]"
            />
            <span>Réceptionner immédiatement en stock et générer la facture fournisseur</span>
          </label>

          <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="text-right space-y-1 text-xs font-mono tabular-nums">
              <p className="text-slate-500">Sous-total HT : {formatMoney(poTotals.subtotal, currency)}</p>
              <p className="text-slate-500">TVA : {formatMoney(poTotals.taxTotal, currency)}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Total TTC : {formatMoney(poTotals.total, currency)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPoModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy || suppliers.length === 0 || poLines.length === 0} className={btnPrimaryCls}>
              {busy ? 'Traitement...' : poReceiveNow ? 'Acheter & Générer facture' : 'Créer la commande'}
            </button>
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

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="suppliers"
      />
    </div>
  );
};
