import { useMemo, useState } from 'react'
import { useTenantCollection } from '../hooks/useTenantCollection'
import SearchSelect from './SearchSelect'

const RANGES = [{ label: '1 month', days: 30 }, { label: '3 months', days: 90 }, { label: '6 months', days: 180 }]

export default function ItemLookup() {
  const { items: products } = useTenantCollection('products')
  const { items: stockIn } = useTenantCollection('stockIn')
  const { items: stockOut } = useTenantCollection('stockOut')
  const [productId, setProductId] = useState('')
  const [rangeDays, setRangeDays] = useState(90)

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))

  const timeline = useMemo(() => {
    if (!productId) return []
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rangeDays)
    const inRows = stockIn
      .filter((e) => e.productId === productId && (!e.date?.toDate || e.date.toDate() >= cutoff))
      .map((e) => ({ ...e, type: 'in' }))
    const outRows = stockOut
      .filter((e) => e.productId === productId && (!e.date?.toDate || e.date.toDate() >= cutoff))
      .map((e) => ({ ...e, type: 'out' }))
    return [...inRows, ...outRows].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
  }, [productId, rangeDays, stockIn, stockOut])

  return (
    <div>
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <SearchSelect options={productOptions} value={productId} onChange={setProductId} placeholder="Search product by name or code..." />
        <select className="input" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Branch / Destination</th><th>Note</th></tr></thead>
          <tbody>
            {productId && timeline.length === 0 && <tr><td colSpan={5}><div className="empty-state">No movement in this range.</div></td></tr>}
            {!productId && <tr><td colSpan={5}><div className="empty-state">Select a product to see its history.</div></td></tr>}
            {timeline.map((e) => (
              <tr key={e.id}>
                <td>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—'}</td>
                <td><span className={`pill ${e.type === 'in' ? 'pill-in' : 'pill-out'}`}>{e.type === 'in' ? 'Stock In' : 'Stock Out'}</span></td>
                <td className={e.type === 'in' ? 'qty-ok' : 'qty-low'}>{e.type === 'in' ? '+' : '-'}{e.quantity}</td>
                <td>{e.branchName || e.destinationName || '—'}</td>
                <td>{e.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
