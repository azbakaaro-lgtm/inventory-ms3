import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function statusFor(p) {
  const qty = Number(p.quantity || 0)
  const min = Number(p.minQuantity ?? 5)
  if (qty <= 0) return 'Out of Stock'
  if (qty <= min) return 'Low Stock'
  return 'In Stock'
}

// Exports Product Code, Product Name, Category, Quantity, Status only —
// intentionally excludes cost price and selling price.
export function exportProductsPdf(products, { storeName = 'Inventory MS' } = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setTextColor(15, 107, 102) // teal-700
  doc.text(storeName, 40, 44)

  doc.setFontSize(11)
  doc.setTextColor(80, 80, 80)
  doc.text('Product List', 40, 62)
  doc.text(new Date().toLocaleDateString(), pageWidth - 40, 62, { align: 'right' })

  doc.setDrawColor(217, 236, 233)
  doc.line(40, 70, pageWidth - 40, 70)

  const rows = [...products]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((p) => [p.code || '—', p.name || '—', p.category || '—', String(p.quantity ?? 0), statusFor(p)])

  autoTable(doc, {
    startY: 84,
    head: [['Product Code', 'Product Name', 'Category', 'Quantity', 'Status']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [15, 107, 102], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [238, 247, 245] },
    styles: { fontSize: 9, cellPadding: 6 },
    columnStyles: { 3: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const value = data.cell.raw
        if (value === 'Out of Stock') data.cell.styles.textColor = [216, 84, 63]
        else if (value === 'Low Stock') data.cell.styles.textColor = [200, 140, 20]
        else data.cell.styles.textColor = [31, 168, 149]
      }
    },
    didDrawPage: () => {
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: 'right' }
      )
    },
  })

  doc.save(`product-list-${new Date().toISOString().slice(0, 10)}.pdf`)
}
