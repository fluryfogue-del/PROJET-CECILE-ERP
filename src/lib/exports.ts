import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Company, CurrencyCode, Invoice, Quote, SalesOrder } from '../types/erp';
import { formatDateFr, formatMoney } from './format';

export function exportInvoicePdf(
  invoice: Invoice,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();

  // Header band (Midnight Blue)
  doc.setFillColor(11, 20, 38);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(company?.name || 'NEXUS ERP', 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(191, 219, 254);
  doc.text(
    [
      company?.legalForm ? `${company.legalForm}` : '',
      company?.taxId ? `NIF : ${company.taxId}` : '',
      company?.rccm ? `RCCM : ${company.rccm}` : '',
    ]
      .filter(Boolean)
      .join('  ·  ') || 'Système de gestion intégré NEXUS ERP (CECILE)',
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
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
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

export function exportQuoteOrOrderPdf(
  title: string,
  docItem: Quote | SalesOrder,
  company: Company | null,
  currency: CurrencyCode
) {
  const doc = new jsPDF();
  doc.setFillColor(11, 20, 38);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(company?.name || 'NEXUS ERP', 14, 14);
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
    headStyles: { fillColor: [29, 78, 216] },
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
  doc.setFillColor(11, 20, 38);
  doc.rect(0, 0, 300, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, 14, 12);
  doc.setFontSize(9);
  doc.setTextColor(191, 219, 254);
  doc.text(subtitle, 14, 20);

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
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

export function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
