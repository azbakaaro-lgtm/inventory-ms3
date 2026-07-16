import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import Modal from '../components/Modal'
import SearchSelect from '../components/SearchSelect'

export default function StockIn() {
  const { ownerId } = useAuth()
  const { items: entries, loading } = useTenantCollection('stockIn')
  const { items: products } = useTenantCollection('products')
  const { items: branches } = useTenantCollection('branches')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  const total = entries.reduce((s, e) => s + Number(e.quantity || 0), 0)
  const filtered = entries
    .filter((e) => !search || e.productName?.toLowerCase().includes(search.toLowerCase()) || e.productCode?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))
  const branchOptions = branches.map((b) => ({ value: b.id, label: b.name }))

  function resetForm() { setProductId(''); setBranchId(''); setQuantity(''); setNote('') }

  async function save(e) {
    e.preventDefault()
    const product = products.find((p) => p.id === productId)
    const branch = branches.find((b) => b.id === branchId)
    if (!product || !quantity) return
    await addDoc(collection(db, 'stockIn'), {
      ownerId,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      unitType: product.unitType,
      quantity: Number(quantity),
      branchId: branch?.id || null,
      branchName: branch?.name || '—',
      note,
      date: serverTimestamp(),
    })
    await updateDoc(doc(db, 'products', product.id), { quantity: increment(Number(quantity)) })
    setModalOpen(false)
    resetForm()
  }

  async function remove(entry) {
    if (!confirm('Delete this stock-in entry? (This will not automatically reverse the quantity.)')) return
    await deleteDoc(doc(db, 'stockIn', entry.id))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Stock In</h1>
        <button className="btn btn-gold" onClick={() => setModalOpen(true)}>+ Add Stock</button>
      </div>

      <div className="card card-big-teal" style={{ marginBottom: 18, maxWidth: 320 }}>
        <div className="card-label">Total Stock Added</div>
        <div className="card-value">{total}</div>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Code</th><th>Name</th><th>Qty +</th><th>Unit</th><th>Branch</th><th>Note</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={8}><div className="empty-state">No stock-in entries yet.</div></td></tr>}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : '—'}</td>
                <td>{e.productCode}</td><td>{e.productName}</td>
                <td className="qty-ok">+{e.quantity}</td>
                <td>{e.unitType}</td><td>{e.branchName}</td><td>{e.note || '—'}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(e)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title="Add Stock" onClose={() => setModalOpen(false)}>
        <form onSubmit={save}>
          <div className="form-row"><label>Select Product*</label>
            <SearchSelect options={productOptions} value={productId} onChange={setProductId} placeholder="Search product name or code..." /></div>
          <div className="form-row"><label>Branch</label>
            <SearchSelect options={branchOptions} value={branchId} onChange={setBranchId} placeholder="Search branch..." /></div>
          <div className="form-row"><label>Quantity*</label>
            <input className="input" type="number" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
          <div className="form-row"><label>Reference Note</label>
            <input className="input" placeholder="Invoice #, purchase reference" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
