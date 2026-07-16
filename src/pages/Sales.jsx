import { useState } from 'react'
import { addDoc, collection, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import Modal from '../components/Modal'
import SearchSelect from '../components/SearchSelect'

export default function Sales() {
  const { ownerId } = useAuth()
  const { items: sales, loading } = useTenantCollection('sales')
  const { items: products } = useTenantCollection('products')
  const { items: customers } = useTenantCollection('customers')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const [rows, setRows] = useState([{ productId: '', qty: 1 }])
  const [notes, setNotes] = useState('')

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))
  const customerOptions = [{ value: '', label: 'Walk-in Customer' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]

  const filtered = sales
    .filter((s) => !search || s.customerName?.toLowerCase().includes(search.toLowerCase()) || s.reference?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))

  function updateRow(i, patch) { setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))) }
  function addRow() { setRows([...rows, { productId: '', qty: 1 }]) }
  function resetForm() { setCustomerId(''); setRows([{ productId: '', qty: 1 }]); setNotes('') }

  async function completeSale(e) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.productId && Number(r.qty) > 0)
    if (validRows.length === 0) return
    const customer = customers.find((c) => c.id === customerId)
    const totalQty = validRows.reduce((s, r) => s + Number(r.qty), 0)
    const reference = `SALE-${Date.now().toString().slice(-6)}`

    await addDoc(collection(db, 'sales'), {
      ownerId,
      reference,
      customerId: customerId || null,
      customerName: customer?.name || 'Walk-in Customer',
      quantity: totalQty,
      items: validRows.map((r) => {
        const p = products.find((pp) => pp.id === r.productId)
        return { productId: r.productId, name: p?.name, qty: Number(r.qty) }
      }),
      notes,
      status: 'Completed',
      date: serverTimestamp(),
    })

    for (const r of validRows) {
      await updateDoc(doc(db, 'products', r.productId), { quantity: increment(-Number(r.qty)) })
    }
    if (customer) {
      await updateDoc(doc(db, 'customers', customer.id), { totalPurchases: increment(totalQty) })
    }
    setModalOpen(false)
    resetForm()
  }

  return (
    <div>
      <div className="page-header">
        <h1>Sales</h1>
        <button className="btn btn-gold" onClick={() => setModalOpen(true)}>+ New Sale</button>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search by customer or reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Customer</th><th>Quantity</th><th>Status</th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={5}><div className="empty-state">No data available</div></td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.date?.toDate ? s.date.toDate().toLocaleDateString() : '—'}</td>
                <td>{s.reference}</td><td>{s.customerName}</td><td>{s.quantity}</td>
                <td><span className="pill pill-in">{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title="New Sale" onClose={() => setModalOpen(false)} wide>
        <form onSubmit={completeSale}>
          <div className="form-row"><label>Customer Name (Optional)</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {customerOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select></div>

          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Items</label>
          {rows.map((row, i) => (
            <div key={i} className="form-grid" style={{ marginTop: 6 }}>
              <SearchSelect options={productOptions} value={row.productId} onChange={(v) => updateRow(i, { productId: v })} placeholder="Select product..." />
              <input className="input" type="number" min="1" value={row.qty} onChange={(e) => updateRow(i, { qty: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addRow}>+ Add Item</button>

          <div className="form-row" style={{ marginTop: 14 }}><label>Notes</label>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary">Complete Sale</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
