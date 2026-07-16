import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import Modal from '../components/Modal'

const emptyForm = { name: '', phone: '', address: '' }

export default function Customers() {
  const { ownerId } = useAuth()
  const { items: customers, loading } = useTenantCollection('customers')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(c) { setEditing(c); setForm({ name: c.name, phone: c.phone || '', address: c.address || '' }); setModalOpen(true) }

  async function save(e) {
    e.preventDefault()
    if (editing) {
      await updateDoc(doc(db, 'customers', editing.id), form)
    } else {
      await addDoc(collection(db, 'customers'), { ...form, ownerId, totalPurchases: 0, createdAt: serverTimestamp() })
    }
    setModalOpen(false)
  }
  async function remove(c) {
    if (confirm(`Delete ${c.name}?`)) await deleteDoc(doc(db, 'customers', c.id))
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-gold" onClick={openAdd}>+ Add Customer</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>Total Purchases</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading && customers.length === 0 && <tr><td colSpan={4}><div className="empty-state">No customers yet.</div></td></tr>}
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.phone || c.address || '—'}</td><td>{c.totalPurchases || 0}</td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>✏️</button>{' '}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save}>
          <div className="form-row"><label>Customer Name*</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-row"><label>Phone (optional)</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-row"><label>Address (optional)</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
