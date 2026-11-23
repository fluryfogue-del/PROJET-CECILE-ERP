import React, { useState } from 'react';
import { Plus, FileDown, CheckCircle2, Receipt, CreditCard, ArrowRight, Trash2, Download, FileSpreadsheet, AlertCircle, Eye } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { addDaysIso, formatDateFr, formatMoney, generateDocNumber, todayIso } from '../../lib/format';
import {
  exportInvoicePdf,
  exportQuoteOrOrderPdf,
  exportRowsCsv,
  exportSingleInvoiceCsv,
  exportSingleInvoiceExcel,
  exportWorkbookExcel,
} from '../../lib/exports';
import {
  computeDocumentTotals,
  convertQuoteToSalesOrder,
  createDirectInvoice,
  createErpDoc,
  createInvoiceFromOrder,
  deleteErpDoc,
  recordCustomerInvoicePayment,
  updateInvoiceStatus,
  validateSalesOrderWithStock,
} from '../../services/erpEngine';
import { DocumentLine, Invoice, Quote, SalesOrder } from '../../types/erp';
import { InvoicePreviewModal } from './InvoicePreviewModal';
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

export const SalesView: React.FC = () => {
  const {
    user,
    activeCompany,
    setActiveModule,
    customers,
    products,
    warehouses,
    quotes,
    salesOrders,
    invoices,
    accounts,
    treasuryAccounts,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'invoices' | 'orders' | 'quotes'>('invoices');

  // Quote/Order/Invoice Builder Modal
  const [docModal, setDocModal] = useState<'quote' | 'order' | 'invoice' | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dueDate, setDueDate] = useState(addDaysIso(30));
  const [paymentTerms, setPaymentTerms] = useState(
    activeCompany?.invoicePaymentTerms || 'Paiement à 30 jours net'
  );
  const [invoiceStatus, setInvoiceStatus] = useState<'emise' | 'brouillon'>('emise');
  const [deductStock, setDeductStock] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DocumentLine[]>([]);

  // Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Payment Modal
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payTreasuryId, setPayTreasuryId] = useState('');
  const [payMethod, setPayMethod] = useState<'virement' | 'especes' | 'cheque' | 'mobile_money'>('virement');
  const [payRef, setPayRef] = useState('');
  const [busy, setBusy] = useState(false);

  const currency = activeCompany?.currency || 'XAF';
  if (!activeCompany || !user) return null;

  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openBuilder = (kind: 'quote' | 'order' | 'invoice') => {
    setCustomerId(customers[0]?.id || '');
    setWarehouseId(warehouses[0]?.id || '');
    setDueDate(addDaysIso(30));
    setPaymentTerms(activeCompany?.invoicePaymentTerms || 'Paiement à 30 jours net');
    setInvoiceStatus('emise');
    setDeductStock(products.some((p) => p.stockQty > 0));
    setNotes(activeCompany?.invoiceNotesDefault || '');
    if (products.length > 0) {
      const p = products[0];
      setLines([
        {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          categoryName: p.categoryName,
          qty: 1,
          unitPrice: p.salePrice,
          discountPct: 0,
          taxRate: p.taxRate ?? 0,
          lineTotal: p.salePrice,
        },
      ]);
    } else {
      setLines([]);
    }
    setDocModal(kind);
  };

  const addLine = () => {
    if (products.length === 0) return;
    const p = products[0];
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        qty: 1,
        unitPrice: p.salePrice,
        discountPct: 0,
        taxRate: p.taxRate ?? 0,
        lineTotal: p.salePrice,
      },
    ]);
  };

  const updateLineProduct = (idx: number, prodId: string) => {
    const p = products.find((item) => item.id === prodId);
    if (!p) return;
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId: p.id,
              sku: p.sku,
              name: p.name,
              categoryName: p.categoryName,
              unitPrice: p.salePrice,
              taxRate: p.taxRate ?? 0,
            }
          : l
      )
    );
  };

  const totals = computeDocumentTotals(lines);

  const handleSaveDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === customerId);
    if (!cust || lines.length === 0) {
      notify('Sélectionnez un client et au moins un article.', 'warning');
      return;
    }

    setBusy(true);
    try {
      if (docModal === 'quote') {
        await createErpDoc(
          activeCompany.id,
          'quotes',
          {
            number: generateDocNumber('DEV'),
            customerId: cust.id,
            customerName: cust.name,
            date: todayIso(),
            validUntil: addDaysIso(30),
            status: 'envoye',
            lines: totals.lines,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            notes,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Devis créé avec succès.', 'success');
        setTab('quotes');
      } else if (docModal === 'order') {
        const whId = warehouseId || warehouses[0]?.id || 'default';
        await createErpDoc(
          activeCompany.id,
          'salesOrders',
          {
            number: generateDocNumber('CMD'),
            customerId: cust.id,
            customerName: cust.name,
            warehouseId: whId,
            date: todayIso(),
            status: 'brouillon',
            lines: totals.lines,
            subtotal: totals.subtotal,
            discountTotal: totals.discountTotal,
            taxTotal: totals.taxTotal,
            total: totals.total,
            notes,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Commande client enregistrée.', 'success');
        setTab('orders');
      } else if (docModal === 'invoice') {
        const whId = warehouseId || warehouses[0]?.id || 'default';
        const whName = warehouses.find((w) => w.id === whId)?.name || 'Entrepôt Principal';
        const created = await createDirectInvoice({
          companyId: activeCompany.id,
          customerId: cust.id,
          customerName: cust.name,
          customerEmail: cust.email,
          warehouseId: whId,
          warehouseName: whName,
          lines: totals.lines,
          dueDate,
          paymentTerms,
          notes,
          deductStock,
          status: invoiceStatus,
          accounts,
          uid: user.uid,
          email: user.email || '',
          ownerId,
          memberUids,
        });
        notify(
          `Facture ${created.number} (${invoiceStatus === 'brouillon' ? 'brouillon' : 'émise'}) enregistrée.`,
          'success'
        );
        setTab('invoices');
      }
      setDocModal(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur lors de la création', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConvertQuote = async (quote: Quote) => {
    const whId = warehouses[0]?.id;
    if (!whId) {
      notify('Aucun entrepôt configuré.', 'error');
      return;
    }
    try {
      await convertQuoteToSalesOrder({
        companyId: activeCompany.id,
        quote,
        warehouseId: whId,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Devis ${quote.number} converti en commande client.`, 'success');
      setTab('orders');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur de conversion', 'error');
    }
  };

  const handleValidateOrder = async (order: SalesOrder) => {
    const whName = warehouses.find((w) => w.id === order.warehouseId)?.name || 'Entrepôt principal';
    try {
      await validateSalesOrderWithStock({
        companyId: activeCompany.id,
        order,
        warehouseName: whName,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Commande ${order.number} validée et stock mis à jour.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Validation impossible', 'error');
    }
  };

  const handleInvoiceOrder = async (order: SalesOrder) => {
    const cust = customers.find((c) => c.id === order.customerId);
    try {
      await createInvoiceFromOrder({
        companyId: activeCompany.id,
        order,
        customerEmail: cust?.email,
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Facture créée et comptabilisée en OHADA.`, 'success');
      setTab('invoices');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Facturation impossible', 'error');
    }
  };

  const openPaymentModal = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(inv.balanceDue);
    setPayTreasuryId(treasuryAccounts[0]?.id || '');
    setPayMethod('virement');
    setPayRef('');
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoice) return;
    const treas = treasuryAccounts.find((t) => t.id === payTreasuryId);
    if (!treas) {
      notify('Sélectionnez un compte bancaire ou une caisse.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await recordCustomerInvoicePayment({
        companyId: activeCompany.id,
        invoice: payInvoice,
        treasuryAccount: treas,
        amount: Number(payAmount),
        method: payMethod,
        reference: payRef,
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Paiement enregistré sur ${payInvoice.number}.`, 'success');
      setPayInvoice(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur paiement', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleEmitDraftInvoice = async (inv: Invoice) => {
    setBusy(true);
    try {
      await updateInvoiceStatus(activeCompany.id, inv.id, 'emise');
      notify(`Facture ${inv.number} émise et comptabilisée.`, 'success');
      setPreviewInvoice(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur émission', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelInvoice = async (inv: Invoice) => {
    setBusy(true);
    try {
      await updateInvoiceStatus(activeCompany.id, inv.id, 'annulee');
      notify(`Facture ${inv.number} annulée.`, 'info');
      setPreviewInvoice(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Annulation impossible', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportSalesCsv = () => {
    if (tab === 'orders') {
      exportRowsCsv(
        salesOrders.map((o) => ({
          Numero: o.number,
          Client: o.customerName,
          Date: o.date,
          SousTotalHT: o.subtotal,
          Remises: o.discountTotal,
          TVA: o.taxTotal,
          TotalTTC: o.total,
          Statut: o.status,
        })),
        `Commandes_Clients_${todayIso()}`
      );
    } else if (tab === 'quotes') {
      exportRowsCsv(
        quotes.map((q) => ({
          Numero: q.number,
          Client: q.customerName,
          Date: q.date,
          Validite: q.validUntil,
          SousTotalHT: q.subtotal,
          TVA: q.taxTotal,
          TotalTTC: q.total,
          Statut: q.status,
        })),
        `Devis_Clients_${todayIso()}`
      );
    } else {
      exportRowsCsv(
        invoices.map((i) => ({
          Numero: i.number,
          Client: i.customerName,
          Date: i.date,
          Echeance: i.dueDate,
          TotalTTC: i.total,
          Paye: i.paidAmount,
          SoldeDu: i.balanceDue,
          Statut: i.status,
        })),
        `Factures_Clients_${todayIso()}`
      );
    }
    notify('Export CSV téléchargé.', 'success');
  };

  const exportSalesExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Factures clients',
          rows: invoices.map((i) => ({
            Numero: i.number,
            Client: i.customerName,
            Date: i.date,
            Echeance: i.dueDate,
            TotalTTC: i.total,
            Paye: i.paidAmount,
            SoldeDu: i.balanceDue,
            Statut: i.status,
          })),
        },
        {
          name: 'Commandes clients',
          rows: salesOrders.map((o) => ({
            Numero: o.number,
            Client: o.customerName,
            Date: o.date,
            TotalTTC: o.total,
            Statut: o.status,
          })),
        },
        {
          name: 'Devis',
          rows: quotes.map((q) => ({
            Numero: q.number,
            Client: q.customerName,
            Date: q.date,
            Validite: q.validUntil,
            TotalTTC: q.total,
            Statut: q.status,
          })),
        },
      ],
      `Ventes_FUREX_${todayIso()}`
    );
    notify('Classeur Excel Ventes téléchargé.', 'success');
  };

  const modalTitle =
    docModal === 'quote'
      ? 'Créer un devis client'
      : docModal === 'order'
      ? 'Créer une commande client'
      : 'Générer une facture client';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ventes, Commandes & Facturation"
        subtitle="Créez directement une facture exportable (PDF, CSV, Excel) ou suivez le cycle Devis → Commande → Facture"
        actions={
          <>
            <button type="button" onClick={exportSalesCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportSalesExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" onClick={() => openBuilder('quote')} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouveau devis
            </button>
            <button type="button" onClick={() => openBuilder('order')} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvelle commande
            </button>
            <button type="button" onClick={() => openBuilder('invoice')} className={btnPrimaryCls}>
              <Receipt className="w-3.5 h-3.5" /> Nouvelle facture
            </button>
          </>
        }
      />

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'invoices', label: 'Factures clients', count: invoices.length },
          { id: 'orders', label: 'Commandes clients', count: salesOrders.length },
          { id: 'quotes', label: 'Devis', count: quotes.length },
        ]}
      />

      {tab === 'invoices' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {invoices.length === 0 ? (
            <EmptyState
              title="Aucune facture client"
              description="Créez directement une facture client ou validez une commande pour générer la facture et l'exporter en PDF, CSV ou Excel."
              actionLabel="Nouvelle facture"
              onAction={() => openBuilder('invoice')}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">N° Facture</th>
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Émission / Échéance</th>
                  <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                  <th className="py-3 px-4 font-medium text-right">Payé</th>
                  <th className="py-3 px-4 font-medium text-right">Solde dû</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Exports & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="hover:text-[#FC3F1D] hover:underline cursor-pointer"
                      >
                        {inv.number}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-medium">{inv.customerName}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {formatDateFr(inv.date)} · {formatDateFr(inv.dueDate)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(inv.total, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(inv.paidAmount, currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                      {formatMoney(inv.balanceDue, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel
                        label={inv.status}
                        tone={
                          inv.status === 'payee'
                            ? 'success'
                            : inv.status === 'partielle'
                            ? 'warning'
                            : inv.status === 'annulee'
                            ? 'danger'
                            : inv.status === 'brouillon'
                            ? 'neutral'
                            : 'info'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => setPreviewInvoice(inv)}
                          className="px-2 py-1 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 rounded hover:border-[#FC3F1D] hover:text-[#FC3F1D]"
                          title="Aperçu modèle facture"
                        >
                          <Eye className="w-3 h-3 inline mr-1" />
                          Aperçu
                        </button>
                        {inv.status === 'brouillon' && (
                          <button
                            type="button"
                            onClick={() => handleEmitDraftInvoice(inv)}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded"
                          >
                            Émettre
                          </button>
                        )}
                        {inv.balanceDue > 0 && inv.status !== 'brouillon' && inv.status !== 'annulee' && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(inv)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          >
                            <CreditCard className="w-3 h-3 inline mr-1" />
                            Encaisser
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            exportInvoicePdf(inv, activeCompany, currency);
                            notify(`Facture ${inv.number} exportée en PDF.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Télécharger PDF"
                        >
                          <FileDown className="w-3 h-3 inline mr-1" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            exportSingleInvoiceExcel(inv, activeCompany);
                            notify(`Facture ${inv.number} exportée en Excel.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Télécharger Excel"
                        >
                          <FileSpreadsheet className="w-3 h-3 inline mr-1" />
                          Excel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            exportSingleInvoiceCsv(inv);
                            notify(`Facture ${inv.number} exportée en CSV.`, 'success');
                          }}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Télécharger CSV"
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

      {tab === 'orders' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {salesOrders.length === 0 ? (
            <EmptyState
              title="Aucune commande client"
              description="Créez une commande ou convertissez un devis accepté."
              actionLabel="Nouvelle commande"
              onAction={() => openBuilder('order')}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">N° Commande</th>
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {salesOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold">{order.number}</td>
                    <td className="py-3 px-4 font-medium">{order.customerName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(order.date)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(order.total, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel
                        label={order.status}
                        tone={
                          order.status === 'facturee'
                            ? 'success'
                            : order.status === 'validee'
                            ? 'info'
                            : order.status === 'annulee'
                            ? 'danger'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {order.status === 'brouillon' && (
                          <button
                            type="button"
                            onClick={() => handleValidateOrder(order)}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded"
                          >
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                            Valider & Sortir Stock
                          </button>
                        )}
                        {order.status === 'validee' && (
                          <button
                            type="button"
                            onClick={() => handleInvoiceOrder(order)}
                            className="px-2 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          >
                            <Receipt className="w-3 h-3 inline mr-1" />
                            Facturer
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => exportQuoteOrOrderPdf('BON DE COMMANDE', order, activeCompany, currency)}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
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

      {tab === 'quotes' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {quotes.length === 0 ? (
            <EmptyState
              title="Aucun devis enregistré"
              description="Établissez un devis avec remises et TVA puis transformez-le en commande client en un clic."
              actionLabel="Créer un devis"
              onAction={() => openBuilder('quote')}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">N° Devis</th>
                  <th className="py-3 px-4 font-medium">Client</th>
                  <th className="py-3 px-4 font-medium">Validité</th>
                  <th className="py-3 px-4 font-medium text-right">Total TTC</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-semibold">{q.number}</td>
                    <td className="py-3 px-4 font-medium">{q.customerName}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(q.validUntil)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(q.total, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={q.status} tone={q.status === 'converti' ? 'success' : 'info'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {q.status !== 'converti' && (
                          <button
                            type="button"
                            onClick={() => handleConvertQuote(q)}
                            className="px-2 py-1 text-[11px] font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded"
                          >
                            <ArrowRight className="w-3 h-3 inline mr-1" />
                            Convertir en commande
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => exportQuoteOrOrderPdf('DEVIS', q, activeCompany, currency)}
                          className="px-2 py-1 text-[11px] font-medium border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteErpDoc(activeCompany.id, 'quotes', q.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Quote / SalesOrder / Direct Invoice Builder Modal */}
      <Modal
        open={docModal !== null}
        title={modalTitle}
        onClose={() => setDocModal(null)}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveDoc} className="space-y-4">
          {(customers.length === 0 || products.length === 0) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {customers.length === 0 && products.length === 0
                    ? 'Créez d’abord un client (CRM) et un produit (Stocks) pour établir un document.'
                    : customers.length === 0
                    ? 'Aucun client enregistré dans le module CRM.'
                    : 'Aucun article enregistré dans le catalogue Stocks.'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {customers.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocModal(null);
                      setActiveModule('crm');
                    }}
                    className="px-2.5 py-1 bg-amber-600 text-white font-semibold rounded text-[11px]"
                  >
                    Créer un client
                  </button>
                )}
                {products.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setDocModal(null);
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Client *</label>
              <select required className={inputCls} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Sélectionner un client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {(docModal === 'order' || docModal === 'invoice') && (
              <div>
                <label className={labelCls}>Entrepôt d’expédition *</label>
                <select required className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">Sélectionner un entrepôt</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
            {docModal === 'invoice' && (
              <div>
                <label className={labelCls}>Date d’échéance</label>
                <input
                  type="date"
                  className={inputCls}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {docModal === 'invoice' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Conditions de paiement</label>
                  <input
                    className={inputCls}
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Paiement à 30 jours net"
                  />
                </div>
                <div>
                  <label className={labelCls}>Mode de création</label>
                  <select
                    className={inputCls}
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as 'emise' | 'brouillon')}
                  >
                    <option value="emise">Émettre immédiatement (Comptabiliser OHADA)</option>
                    <option value="brouillon">Enregistrer en brouillon</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="rounded border-slate-300 text-[#FC3F1D] focus:ring-[#FC3F1D]"
                />
                <span>
                  Déduire automatiquement les quantités du stock de l’entrepôt (si facture émise)
                </span>
              </label>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Lignes d’articles</span>
              <button
                type="button"
                onClick={addLine}
                disabled={products.length === 0}
                className="text-xs font-medium text-[#FC3F1D] hover:underline disabled:opacity-50"
              >
                + Ajouter une ligne
              </button>
            </div>

            {lines.length > 0 && (
              <div className="hidden sm:grid grid-cols-12 gap-2 px-2 text-[11px] font-medium text-slate-500">
                <div className="col-span-4">Article</div>
                <div className="col-span-2">Qté</div>
                <div className="col-span-2">P.U. HT</div>
                <div className="col-span-2">Remise %</div>
                <div className="col-span-1">TVA %</div>
                <div className="col-span-1 text-right">Suppr.</div>
              </div>
            )}

            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">
                <div className="col-span-12 sm:col-span-4">
                  <select className={inputCls} value={line.productId} onChange={(e) => updateLineProduct(idx, e.target.value)}>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.sku} · {p.name} (Stock: {p.stockQty})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    className={inputCls}
                    placeholder="Qté"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: Number(e.target.value) || 1 } : l)))
                    }
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    className={inputCls}
                    placeholder="P.U."
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)))
                    }
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className={inputCls}
                    placeholder="Rem %"
                    value={line.discountPct}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, discountPct: Number(e.target.value) || 0 } : l)))
                    }
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className={inputCls}
                    placeholder="TVA"
                    value={line.taxRate}
                    onChange={(e) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, taxRate: Number(e.target.value) || 0 } : l)))
                    }
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="w-full sm:w-1/2">
              <label className={labelCls}>Notes / Conditions</label>
              <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="text-right space-y-1 text-xs font-mono tabular-nums">
              <p className="text-slate-500">Sous-total HT : {formatMoney(totals.subtotal, currency)}</p>
              <p className="text-slate-500">Remises : - {formatMoney(totals.discountTotal, currency)}</p>
              <p className="text-slate-500">TVA : {formatMoney(totals.taxTotal, currency)}</p>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                Total TTC : {formatMoney(totals.total, currency)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDocModal(null)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy || customers.length === 0 || lines.length === 0} className={btnPrimaryCls}>
              {busy ? 'Enregistrement...' : docModal === 'invoice' ? 'Générer la facture' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={payInvoice !== null} title={`Encaisser la facture ${payInvoice?.number || ''}`} onClose={() => setPayInvoice(null)} maxWidth="max-w-md">
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className={labelCls}>Montant encaissé ({currency}) *</label>
            <input
              type="number"
              required
              min="1"
              max={payInvoice?.balanceDue || 0}
              className={inputCls}
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Reste dû : {formatMoney(payInvoice?.balanceDue || 0, currency)}
            </p>
          </div>
          <div>
            <label className={labelCls}>Compte de trésorerie *</label>
            <select required className={inputCls} value={payTreasuryId} onChange={(e) => setPayTreasuryId(e.target.value)}>
              {treasuryAccounts.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({formatMoney(t.balance, currency)})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mode de règlement</label>
              <select className={inputCls} value={payMethod} onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}>
                <option value="virement">Virement bancaire</option>
                <option value="especes">Espèces (Caisse)</option>
                <option value="cheque">Chèque</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Référence pièce</label>
              <input className={inputCls} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="VIR-2026-..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPayInvoice(null)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" disabled={busy} className={btnPrimaryCls}>
              {busy ? 'Traitement...' : 'Valider l’encaissement'}
            </button>
          </div>
        </form>
      </Modal>

      <InvoicePreviewModal
        invoice={previewInvoice}
        company={activeCompany}
        currency={currency}
        busy={busy}
        onClose={() => setPreviewInvoice(null)}
        onEmitDraft={handleEmitDraftInvoice}
        onCancelInvoice={handleCancelInvoice}
        onOpenPayment={openPaymentModal}
        onExported={(msg) => notify(msg, 'success')}
      />
    </div>
  );
};
