import { useMemo, useState } from 'react'
import Modal from './Modal'
import { generateDailyClosePdf } from '../utils/dailyClosePdf'

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CloseDailyModal({ open, onClose, sales, storeName, closedBy }) {
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10))

  const daySales = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const target = new Date(y, m - 1, d)
    return sales.filter((s) => s.date?.toDate && isSameDay(s.date.toDate(), target))
  }, [sales, dateStr])

  const paymentTotals = useMemo(() => {
    const totals = new Map()
    daySales.forEach((sale) => {
      const method = sale.paymentMethod || 'Unspecified'
      const saleTotal = (sale.items || []).reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
      totals.set(method, (totals.get(method) || 0) + saleTotal)
    })
    return [...totals.entries()]
  }, [daySales])

  const grandTotal = paymentTotals.reduce((s, [, v]) => s + v, 0)
  const totalItems = daySales.reduce((s, sale) => s + (sale.items || []).reduce((s2, it) => s2 + Number(it.qty || 0), 0), 0)

  function download() {
    const [y, m, d] = dateStr.split('-').map(Number)
    generateDailyClosePdf(daySales, { storeName, date: new Date(y, m - 1, d), closedBy })
  }

  return (
    <Modal open={open} title="Close Daily" onClose={onClose}>
      <div className="form-row" style={{ maxWidth: 220 }}>
        <label>Date</label>
        <input className="input" type="date" value={dateStr} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateStr(e.target.value)} />
      </div>

      <div className="cards-grid" style={{ marginTop: 14 }}>
        <div className="card card-accent-teal"><div className="card-label">Sales</div><div className="card-value">{daySales.length}</div></div>
        <div className="card card-accent-gold"><div className="card-label">Items Sold</div><div className="card-value">{totalItems}</div></div>
      </div>

      <h4 style={{ marginTop: 18, marginBottom: 6 }}>Payment Breakdown</h4>
      {paymentTotals.length === 0 && <div className="empty-state">No sales recorded for this date.</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {paymentTotals.map(([method, total]) => (
              <tr key={method}><td>{method}</td><td>{total.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 10, fontWeight: 700, fontSize: '1.1rem' }}>Grand Total: {grandTotal.toFixed(2)}</p>

      <div className="modal-footer">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        <button type="button" className="btn btn-primary" disabled={daySales.length === 0} onClick={download}>⬇ Download Daily Close (PDF)</button>
      </div>
    </Modal>
  )
}
