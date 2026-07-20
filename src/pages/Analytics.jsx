import { useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { useScopedCollection } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
import { classifyMovement, lastNDays } from '../utils/analytics'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const TABS = ['Fast Moving', 'Medium Moving', 'Slow Moving', 'Low Stock']

export default function Analytics() {
  const { items: products } = useScopedCollection('products')
  const { items: stockOut } = useScopedCollection('stockOut')
  const { items: stockIn } = useScopedCollection('stockIn')
  const { items: sales } = useScopedCollection('sales')
  const location = useLocation()
  const [tab, setTab] = useState(TABS.includes(location.state?.tab) ? location.state.tab : 'Fast Moving')
  const reportRef = useRef(null)

  const since = lastNDays(30)
  const { fast, medium, slow } = useMemo(() => classifyMovement(products, stockOut, sales, since), [products, stockOut, sales])
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.minQuantity ?? 5))

  const tabData = { 'Fast Moving': fast, 'Medium Moving': medium, 'Slow Moving': slow, 'Low Stock': lowStock }[tab]
  const maxQty = Math.max(1, ...tabData.map((p) => p.moved ?? p.quantity ?? 0))

  const movementCounts = [
    { name: 'Fast', count: fast.length },
    { name: 'Medium', count: medium.length },
    { name: 'Slow', count: slow.length },
  ]

  const dailyTrend = useMemo(() => {
    const days = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      days[key] = { day: key, stockIn: 0, stockOut: 0, sales: 0 }
    }
    stockIn.forEach((e) => {
      if (!e.date?.toDate) return
      const key = e.date.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      if (days[key]) days[key].stockIn += Number(e.quantity || 0)
    })
    stockOut.forEach((e) => {
      if (!e.date?.toDate) return
      const key = e.date.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      if (days[key]) days[key].stockOut += Number(e.quantity || 0)
    })
    sales.forEach((s) => {
      if (!s.date?.toDate) return
      const key = s.date.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      if (days[key]) days[key].sales += Number(s.quantity || 0)
    })
    return Object.values(days)
  }, [stockIn, stockOut, sales])

  const summary = useMemo(() => {
    const topName = fast[0]?.name
    const atRisk = slow.filter((p) => p.moved === 0).length
    const lines = []
    lines.push(topName
      ? `${topName} is currently the fastest-moving product over the last 30 days.`
      : `No strong fast-moving product stands out yet — activity is fairly even across items.`)
    lines.push(`${fast.length} item(s) are fast moving, ${medium.length} medium, and ${slow.length} slow.`)
    if (atRisk > 0) lines.push(`${atRisk} item(s) have had no sales or stock-out activity at all and may be at risk of overstock.`)
    if (lowStock.length > 0) lines.push(`${lowStock.length} item(s) are currently below their minimum stock threshold and need reordering.`)
    return lines.join(' ')
  }, [fast, medium, slow, lowStock])

  async function exportPdf() {
    const canvas = await html2canvas(reportRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageWidth = pdf.internal.pageSize.getWidth()
    const imgWidth = pageWidth - 40
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.setFontSize(16)
    pdf.text('Analytics Report', 20, 30)
    pdf.addImage(imgData, 'PNG', 20, 45, imgWidth, imgHeight)
    pdf.save('analytics-report.pdf')
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Analytics</h1><p style={{ color: 'var(--text-muted)', margin: 0 }}>This Month - Last 30 days analysis</p></div>
        <button className="btn btn-gold" onClick={exportPdf}>Export to PDF</button>
      </div>

      <div ref={reportRef} style={{ background: '#fff', padding: 4 }}>
        <div className="cards-grid">
          <div className="card"><div className="card-label">Fast Moving</div><div className="card-value">{fast.length}</div></div>
          <div className="card"><div className="card-label">Medium Moving</div><div className="card-value">{medium.length}</div></div>
          <div className="card"><div className="card-label">Slow Moving</div><div className="card-value">{slow.length}</div></div>
          <div className="card"><div className="card-label">Low Stock</div><div className="card-value">{lowStock.length}</div></div>
        </div>

        <div className="cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="card">
            <h3>Movement Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={movementCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="count" fill="#1fa895" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3>Stock In vs Stock Out vs Sales (30 days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" interval={4} /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="stockIn" stroke="#1fa895" name="Stock In" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stockOut" stroke="#e6b94d" name="Stock Out" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sales" stroke="#c0642a" name="Sales" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Summary</h3>
          <p style={{ color: 'var(--text-main)' }}>{summary}</p>
        </div>

        <div className="tabs">
          {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="card">
          {tabData.length === 0 && <div className="empty-state">No items in this category.</div>}
          {tabData.map((p, i) => (
            <div key={p.id}>
              <div className="progress-row" style={{ justifyContent: 'space-between' }}>
                <span>{i + 1}. {p.name} <span style={{ color: 'var(--text-muted)' }}>({p.code})</span></span>
                <span>{p.moved ?? p.quantity}</span>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${((p.moved ?? p.quantity) / maxQty) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
