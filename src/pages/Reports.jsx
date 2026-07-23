import { useMemo, useState } from 'react'
import { useScopedCollection } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
import { classifyMovement } from '../utils/analytics'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const TABS = ['Daily Report', 'Weekly Report', 'Monthly Report', 'Stock In Report', 'Stock Out Report', 'Sales Report', 'Profit/Loss Report', 'Fast Moving Report', 'Slow Moving Report', 'Low Stock Report']

export default function Reports() {
  const { items: products } = useScopedCollection('products')
  const { items: stockIn } = useScopedCollection('stockIn')
  const { items: stockOut } = useScopedCollection('stockOut')
  const { items: sales } = useScopedCollection('sales')
  const [tab, setTab] = useState('Daily Report')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [generated, setGenerated] = useState(false)

  const { fast, slow } = useMemo(() => classifyMovement(products, stockOut, sales), [products, stockOut, sales])
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.minQuantity ?? 5))

  function inRange(dateVal) {
    if (!dateVal?.toDate) return true
    const d = dateVal.toDate()
    if (fromDate && d < new Date(fromDate)) return false
    if (toDate && d > new Date(toDate + 'T23:59:59')) return false
    return true
  }

  const combined = useMemo(() => {
    const inRows = stockIn.filter((e) => inRange(e.date)).map((e) => ({ ...e, type: 'Stock In', signedQty: e.quantity }))
    const outRows = stockOut.filter((e) => inRange(e.date)).map((e) => ({ ...e, type: 'Stock Out', signedQty: -e.quantity }))
    // Each sale can cover several products — expand to one ledger row per item, matching Stock In/Out granularity.
    const saleRows = sales.filter((s) => inRange(s.date)).flatMap((s) =>
      (s.items || []).map((it) => {
        const p = products.find((pp) => pp.id === it.productId)
        return { date: s.date, productCode: p?.code || '—', productName: it.name || p?.name || '—', type: 'Sale', signedQty: -Number(it.qty || 0) }
      })
    )
    let rows
    if (tab === 'Stock In Report') rows = inRows
    else if (tab === 'Stock Out Report') rows = outRows
    else if (tab === 'Sales Report') rows = saleRows
    else if (tab === 'Fast Moving Report') rows = fast.map((p) => ({ date: null, productCode: p.code, productName: p.name, signedQty: p.moved, type: 'Fast Moving' }))
    else if (tab === 'Slow Moving Report') rows = slow.map((p) => ({ date: null, productCode: p.code, productName: p.name, signedQty: p.moved, type: 'Slow Moving' }))
    else if (tab === 'Low Stock Report') rows = lowStock.map((p) => ({ date: null, productCode: p.code, productName: p.name, signedQty: p.quantity, type: 'Low Stock' }))
    else rows = [...inRows, ...outRows, ...saleRows] // Daily/Weekly/Monthly all show the raw ledger for the chosen range
    return rows.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
  }, [tab, stockIn, stockOut, sales, products, fast, slow, lowStock, fromDate, toDate])

  // Profit/Loss: one row per sale line item, using the cost/selling price that
  // was captured on the sale at the time it happened — not today's price —
  // so profit for past periods stays accurate even if prices change later.
  // Sales made before prices were tracked simply show $0 cost/profit for that line.
  const profitLines = useMemo(() => {
    return sales
      .filter((s) => inRange(s.date))
      .flatMap((s) =>
        (s.items || []).map((it) => {
          const p = products.find((pp) => pp.id === it.productId)
          const qty = Number(it.qty || 0)
          const unitCost = Number(it.unitCost || 0)
          const unitPrice = Number(it.unitPrice || 0)
          return {
            date: s.date,
            productCode: p?.code || '—',
            productName: it.name || p?.name || '—',
            qty, unitCost, unitPrice,
            revenue: unitPrice * qty,
            cost: unitCost * qty,
            profit: (unitPrice - unitCost) * qty,
          }
        })
      )
      .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
  }, [sales, products, fromDate, toDate])

  const profitTotals = useMemo(() => profitLines.reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, cost: acc.cost + r.cost, profit: acc.profit + r.profit }),
    { revenue: 0, cost: 0, profit: 0 }
  ), [profitLines])

  function exportPdf() {
    const pdf = new jsPDF()
    pdf.setFontSize(14)
    pdf.text(tab, 14, 16)
    if (tab === 'Profit/Loss Report') {
      autoTable(pdf, {
        startY: 22,
        head: [['Date', 'Code', 'Name', 'Qty', 'Cost', 'Revenue', 'Profit']],
        body: profitLines.map((r) => [
          r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—',
          r.productCode, r.productName, r.qty, r.cost.toFixed(2), r.revenue.toFixed(2), r.profit.toFixed(2),
        ]),
        foot: [['', '', '', '', profitTotals.cost.toFixed(2), profitTotals.revenue.toFixed(2), profitTotals.profit.toFixed(2)]],
      })
      pdf.save('profit-loss-report.pdf')
      return
    }
    autoTable(pdf, {
      startY: 22,
      head: [['Date', 'Code', 'Name', 'Qty', 'Type']],
      body: combined.map((r) => [
        r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—',
        r.productCode, r.productName, r.signedQty, r.type,
      ]),
    })
    pdf.save(`${tab.replace(/\s+/g, '-').toLowerCase()}.pdf`)
  }

  function exportExcel() {
    if (tab === 'Profit/Loss Report') {
      const rows = profitLines.map((r) => ({
        Date: r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—',
        Code: r.productCode, Name: r.productName, Quantity: r.qty,
        Cost: r.cost, Revenue: r.revenue, Profit: r.profit,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Profit-Loss')
      XLSX.writeFile(wb, 'profit-loss-report.xlsx')
      return
    }
    const rows = combined.map((r) => ({
      Date: r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—',
      Code: r.productCode, Name: r.productName, Quantity: r.signedQty, Type: r.type,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, tab.slice(0, 30))
    XLSX.writeFile(wb, `${tab.replace(/\s+/g, '-').toLowerCase()}.xlsx`)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="btn btn-ghost" onClick={exportPdf}>Export to PDF</button>
          <button className="btn btn-ghost" onClick={exportExcel}>Export to Excel</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 180 }} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="input" style={{ maxWidth: 180 }} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button className="btn btn-primary" onClick={() => setGenerated(true)}>Generate Report</button>
      </div>

      {tab === 'Profit/Loss Report' ? (
        <>
          <div className="cards-grid">
            <div className="card card-accent-teal"><div className="card-label">Total Revenue</div><div className="card-value">{profitTotals.revenue.toFixed(2)}</div></div>
            <div className="card card-accent-gold"><div className="card-label">Total Cost</div><div className="card-value">{profitTotals.cost.toFixed(2)}</div></div>
            <div className="card card-accent-teal"><div className="card-label">Total Profit</div><div className="card-value">{profitTotals.profit.toFixed(2)}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Code</th><th>Name</th><th>Qty</th><th>Cost</th><th>Revenue</th><th>Profit</th></tr></thead>
              <tbody>
                {profitLines.length === 0 && <tr><td colSpan={7}><div className="empty-state">No sales for this selection.</div></td></tr>}
                {profitLines.map((r, i) => (
                  <tr key={i}>
                    <td>{r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—'}</td>
                    <td>{r.productCode}</td><td>{r.productName}</td><td>{r.qty}</td>
                    <td>{r.cost.toFixed(2)}</td><td>{r.revenue.toFixed(2)}</td>
                    <td className={r.profit < 0 ? 'qty-low' : 'qty-ok'}>{r.profit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Code</th><th>Name</th><th>Qty</th><th>Type</th></tr></thead>
            <tbody>
              {combined.length === 0 && <tr><td colSpan={5}><div className="empty-state">No data for this selection.</div></td></tr>}
              {combined.map((r, i) => (
                <tr key={i}>
                  <td>{r.date?.toDate ? r.date.toDate().toLocaleDateString() : '—'}</td>
                  <td>{r.productCode}</td><td>{r.productName}</td>
                  <td className={r.signedQty < 0 ? 'qty-low' : 'qty-ok'}>{r.signedQty > 0 ? `+${r.signedQty}` : r.signedQty}</td>
                  <td><span className={`pill ${r.type === 'Stock Out' || r.type === 'Sale' ? 'pill-out' : 'pill-in'}`}>{r.type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
