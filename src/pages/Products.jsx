import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useMemo, useState } from 'react'
import Modal from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'
import { useTenantCollection } from '../hooks/useTenantCollection'

const emptyForm = { code: '', name: '', category: '', unitType: 'Piece', quantity: 0, minQuantity: 5, description: '' }

export default function Products() {
  const { ownerId } = useAuth()
  const { items: products, loading } = useTenantCollection('products')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category).filter(Boolean))], [products])

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = category === 'All' || p.category === category
    return matchesSearch && matchesCategory
  })

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }
  function openEdit(p) {
    setEditing(p)
    setForm({ code: p.code, name: p.name, category: p.category, unitType: p.unitType, quantity: p.quantity, minQuantity: p.minQuantity ?? 5, description: p.description || '' })
    setModalOpen(true)
  }

  async function save(e) {
    e.preventDefault()
    const payload = { ...form, quantity: Number(form.quantity), minQuantity: Number(form.minQuantity), ownerId }
    if (editing) {
      await updateDoc(doc(db, 'products', editing.id), payload)
    } else {
      await addDoc(collection(db, 'products'), { ...payload, createdAt: serverTimestamp() })
    }
    setModalOpen(false)
  }

  async function remove(p) {
    if (confirm(`Delete ${p.name}?`)) await deleteDoc(doc(db, 'products', p.id))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-gold" onClick={openAdd}>+ Add Product</button>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Qty</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">No products yet.</div></td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.category || '—'}</td>
                <td>{p.unitType}</td>
                <td className={p.quantity <= (p.minQuantity ?? 5) ? 'qty-low' : 'qty-ok'}>{p.quantity}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>✏️</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save}>
          <div className="form-grid">
            <div className="form-row"><label>Product Code*</label>
              <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div className="form-row"><label>Product Name*</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label>Category</label>
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="form-row"><label>Unit Type*</label>
              <input className="input" required value={form.unitType} onChange={(e) => setForm({ ...form, unitType: e.target.value })} /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label>Current Quantity</label>
              <input className="input" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="form-row"><label>Minimum Quantity (low-stock threshold)</label>
              <input className="input" type="number" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Description</label>
            <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
