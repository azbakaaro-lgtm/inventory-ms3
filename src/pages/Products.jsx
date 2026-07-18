import { useState, useMemo } from 'react'
import { addDoc, collection, deleteDoc, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import Modal from '../components/Modal'
import ImportProductsModal from '../components/ImportProductsModal'
import { exportProductsPdf } from '../utils/productPdf'

const emptyForm = { code: '', name: '', category: '', unitType: 'Piece', quantity: 0, minQuantity: 5, description: '' }

export default function Products() {
  const { ownerId } = useAuth()
  const { items: products, loading } = useTenantCollection('products')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

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

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const allSelected = filtered.length > 0 && filtered.every((p) => prev.has(p.id))
      if (allSelected) return new Set()
      return new Set(filtered.map((p) => p.id))
    })
  }

  async function bulkDeleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return
    setBulkDeleting(true)
    try {
      const ids = [...selected]
      const CHUNK = 400
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = writeBatch(db)
        ids.slice(i, i + CHUNK).forEach((id) => batch.delete(doc(db, 'products', id)))
        await batch.commit()
      }
      setSelected(new Set())
    } finally {
      setBulkDeleting(false)
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => exportProductsPdf(products)}>⬇ Export PDF</button>
          <button className="btn btn-ghost" onClick={() => setImportOpen(true)}>⬆ Import Products</button>
          <button className="btn btn-gold" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {selected.size > 0 && (
          <button className="btn btn-danger" onClick={bulkDeleteSelected} disabled={bulkDeleting}>
            {bulkDeleting ? 'Deleting…' : `🗑️ Delete Selected (${selected.size})`}
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} /></th>
              <th>Code</th><th>Name</th><th>Category</th><th>Unit</th><th>Qty</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7}><div className="empty-state">No products yet.</div></td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} /></td>
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

      <ImportProductsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        ownerId={ownerId}
        existingProducts={products}
      />
    </div>
  )
}
