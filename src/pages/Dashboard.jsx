import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useScopedCollection } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
import { classifyMovement } from '../utils/analytics'

export default function Dashboard() {
  const { items: products } = useScopedCollection('products')
  const { items: stockIn } = useScopedCollection('stockIn')
  const { items: stockOut } = useScopedCollection('stockOut')
  const { items: sales } = useScopedCollection('sales')

  const totalStockAvailable = products.reduce((s, p) => s + Number(p.quantity || 0), 0)
  const totalStockAdded = stockIn.reduce((s, e) => s + Number(e.quantity || 0), 0)
  // Everything that actually left the shelf — Stock Out transfers plus customer Sales.
  const totalStockIssued =
    stockOut.reduce((s, e) => s + Number(e.quantity || 0), 0) +
    sales.reduce((s, sale) => s + Number(sale.quantity || 0), 0)
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.minQuantity ?? 5))

  const { fast, medium, slow } = useMemo(() => classifyMovement(products, stockOut, sales), [products, stockOut, sales])

  const recentIn = [...stockIn].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).slice(0, 5)
  const recentOut = [...stockOut].sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0)).slice(0, 5)

  // "Top Products" reflects everything that actually leaves the shelf —
  // both internal Stock Out transfers and customer Sales.
  const topProducts = useMemo(() => {
    const moved = {}
    stockOut.forEach((e) => { moved[e.productId] = (moved[e.productId] || 0) + Number(e.quantity || 0) })
    sales.forEach((s) => {
      ;(s.items || []).forEach((it) => {
        moved[it.productId] = (moved[it.productId] || 0) + Number(it.qty || 0)
      })
    })
    const max = Math.max(1, ...Object.values(moved))
    return products
      .map((p) => ({ ...p, moved: moved[p.id] || 0 }))
      .sort((a, b) => b.moved - a.moved)
      .slice(0, 5)
      .map((p) => ({ ...p, pct: Math.round((p.moved / max) * 100) }))
  }, [products, stockOut, sales])

  return (
    <div>
      <UserScopeSelector />
      <div className="page-header"><h1>This Month</h1></div>

      <div className="cards-grid">
        <div className="card card-accent-teal"><div className="card-label">Total Products</div><div className="card-value">{products.length}</div></div>
        <div className="card card-accent-gold"><div className="card-label">Total Stock Available</div><div className="card-value">{totalStockAvailable}</div></div>
        <div className="card card-accent-teal"><div className="card-label">Total Stock Added</div><div className="card-value">{totalStockAdded}</div></div>
        <div className="card card-accent-gold"><div className="card-label">Total Stock Issued</div><div className="card-value">{totalStockIssued}</div></div>
      </div>

      <div className="cards-grid">
        <Link to="/analytics" state={{ tab: 'Fast Moving' }} className="card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <div className="card-label">Fast Moving Items</div><div className="card-value">{fast.length}</div>
        </Link>
        <Link to="/analytics" state={{ tab: 'Medium Moving' }} className="card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <div className="card-label">Medium Moving Items</div><div className="card-value">{medium.length}</div>
        </Link>
        <Link to="/analytics" state={{ tab: 'Slow Moving' }} className="card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
          <div className="card-label">Slow Moving Items</div><div className="card-value">{slow.length}</div>
        </Link>
      </div>

      {lowStock.length > 0 && (
        <div className="alert-banner">⚠ {lowStock.length} product(s) are low on stock. <Link to="/settings">Review thresholds</Link></div>
      )}

      <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h3>Stock In</h3>
          {recentIn.length === 0 && <div className="empty-state">No recent stock in.</div>}
          {recentIn.map((e) => (
            <div key={e.id} className="progress-row" style={{ justifyContent: 'space-between' }}>
              <span>{e.productName}</span><span className="qty-ok">+{e.quantity}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Stock Out</h3>
          {recentOut.length === 0 && <div className="empty-state">No recent stock out.</div>}
          {recentOut.map((e) => (
            <div key={e.id} className="progress-row" style={{ justifyContent: 'space-between' }}>
              <span>{e.productName} → {e.destinationName}</span><span className="qty-low">-{e.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="page-header" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Top Products</h3>
          <Link to="/analytics" className="btn btn-ghost btn-sm">View Full Analytics</Link>
        </div>
        {topProducts.length === 0 && <div className="empty-state">No sales or stock-out activity yet.</div>}
        {topProducts.map((p) => (
          <div key={p.id}>
            <div className="progress-row" style={{ justifyContent: 'space-between' }}>
              <span>{p.name}</span><span>{p.moved}</span>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${p.pct}%` }} /></div>
          </div>
        ))}
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Current Qty</th><th>Unit</th></tr></thead>
          <tbody>
            {lowStock.length === 0 && <tr><td colSpan={4}><div className="empty-state">No low-stock items 🎉</div></td></tr>}
            {lowStock.map((p) => (
              <tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td className="qty-low">{p.quantity}</td><td>{p.unitType}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
