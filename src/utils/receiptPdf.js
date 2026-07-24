import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Generates a simple, printable receipt/invoice PDF for one sale.
// `sale` needs: reference, date (Timestamp or Date), customerName, items
// ([{ name, qty, unitPrice }]), paymentMethod (optional).
export function generateReceiptPdf(sale, { storeName = 'Inventory MS' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: [280, 500] }) // narrow, receipt-style page
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 30

  doc.setFontSize(14)
  doc.setTextColor(15, 107, 102)
  doc.text(storeName, pageWidth / 2, y, { align: 'center' })
  y += 16

  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  const dateObj = sale.date?.toDate ? sale.date.toDate() : (sale.date instanceof Date ? sale.date : new Date())
  doc.text(dateObj.toLocaleString(), pageWidth / 2, y, { align: 'center' })
  y += 12
  doc.text(`Receipt: ${sale.reference || '—'}`, pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setDrawColor(200, 200, 200)
  doc.line(20, y + 6, pageWidth - 20, y + 6)
  y += 16

  const items = sale.items || []
  const rows = items.map((it) => {
    const unitPrice = Number(it.unitPrice || 0)
    const qty = Number(it.qty || 0)
    return [it.name || '—', String(qty), unitPrice.toFixed(2), (unitPrice * qty).toFixed(2)]
  })

  autoTable(doc, {
    startY: y,
    margin: { left: 16, right: 16 },
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: rows,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fontStyle: 'bold', fillColor: [238, 247, 245], textColor: [15, 107, 102] },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  let finalY = doc.lastAutoTable.finalY + 10
  const total = items.reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)

  doc.setDrawColor(200, 200, 200)
  doc.line(20, finalY, pageWidth - 20, finalY)
  finalY += 16

  doc.setFontSize(11)
  doc.setTextColor(20, 20, 20)
  doc.setFont(undefined, 'bold')
  doc.text('Total', 20, finalY)
  doc.text(total.toFixed(2), pageWidth - 20, finalY, { align: 'right' })
  doc.setFont(undefined, 'normal')
  finalY += 18

  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`Customer: ${sale.customerName || 'Walk-in Customer'}`, 20, finalY)
  finalY += 12
  if (sale.paymentMethod) {
    doc.text(`Payment: ${sale.paymentMethod}`, 20, finalY)
    finalY += 12
  }

  finalY += 10
  doc.setFontSize(8)
  doc.text('Thank you for your business!', pageWidth / 2, finalY, { align: 'center' })

  doc.save(`receipt-${sale.reference || Date.now()}.pdf`)
}
