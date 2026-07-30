import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Builds the end-of-day "Close Daily" report: every item sold that day
// (aggregated across all sales), plus a breakdown of how much came in
// through each payment method (EVC Plus, Salaam Bank, eDahab, etc.).
export function generateDailyClosePdf(sales, { storeName = 'Inventory MS', date = new Date(), closedBy = '' } = {}) {
  // Aggregate items across every sale of the day.
  const itemTotals = new Map() // key: code|name -> { code, name, qty, total }
  const paymentTotals = new Map() // method name -> total

  sales.forEach((sale) => {
    const method = sale.paymentMethod || 'Unspecified'
    const saleTotal = (sale.items || []).reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
    paymentTotals.set(method, (paymentTotals.get(method) || 0) + saleTotal)

    ;(sale.items || []).forEach((it) => {
      const key = `${it.productId || it.name}`
      const unitPrice = Number(it.unitPrice || 0)
      const qty = Number(it.qty || 0)
      const existing = itemTotals.get(key) || { name: it.name || '—', qty: 0, total: 0 }
      existing.qty += qty
      existing.total += unitPrice * qty
      itemTotals.set(key, existing)
    })
  })

  const grandTotal = [...paymentTotals.values()].reduce((s, v) => s + v, 0)
  const totalQty = [...itemTotals.values()].reduce((s, v) => s + v.qty, 0)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setTextColor(15, 107, 102)
  doc.text(storeName, 40, 42)

  doc.setFontSize(11)
  doc.setTextColor(90, 90, 90)
  doc.text('Daily Close Report', 40, 60)
  doc.text(date.toLocaleDateString(), pageWidth - 40, 42, { align: 'right' })
  if (closedBy) doc.text(`Closed by: ${closedBy}`, pageWidth - 40, 60, { align: 'right' })

  doc.setDrawColor(217, 236, 233)
  doc.line(40, 68, pageWidth - 40, 68)

  const itemRows = [...itemTotals.values()]
    .sort((a, b) => b.qty - a.qty)
    .map((r) => [r.name, String(r.qty), r.total.toFixed(2)])

  autoTable(doc, {
    startY: 82,
    margin: { left: 40, right: 40 },
    head: [['Item Sold', 'Qty', 'Total']],
    body: itemRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 107, 102], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    foot: [['Total', String(totalQty), grandTotal.toFixed(2)]],
    footStyles: { fillColor: [238, 247, 245], textColor: [15, 107, 102], fontStyle: 'bold' },
  })

  let y = doc.lastAutoTable.finalY + 24
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text('Payment Breakdown', 40, y)
  y += 8

  const paymentRows = [...paymentTotals.entries()].map(([method, total]) => [method, total.toFixed(2)])

  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    head: [['Payment Method', 'Amount Received']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: [230, 185, 77], textColor: [43, 29, 0], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: 'right' } },
    foot: [['Grand Total', grandTotal.toFixed(2)]],
    footStyles: { fillColor: [250, 240, 220], textColor: [43, 29, 0], fontStyle: 'bold' },
  })

  doc.save(`daily-close-${date.toISOString().slice(0, 10)}.pdf`)
}
