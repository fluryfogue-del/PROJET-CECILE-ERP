import React from 'react';
import {
  FileDown,
  FileSpreadsheet,
  Download,
  CreditCard,
  CheckCircle2,
  XCircle,
  Printer,
  X,
} from 'lucide-react';
import { Company, CurrencyCode, Invoice } from '../../types/erp';
import { formatDateFr, formatMoney } from '../../lib/format';
import {
  exportInvoicePdf,
  exportSingleInvoiceCsv,
  exportSingleInvoiceExcel,
} from '../../lib/exports';
import { StatusLabel } from '../ui/DataUI';

interface InvoicePreviewModalProps {
  invoice: Invoice | null;
  company: Company | null;
  currency: CurrencyCode;
  busy?: boolean;
  onClose: () => void;
  onEmitDraft: (invoice: Invoice) => void;
  onCancelInvoice: (invoice: Invoice) => void;
  onOpenPayment: (invoice: Invoice) => void;
  onExported?: (msg: string) => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  invoice,
  company,
  currency,
  busy,
  onClose,
  onEmitDraft,
  onCancelInvoice,
  onOpenPayment,
  onExported,
}) => {
  if (!invoice) return null;

  const invCurrency = invoice.currency || currency;
  const sellerName = invoice.sellerName || company?.name || 'JESSI';
  const sellerLegal = invoice.sellerLegalForm || company?.legalForm || '';
  const sellerTaxId = invoice.sellerTaxId || company?.taxId || '';
  const sellerRccm = invoice.sellerRccm || company?.rccm || '';
  const sellerAddress = invoice.sellerAddress || company?.address || '';
  const sellerPhone = invoice.sellerPhone || company?.phone || '';
  const sellerEmail = invoice.sellerEmail || company?.email || '';

  const statusTone =
    invoice.status === 'payee'
      ? 'success'
      : invoice.status === 'partielle'
      ? 'warning'
      : invoice.status === 'annulee'
      ? 'danger'
      : invoice.status === 'brouillon'
      ? 'neutral'
      : 'info';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-[#F5F6F8] dark:bg-[#0D0E12]">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              {invoice.number}
            </span>
            <StatusLabel label={invoice.status.toUpperCase()} tone={statusTone} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {invoice.status === 'brouillon' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onEmitDraft(invoice)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded-lg cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Émettre la facture
              </button>
            )}
            {invoice.balanceDue > 0 && invoice.status !== 'brouillon' && invoice.status !== 'annulee' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPayment(invoice);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" /> Encaisser
              </button>
            )}
            {invoice.paidAmount === 0 && invoice.status !== 'annulee' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancelInvoice(invoice)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                exportInvoicePdf(invoice, company, invCurrency);
                onExported?.(`Facture ${invoice.number} exportée en PDF.`);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#FC3F1D]" /> PDF
            </button>
            <button
              type="button"
              onClick={() => {
                exportSingleInvoiceExcel(invoice, company);
                onExported?.(`Facture ${invoice.number} exportée en Excel.`);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Excel
            </button>
            <button
              type="button"
              onClick={() => {
                exportSingleInvoiceCsv(invoice);
                onExported?.(`Facture ${invoice.number} exportée en CSV.`);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto bg-white dark:bg-[#16181F]">
          {/* Letterhead */}
          <div className="bg-[#111216] text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <img
                  src="/assets/aistudio/image_2c55d81b.png"
                  alt="JESSI"
                  className="w-8 h-8 rounded-lg object-cover border border-white/15"
                />
                <h2 className="font-display text-xl font-extrabold tracking-tight">{sellerName}</h2>
              </div>
              <p className="text-xs text-slate-300">
                {[sellerLegal, sellerTaxId && `NIF : ${sellerTaxId}`, sellerRccm && `RCCM : ${sellerRccm}`]
                  .filter(Boolean)
                  .join(' · ') || 'Émetteur JESSI'}
              </p>
              {(sellerAddress || sellerPhone || sellerEmail) && (
                <p className="text-[11px] text-slate-400">
                  {[sellerAddress, sellerPhone, sellerEmail].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#FC3F1D]">
                {invoice.status === 'brouillon' ? 'FACTURE PROVISOIRE' : 'FACTURE CLIENT'}
              </p>
              <p className="font-mono text-xl font-bold">{invoice.number}</p>
              <p className="text-xs text-slate-300">Devise : {invCurrency}</p>
            </div>
          </div>

          {/* Client & Invoice Info */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-[#F5F6F8] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Facturé à</p>
              <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {invoice.customerName}
              </p>
              {invoice.customerTaxId && (
                <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                  NIF / NUI : {invoice.customerTaxId}
                </p>
              )}
              {invoice.customerAddress && (
                <p className="text-xs text-slate-600 dark:text-slate-300">{invoice.customerAddress}</p>
              )}
              {(invoice.customerPhone || invoice.customerEmail) && (
                <p className="text-xs text-slate-500">
                  {[invoice.customerPhone, invoice.customerEmail].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#F5F6F8] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date d’émission :</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDateFr(invoice.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date d’échéance :</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDateFr(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Conditions :</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {invoice.paymentTerms || company?.invoicePaymentTerms || 'Paiement à 30 jours net'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut règlement :</span>
                <span className="font-bold uppercase text-[#FC3F1D]">{invoice.status}</span>
              </div>
            </div>
          </div>

          {/* Lines Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FC3F1D] text-white">
                  <th className="py-2.5 px-3 font-semibold">Réf.</th>
                  <th className="py-2.5 px-3 font-semibold">Désignation</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Qté</th>
                  <th className="py-2.5 px-3 font-semibold text-right">P.U. HT</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Remise</th>
                  <th className="py-2.5 px-3 font-semibold text-right">TVA</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {invoice.lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{line.sku || '-'}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{line.name}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{line.qty}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {formatMoney(line.unitPrice, invCurrency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{line.discountPct}%</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{line.taxRate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(line.lineTotal, invCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes */}
          <div className="grid sm:grid-cols-12 gap-6 items-start">
            <div className="sm:col-span-7 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">Notes & Mentions</p>
              <p className="leading-relaxed">
                {invoice.notes ||
                  company?.invoiceNotesDefault ||
                  'Merci pour votre confiance. Règlement par virement bancaire, chèque ou Mobile Money.'}
              </p>
            </div>

            <div className="sm:col-span-5 bg-[#F5F6F8] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Sous-total HT</span>
                <span>{formatMoney(invoice.subtotal, invCurrency)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Remises</span>
                <span>- {formatMoney(invoice.discountTotal, invCurrency)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total TVA</span>
                <span>{formatMoney(invoice.taxTotal, invCurrency)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Net à payer TTC</span>
                <span>{formatMoney(invoice.total, invCurrency)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Montant encaissé</span>
                <span>{formatMoney(invoice.paidAmount, invCurrency)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#FC3F1D]">
                <span>Solde restant dû</span>
                <span>{formatMoney(invoice.balanceDue, invCurrency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
