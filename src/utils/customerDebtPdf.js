import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatMoney } from '../utils/money'

// Builds a customer account statement: every credit purchase (itemized —
// product, quantity, price, line total) and every payment they've made,
// in order, ending with the amount they currently still owe.
export function generateCustomerDebtPdf(customer, entries, { storeName = 'Inventory MS' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  doc.setFontSize(16)
  doc.setTextColor(15, 107, 102)
  doc.text(storeName, marginX, 42)
  doc.setFontSize(11)
  doc.setTextColor(90, 90, 90)
  doc.text('Customer Account Statement', marginX, 60)

  doc.setFontSize(10)
  doc.text(`Customer: ${customer.name}`, marginX, 82)
  if (customer.phone) doc.text(`Phone: ${customer.phone}`, marginX, 96)
  doc.text(new Date().toLocaleDateString(), pageWidth - marginX, 42, { align: 'right' })

  const sorted = [...entries].sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0))
  const rows = []
  sorted.forEach((e) => {
    if (e.type === 'charge' && e.items?.length) {
      e.items.forEach((it) => {
        rows.push([e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—', it.name, String(it.qty), formatMoney(it.unitPrice), formatMoney(it.qty * it.unitPrice)])
      })
    } else if (e.type === 'charge') {
      rows.push([e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—', e.note || 'Credit purchase', '—', '—', formatMoney(e.amount)])
    } else {
      rows.push([e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—', `Payment${e.note ? ` — ${e.note}` : ''}`, '—', '—', `-${formatMoney(e.amount)}`])
    }
  })

  autoTable(doc, {
    startY: 112,
    margin: { left: marginX, right: marginX },
    head: [['Date', 'Product / Description', 'Qty', 'Price', 'Total']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 107, 102], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(`Balance Owed: ${formatMoney(customer.debtBalance)}`, pageWidth - marginX, finalY, { align: 'right' })

  doc.save(`statement-${customer.name.replace(/\s+/g, '-')}.pdf`)
}
