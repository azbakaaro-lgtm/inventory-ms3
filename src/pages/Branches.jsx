import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'

function ListEditor({ title, collectionName }) {
  const { ownerId } = useAuth()
  const { items } = useTenantCollection(collectionName)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    await addDoc(collection(db, collectionName), { name, note, ownerId, createdAt: serverTimestamp() })
    setName(''); setNote('')
  }
  async function remove(id) {
    if (confirm('Delete this entry?')) await deleteDoc(doc(db, collectionName, id))
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3>{title}</h3>
      <form onSubmit={add} className="toolbar" style={{ marginTop: 10 }}>
        <input className="input" style={{ maxWidth: 220 }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" style={{ maxWidth: 260 }} placeholder="Description / location (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-primary">+ Add</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Note</th><th>Actions</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={3}><div className="empty-state">None yet.</div></td></tr>}
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.note || '—'}</td>
                <td><button className="btn btn-danger btn-sm" onClick={() => remove(i.id)}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Branches() {
  return (
    <div>
      <div className="page-header"><h1>Branches & Departments</h1></div>
      <ListEditor title="Branches" collectionName="branches" />
      <ListEditor title="Departments" collectionName="departments" />
    </div>
  )
}
