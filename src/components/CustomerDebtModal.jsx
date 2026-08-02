import { useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

function formatTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString()
}

export default function CustomerDebtModal({ open, onClose, customer }) {
  const { ownerId, firebaseUser } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('charge') // 'charge' = took products on credit, 'payment' = paid some back
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !customer?.id) return
    setLoading(true)
    const q = query(collection(db, 'customerDebts'), where('ownerId', '==', ownerId), where('customerId', '==', customer.id))
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
      setEntries(rows)
      setLoading(false)
    })
    return unsub
  }, [open, customer?.id, ownerId])

  async function addEntry(e) {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) return
    setSaving(true)
    setError('')
    try {
      const customerRef = doc(db, 'customers', customer.id)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef)
        const current = Number(snap.data()?.debtBalance || 0)
        const delta = type === 'charge' ? value : -value
        tx.update(customerRef, { debtBalance: current + delta })
      })
      await addDoc(collection(db, 'customerDebts'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        customerId: customer.id,
        type,
        amount: value,
        note: note || null,
        date: serverTimestamp(),
      })
      setAmount('')
      setNote('')
    } catch (err) {
      setError('Could not save this entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!customer) return null

  return (
    <Modal open={open} title={`Debt — ${customer.name}`} onClose={onClose} wide>
      <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>
        Currently owed: <span className={Number(customer.debtBalance) > 0 ? 'qty-low' : 'qty-ok'}>{Number(customer.debtBalance || 0).toFixed(2)}</span>
      </p>

      <form onSubmit={addEntry} className="form-grid" style={{ alignItems: 'end' }}>
        <div className="form-row"><label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="charge">Took products on credit (+ owes more)</option>
            <option value="payment">Made a payment (− owes less)</option>
          </select>
        </div>
        <div className="form-row"><label>Amount*</label>
          <input className="input" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div className="form-row"><label>Note (optional)</label>
          <input className="input" placeholder="e.g. 2x jackets, or partial payment" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : '+ Add Entry'}</button>
      </form>
      {error && <div className="login-error">{error}</div>}

      <h4 style={{ marginTop: 18, marginBottom: 6 }}>History</h4>
      <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th></tr></thead>
          <tbody>
            {!loading && entries.length === 0 && <tr><td colSpan={4}><div className="empty-state">No debt history yet.</div></td></tr>}
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{formatTime(e.date)}</td>
                <td><span className={`pill ${e.type === 'charge' ? 'pill-out' : 'pill-in'}`}>{e.type === 'charge' ? 'Credit Purchase' : 'Payment'}</span></td>
                <td>{e.amount.toFixed(2)}</td>
                <td>{e.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
