import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  Company,
  CurrencyCode,
  Invoice,
  PurchaseOrder,
  Quote,
  SalesOrder,
  SupplierInvoice,
} from '../types/erp';
import { formatDateFr, formatMoney } from './format';

export function exportInvoicePdf(
  invoice: Invoice,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();

  // Header band (FUREX Obsidian)
  doc.setFillColor(17, 18, 22);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(company?.name || 'FUREX ERP', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(
    [
      company?.legalForm ? `${company.legalForm}` : '',
      company?.taxId ? `NIF : ${company.taxId}` : '',
      company?.rccm ? `RCCM : ${company.rccm}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ') || 'Plateforme de gestion intégrée FUREX ERP',
    14,
    22
  );
  if (company?.address || company?.phone) {
    doc.text(`${company?.address || ''} ${company?.phone ? `· ${company.phone}` : ''}`, 14, 28);
  }

  // Document title on right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('FACTURE CLIENT', 196, 15, { align: 'right' });
  doc.setFontSize(11);
  doc.text(invoice.number, 196, 23, { align: 'right' });

  // Client & dates block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text('Facturé à :', 14, 46);
  doc.setFontSize(12);
  doc.text(invoice.customerName, 14, 52);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (invoice.customerEmail) doc.text(invoice.customerEmail, 14, 58);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(`Date d'émission : ${formatDateFr(invoice.date)}`, 140, 46);
  doc.text(`Échéance : ${formatDateFr(invoice.dueDate)}`, 140, 52);
  doc.text(`Statut : ${invoice.status.toUpperCase()}`, 140, 58);

  // Table
  autoTable(doc, {
    startY: 68,
    head: [['Réf.', 'Désignation', 'Qté', 'P.U. HT', 'Remise %', 'TVA %', 'Total TTC']],
    body: invoice.lines.map((l) => [
      l.sku,
      l.name,
      String(l.qty),
      formatMoney(l.unitPrice, currency),
      `${l.discountPct}%`,
      `${l.taxRate}%`,
      formatMoney(l.lineTotal, currency),
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [252, 63, 29], textColor: 255 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 140;
  const summaryX = 128;
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text('Sous-total HT :', summaryX, finalY + 12);
  doc.text(formatMoney(invoice.subtotal, currency), 196, finalY + 12, { align: 'right' });

  doc.text('Remises :', summaryX, finalY + 18);
  doc.text(`- ${formatMoney(invoice.discountTotal, currency)}`, 196, finalY + 18, { align: 'right' });

  doc.text('TVA :', summaryX, finalY + 24);
  doc.text(formatMoney(invoice.taxTotal, currency), 196, finalY + 24, { align: 'right' });

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Net à payer TTC :', summaryX, finalY + 32);
  doc.text(formatMoney(invoice.total, currency), 196, finalY + 32, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(22, 163, 74);
  doc.text('Montant réglé :', summaryX, finalY + 39);
  doc.text(formatMoney(invoice.paidAmount, currency), 196, finalY + 39, { align: 'right' });

  doc.setTextColor(220, 38, 38);
  doc.text('Solde restant dû :', summaryX, finalY + 45);
  doc.text(formatMoney(invoice.balanceDue, currency), 196, finalY + 45, { align: 'right' });

  if (invoice.notes) {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Conditions / Notes : ${invoice.notes}`, 14, finalY + 58);
  }

  doc.save(`${invoice.number}.pdf`);
}

export function exportSingleInvoiceCsv(invoice: Invoice) {
  const rows = invoice.lines.map((l) => ({
    NumeroFacture: invoice.number,
    Date: invoice.date,
    Echeance: invoice.dueDate,
    Client: invoice.customerName,
    SKU: l.sku,
    Article: l.name,
    Quantite: l.qty,
    PrixUnitaireHT: l.unitPrice,
    RemisePct: l.discountPct,
    TVAPct: l.taxRate,
    TotalLigneTTC: l.lineTotal,
    TotalFactureTTC: invoice.total,
    Paye: invoice.paidAmount,
    SoldeDu: invoice.balanceDue,
    Statut: invoice.status,
  }));
  exportRowsCsv(rows, invoice.number);
}

export function exportSingleInvoiceExcel(invoice: Invoice, company: Company | null) {
  exportWorkbookExcel(
    [
      {
        name: 'Resume Facture',
        rows: [
          {
            Emetteur: company?.name || 'FUREX ERP',
            NumeroFacture: invoice.number,
            DateEmission: invoice.date,
            Echeance: invoice.dueDate,
            Client: invoice.customerName,
            EmailClient: invoice.customerEmail || '',
            SousTotalHT: invoice.subtotal,
            Remises: invoice.discountTotal,
            TVA: invoice.taxTotal,
            TotalTTC: invoice.total,
            MontantPaye: invoice.paidAmount,
            SoldeDu: invoice.balanceDue,
            Statut: invoice.status,
            Notes: invoice.notes || '',
          },
        ],
      },
      {
        name: 'Lignes Articles',
        rows: invoice.lines.map((l) => ({
          SKU: l.sku,
          Article: l.name,
          Categorie: l.categoryName || '',
          Quantite: l.qty,
          PrixUnitaireHT: l.unitPrice,
          RemisePct: l.discountPct,
          TVAPct: l.taxRate,
          TotalLigneTTC: l.lineTotal,
        })),
      },
    ],
    invoice.number
  );
}

export function exportPurchaseOrderPdf(
  po: PurchaseOrder,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();
  doc.setFillColor(17, 18, 22);
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(company?.name || 'FUREX ERP', 14, 14);
  doc.setFontSize(12);
  doc.text(`BON DE COMMANDE FOURNISSEUR · ${po.number}`, 196, 14, { align: 'right' });
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Fournisseur : ${po.supplierName}  ·  Date : ${formatDateFr(po.date)}  ·  Statut : ${po.status.toUpperCase()}`,
    14,
    24
  );

  autoTable(doc, {
    startY: 40,
    head: [['SKU', 'Article', 'Qté', 'P.U. Achat HT', 'TVA %', 'Total TTC']],
    body: po.lines.map((l) => [
      l.sku,
      l.name,
      String(l.qty),
      formatMoney(l.unitPrice, currency),
      `${l.taxRate}%`,
      formatMoney(l.lineTotal, currency),
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [252, 63, 29], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120;
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Sous-total HT : ${formatMoney(po.subtotal, currency)}`, 196, finalY + 12, { align: 'right' });
  doc.text(`TVA : ${formatMoney(po.taxTotal, currency)}`, 196, finalY + 18, { align: 'right' });
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total TTC : ${formatMoney(po.total, currency)}`, 196, finalY + 26, { align: 'right' });
  doc.save(`${po.number}.pdf`);
}

export function exportSupplierInvoicePdf(
  sinv: SupplierInvoice,
  linkedPo: PurchaseOrder | undefined,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();
  doc.setFillColor(17, 18, 22);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(company?.name || 'FUREX ERP', 14, 15);
  doc.setFontSize(13);
  doc.text('FACTURE FOURNISSEUR', 196, 15, { align: 'right' });
  doc.setFontSize(11);
  doc.text(sinv.number, 196, 23, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text('Fournisseur :', 14, 46);
  doc.setFontSize(12);
  doc.text(sinv.supplierName, 14, 52);
  doc.setFontSize(9);
  doc.text(`Date : ${formatDateFr(sinv.date)}`, 140, 46);
  doc.text(`Échéance : ${formatDateFr(sinv.dueDate)}`, 140, 52);
  doc.text(`Statut : ${sinv.status.toUpperCase()}`, 140, 58);

  const rows = linkedPo
    ? linkedPo.lines.map((l) => [
        l.sku,
        l.name,
        String(l.qty),
        formatMoney(l.unitPrice, currency),
        `${l.taxRate}%`,
        formatMoney(l.lineTotal, currency),
      ])
    : [
        [
          sinv.number,
          `Approvisionnement ${sinv.supplierName}`,
          '1',
          formatMoney(sinv.total, currency),
          '0%',
          formatMoney(sinv.total, currency),
        ],
      ];

  autoTable(doc, {
    startY: 66,
    head: [['Réf.', 'Désignation', 'Qté', 'P.U. HT', 'TVA %', 'Total TTC']],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [252, 63, 29], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 130;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total facture : ${formatMoney(sinv.total, currency)}`, 196, finalY + 14, { align: 'right' });
  doc.setFontSize(9.5);
  doc.setTextColor(22, 163, 74);
  doc.text(`Montant réglé : ${formatMoney(sinv.paidAmount, currency)}`, 196, finalY + 21, { align: 'right' });
  doc.setTextColor(220, 38, 38);
  doc.text(`Reste à payer : ${formatMoney(sinv.balanceDue, currency)}`, 196, finalY + 28, { align: 'right' });

  doc.save(`${sinv.number}.pdf`);
}

export function exportQuoteOrOrderPdf(
  title: string,
  docItem: Quote | SalesOrder,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();
  doc.setFillColor(17, 18, 22);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(company?.name || 'FUREX ERP', 14, 14);
  doc.setFontSize(12);
  doc.text(`${title} · ${docItem.number}`, 196, 14, { align: 'right' });
  doc.setFontSize(9);
  doc.text(`Client : ${docItem.customerName}  ·  Date : ${formatDateFr(docItem.date)}`, 14, 24);

  autoTable(doc, {
    startY: 38,
    head: [['SKU', 'Article', 'Qté', 'P.U.', 'Remise %', 'TVA %', 'Total']],
    body: docItem.lines.map((l) => [
      l.sku,
      l.name,
      String(l.qty),
      formatMoney(l.unitPrice, currency),
      `${l.discountPct}%`,
      `${l.taxRate}%`,
      formatMoney(l.lineTotal, currency),
    ]),
    headStyles: { fillColor: [252, 63, 29] },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total TTC : ${formatMoney(docItem.total, currency)}`, 196, finalY + 14, { align: 'right' });
  doc.save(`${docItem.number}.pdf`);
}

export function exportTablePdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
) {
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
  doc.setFillColor(17, 18, 22);
  doc.rect(0, 0, 300, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(subtitle, 14, 20);

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [252, 63, 29], textColor: 255 },
  });

  doc.save(`${filename}.pdf`);
}

export function exportWorkbookExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Info: 'Aucune donnée' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportRowsCsv(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'Aucune donnée' }]);
  const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportHeadersTemplate(
  headers: string[],
  format: 'csv' | 'xlsx',
  filename: string,
  sheetName = 'Modele'
) {
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
