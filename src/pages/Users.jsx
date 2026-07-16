import { useState } from 'react'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, createUserWithoutSigningIn } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import Modal from '../components/Modal'

export default function Users() {
  const { ownerId, isAdmin } = useAuth()
  const { items: users } = useTenantCollection('users')
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isAdmin) return <div className="empty-state">Only admins can manage users.</div>

  async function addUser(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const uid = await createUserWithoutSigningIn(email, password)
      await setDoc(doc(db, 'users', uid), {
        email, name, role: 'staff', ownerId, status: 'active', createdAt: serverTimestamp(),
      })
      setModalOpen(false)
      setName(''); setEmail(''); setPassword('')
    } catch (err) {
      setError(err.message?.includes('email-already') ? 'That email is already registered.' : 'Could not create the account.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleStatus(u) {
    await updateDoc(doc(db, 'users', u.id), { status: u.status === 'active' ? 'suspended' : 'active' })
  }

  return (
    <div>
      <div className="page-header">
        <h2>Staff Accounts</h2>
        <button className="btn btn-gold btn-sm" onClick={() => setModalOpen(true)}>+ Add User</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Only accounts you create here can sign in and see this store's data. Anyone else who signs up won't have access.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.filter((u) => u.role !== 'admin').length === 0 && (
              <tr><td colSpan={5}><div className="empty-state">No staff accounts yet.</div></td></tr>
            )}
            {users.filter((u) => u.role !== 'admin').map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
                <td><span className={`pill ${u.status === 'active' ? 'pill-in' : 'pill-out'}`}>{u.status}</span></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(u)}>
                  {u.status === 'active' ? 'Suspend' : 'Activate'}
                </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title="Add Staff User" onClose={() => setModalOpen(false)}>
        <form onSubmit={addUser}>
          <div className="form-row"><label>Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="form-row"><label>Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="form-row"><label>Temporary Password</label>
            <input className="input" type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {error && <div className="login-error">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
