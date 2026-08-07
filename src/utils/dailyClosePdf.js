import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatMoney } from '../utils/money'

// Builds the end-of-day "Close Daily" report, styled after a classic POS
// session report: a "Sales" section listing every item sold (with product
// code), a running total, and a "Payments" section breaking down how much
// came in through each method (EVC Plus, Salaam Bank, eDahab, etc.).
export function generateDailyClosePdf(sales, { storeName = 'Inventory MS', date = new Date(), closedBy = '' } = {}) {
  const itemTotals = new Map() // key -> { code, name, qty, total }
  const paymentTotals = new Map() // method name -> total

  sales.forEach((sale) => {
    const method = sale.paymentMethod || 'Unspecified'
    const saleTotal = (sale.items || []).reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
    paymentTotals.set(method, (paymentTotals.get(method) || 0) + saleTotal)

    ;(sale.items || []).forEach((it) => {
      const key = it.productId || it.name
      const unitPrice = Number(it.unitPrice || 0)
      const qty = Number(it.qty || 0)
      const existing = itemTotals.get(key) || { code: it.productCode || it.code || '', name: it.name || '—', qty: 0, total: 0 }
      existing.qty += qty
      existing.total += unitPrice * qty
      itemTotals.set(key, existing)
    })
  })

  const grandTotal = [...paymentTotals.values()].reduce((s, v) => s + v, 0)
  const totalQty = [...itemTotals.values()].reduce((s, v) => s + v.qty, 0)
  const sessionId = `POS/${String(Math.floor(Math.random() * 90000) + 10000)}`

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  // --- Header ---
  doc.setFontSize(20)
  doc.setTextColor(30, 30, 30)
  doc.text('Daily Close Report', pageWidth / 2, 44, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(storeName, marginX, 74)
  doc.text(`Session ID: ${sessionId}`, pageWidth - marginX, 74, { align: 'right' })
  if (closedBy) doc.text(`Closed by: ${closedBy}`, marginX, 90)

  doc.setFillColor(240, 240, 240)
  doc.rect(marginX, 100, pageWidth - marginX * 2, 22, 'F')
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`As of ${date.toLocaleString()}`, pageWidth - marginX - 8, 115, { align: 'right' })

  // --- Sales section header bar ---
  let y = 140
  doc.setFillColor(238, 238, 238)
  doc.rect(marginX, y, pageWidth - marginX * 2, 20, 'F')
  doc.setFontSize(11)
  doc.setTextColor(40, 40, 40)
  doc.text('Sales', marginX + 8, y + 14)
  y += 30

  const itemRows = [...itemTotals.values()]
    .sort((a, b) => b.qty - a.qty)
    .map((r) => [r.code ? `[${r.code}]` : '—', r.name, String(r.qty), formatMoney(r.total)])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Code', 'Item', 'Qty', 'Amount']],
    body: itemRows,
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [90, 90, 90], fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [200, 200, 200] },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
    foot: [['', 'Total', String(totalQty), formatMoney(grandTotal)]],
    footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold', lineWidth: { top: 0.75 }, lineColor: [180, 180, 180] },
  })

  // --- Payments section header bar ---
  y = doc.lastAutoTable.finalY + 26
  doc.setFillColor(238, 238, 238)
  doc.rect(marginX, y, pageWidth - marginX * 2, 20, 'F')
  doc.setFontSize(11)
  doc.setTextColor(40, 40, 40)
  doc.text('Payments', marginX + 8, y + 14)
  y += 30

  const paymentRows = [...paymentTotals.entries()].map(([method, total]) => [method, formatMoney(total)])

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Method', 'Amount Received']],
    body: paymentRows.length ? paymentRows : [['No payments recorded', '0.00']],
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [90, 90, 90], fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [200, 200, 200] },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: 'right' } },
    foot: [['Grand Total', formatMoney(grandTotal)]],
    footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold', lineWidth: { top: 0.75 }, lineColor: [180, 180, 180] },
  })

  doc.save(`daily-close-${date.toISOString().slice(0, 10)}-${date.getHours()}${date.getMinutes()}.pdf`)
}
