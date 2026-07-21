import { useMemo, useState } from 'react'
import { useScopedCollection } from '../hooks/useScopedCollection'
import SearchSelect from './SearchSelect'
import UserScopeSelector from './UserScopeSelector'

const RANGES = [{ label: '1 month', days: 30 }, { label: '3 months', days: 90 }, { label: '6 months', days: 180 }]

export default function ItemLookup() {
  const { items: products } = useScopedCollection('products')
  const { items: stockIn } = useScopedCollection('stockIn')
  const { items: stockOut } = useScopedCollection('stockOut')
  const { items: sales } = useScopedCollection('sales')
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
    // Each sale can cover several products — pull out just the line(s) for this product.
    const saleRows = sales
      .filter((s) => !s.date?.toDate || s.date.toDate() >= cutoff)
      .flatMap((s) =>
        (s.items || [])
          .filter((it) => it.productId === productId)
          .map((it) => ({ id: `${s.id}-${it.productId}`, date: s.date, quantity: it.qty, type: 'sale', customerName: s.customerName, reference: s.reference }))
      )
    return [...inRows, ...outRows, ...saleRows].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
  }, [productId, rangeDays, stockIn, stockOut, sales])

  return (
    <div>
      <UserScopeSelector />
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <SearchSelect options={productOptions} value={productId} onChange={setProductId} placeholder="Search product by name or code..." />
        <select className="input" value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          {RANGES.map((r) => <option key={r.days} value={r.days}>{r.label}</option>)}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Quantity</th><th>Branch / Destination / Customer</th><th>Note</th></tr></thead>
          <tbody>
            {productId && timeline.length === 0 && <tr><td colSpan={5}><div className="empty-state">No movement in this range.</div></td></tr>}
            {!productId && <tr><td colSpan={5}><div className="empty-state">Select a product to see its history.</div></td></tr>}
            {timeline.map((e) => (
              <tr key={e.id}>
                <td>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—'}</td>
                <td>
                  <span className={`pill ${e.type === 'in' ? 'pill-in' : 'pill-out'}`}>
                    {e.type === 'in' ? 'Stock In' : e.type === 'sale' ? 'Sale' : 'Stock Out'}
                  </span>
                </td>
                <td className={e.type === 'in' ? 'qty-ok' : 'qty-low'}>{e.type === 'in' ? '+' : '-'}{e.quantity}</td>
                <td>{e.type === 'sale' ? (e.customerName || 'Walk-in Customer') : (e.branchName || e.destinationName || '—')}</td>
                <td>{e.type === 'sale' ? (e.reference || '—') : (e.note || '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
