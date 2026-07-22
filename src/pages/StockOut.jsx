import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, updateDoc, increment, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useScopedCollection, useOwnCollection } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
import Modal from '../components/Modal'
import SearchSelect from '../components/SearchSelect'

const todayStr = () => new Date().toISOString().slice(0, 10)
function dateStrToTimestamp(dateStr) {
  const now = new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  return Timestamp.fromDate(new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()))
}

export default function StockOut() {
  const { ownerId, firebaseUser } = useAuth()
  const { items: entries, loading } = useScopedCollection('stockOut')
  const { items: products } = useOwnCollection('products')
  const { items: branches } = useTenantCollection('branches')
  const { items: departments } = useTenantCollection('departments')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [productId, setProductId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [entryDate, setEntryDate] = useState(todayStr())

  const total = entries.reduce((s, e) => s + Number(e.quantity || 0), 0)
  const filtered = entries
    .filter((e) => !search || e.productName?.toLowerCase().includes(search.toLowerCase()) || e.productCode?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))
  const destinationOptions = [
    ...branches.map((b) => ({ value: `branch:${b.id}`, label: b.name, sublabel: 'Branch' })),
    ...departments.map((d) => ({ value: `dept:${d.id}`, label: d.name, sublabel: 'Department' })),
  ]

  function resetForm() { setEditing(null); setProductId(''); setDestinationId(''); setQuantity(''); setNote(''); setEntryDate(todayStr()) }

  function openAdd() {
    resetForm()
    setModalOpen(true)
  }

  function openEdit(entry) {
    setEditing(entry)
    setProductId(entry.productId || '')
    setDestinationId(entry.destinationId || '')
    setQuantity(String(entry.quantity ?? ''))
    setNote(entry.note || '')
    setEntryDate(entry.date?.toDate ? entry.date.toDate().toISOString().slice(0, 10) : todayStr())
    setModalOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    const product = products.find((p) => p.id === productId)
    const dest = destinationOptions.find((d) => d.value === destinationId)
    if (!product || !quantity) return
    const newQty = Number(quantity)

    if (editing) {
      const oldQty = Number(editing.quantity || 0)
      const oldProductId = editing.productId
      if (oldProductId === product.id) {
        const delta = oldQty - newQty // stock out: restoring oldQty then re-deducting newQty
        if (delta !== 0) await updateDoc(doc(db, 'products', product.id), { quantity: increment(delta) })
      } else {
        // Product was changed — restore the old product's deduction, apply the new one.
        await updateDoc(doc(db, 'products', oldProductId), { quantity: increment(oldQty) })
        await updateDoc(doc(db, 'products', product.id), { quantity: increment(-newQty) })
      }
      await updateDoc(doc(db, 'stockOut', editing.id), {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unitType: product.unitType,
        quantity: newQty,
        destinationId: destinationId || null,
        destinationName: dest?.label || '—',
        note,
        date: dateStrToTimestamp(entryDate),
      })
    } else {
      await addDoc(collection(db, 'stockOut'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unitType: product.unitType,
        quantity: newQty,
        destinationId: destinationId || null,
        destinationName: dest?.label || '—',
        note,
        date: dateStrToTimestamp(entryDate),
      })
      await updateDoc(doc(db, 'products', product.id), { quantity: increment(-newQty) })
    }
    setModalOpen(false)
    resetForm()
  }

  async function remove(entry) {
    if (!confirm('Delete this stock-out entry? The deducted quantity will be restored to the product\'s stock.')) return
    await deleteDoc(doc(db, 'stockOut', entry.id))
    if (entry.productId) {
      await updateDoc(doc(db, 'products', entry.productId), { quantity: increment(Number(entry.quantity || 0)) })
    }
  }

  return (
    <div>
      <UserScopeSelector />
      <div className="page-header">
        <h1>Stock Out</h1>
        <button className="btn btn-gold" onClick={openAdd}>+ Issue Stock</button>
      </div>

      <div className="card card-big-danger" style={{ marginBottom: 18, maxWidth: 320 }}>
        <div className="card-label">Total Stock Issued</div>
        <div className="card-value">{total}</div>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Code</th><th>Name</th><th>Qty -</th><th>Unit</th><th>Destination</th><th>Note</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="empty-state">No stock-out entries yet.</div></td></tr>}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—'}</td>
                <td>{e.productCode}</td><td>{e.productName}</td>
                <td className="qty-low">-{e.quantity}</td>
                <td>{e.unitType}</td><td>{e.destinationName}</td><td>{e.note || '—'}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)}>✏️</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(e)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Stock Out' : 'Issue Stock'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save}>
          <div className="form-row"><label>Select Product*</label>
            <SearchSelect options={productOptions} value={productId} onChange={setProductId} placeholder="Search product name or code..." /></div>
          <div className="form-row"><label>Destination Branch/Department*</label>
            <SearchSelect options={destinationOptions} value={destinationId} onChange={setDestinationId} placeholder="Search destination..." /></div>
          <div className="form-grid">
            <div className="form-row"><label>Quantity*</label>
              <input className="input" type="number" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            <div className="form-row"><label>Date</label>
              <input className="input" type="date" value={entryDate} max={todayStr()} onChange={(e) => setEntryDate(e.target.value)} required /></div>
          </div>
          <div className="form-row"><label>Reference Note</label>
            <input className="input" placeholder="Issue slip #, department request" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary">{editing ? 'Save Changes' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
