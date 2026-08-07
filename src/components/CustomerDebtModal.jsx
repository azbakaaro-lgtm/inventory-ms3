import { useEffect, useState } from 'react'
import { addDoc, collection, doc, increment, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import SearchSelect from './SearchSelect'
import { generateCustomerDebtPdf } from '../utils/customerDebtPdf'
import { formatMoney } from '../utils/money'

function formatTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleDateString()
}

const emptyLine = { productId: '', qty: 1 }

export default function CustomerDebtModal({ open, onClose, customer, products = [], storeName }) {
  const { ownerId, firebaseUser, branchOwnerId } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState('charge') // 'charge' = took products on credit, 'payment' = paid some back

  // "charge" fields — itemized products taken on credit
  const [lines, setLines] = useState([emptyLine])
  // "payment" fields — a simple amount paid back
  const [paymentAmount, setPaymentAmount] = useState('')
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

  useEffect(() => {
    if (open) { setLines([emptyLine]); setPaymentAmount(''); setNote(''); setError(''); setType('charge') }
  }, [open, customer?.id])

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))

  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))) }
  function addLine() { setLines([...lines, emptyLine]) }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)) }

  const lineDetails = lines
    .filter((l) => l.productId && Number(l.qty) > 0)
    .map((l) => {
      const p = products.find((pp) => pp.id === l.productId)
      const unitPrice = Number(p?.sellingPrice || 0)
      return { productId: l.productId, name: p?.name || '—', qty: Number(l.qty), unitPrice, lineTotal: unitPrice * Number(l.qty) }
    })
  const chargeTotal = lineDetails.reduce((s, l) => s + l.lineTotal, 0)

  async function submitCharge(e) {
    e.preventDefault()
    if (lineDetails.length === 0) return
    setSaving(true)
    setError('')
    try {
      const reference = `CREDIT-${Date.now().toString().slice(-6)}`
      // Record it as a real sale — this deducts stock and shows up on the
      // Dashboard/Reports, same as any other sale — but with payment method
      // "Credit (Owed)" so it's tracked as unpaid.
      await addDoc(collection(db, 'sales'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        branchOwnerId,
        reference,
        customerId: customer.id,
        customerName: customer.name,
        quantity: lineDetails.reduce((s, l) => s + l.qty, 0),
        paymentMethod: 'Credit (Owed)',
        items: lineDetails.map((l) => ({ productId: l.productId, name: l.name, qty: l.qty, unitPrice: l.unitPrice })),
        notes: note || 'Taken on credit',
        status: 'Completed',
        date: serverTimestamp(),
      })
      for (const l of lineDetails) {
        await updateDoc(doc(db, 'products', l.productId), { quantity: increment(-l.qty) })
      }
      const customerRef = doc(db, 'customers', customer.id)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef)
        const currentDebt = Number(snap.data()?.debtBalance || 0)
        const currentPurchases = Number(snap.data()?.totalPurchases || 0)
        tx.update(customerRef, {
          debtBalance: currentDebt + chargeTotal,
          totalPurchases: currentPurchases + lineDetails.reduce((s, l) => s + l.qty, 0),
        })
      })
      await addDoc(collection(db, 'customerDebts'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        customerId: customer.id,
        type: 'charge',
        amount: chargeTotal,
        items: lineDetails,
        saleReference: reference,
        note: note || null,
        date: serverTimestamp(),
      })
      setLines([emptyLine])
      setNote('')
    } catch (err) {
      setError('Could not save this credit purchase. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function submitPayment(e) {
    e.preventDefault()
    const value = Number(paymentAmount)
    if (!value || value <= 0) return
    setSaving(true)
    setError('')
    try {
      const customerRef = doc(db, 'customers', customer.id)
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef)
        const current = Number(snap.data()?.debtBalance || 0)
        tx.update(customerRef, { debtBalance: current - value })
      })
      await addDoc(collection(db, 'customerDebts'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        customerId: customer.id,
        type: 'payment',
        amount: value,
        note: note || null,
        date: serverTimestamp(),
      })
      setPaymentAmount('')
      setNote('')
    } catch (err) {
      setError('Could not save this payment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!customer) return null

  return (
    <Modal open={open} title={`Debt — ${customer.name}`} onClose={onClose} wide>
      <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>
        Currently owed: <span className={Number(customer.debtBalance) > 0 ? 'qty-low' : 'qty-ok'}>{formatMoney(customer.debtBalance)}</span>
      </p>

      <div className="form-row" style={{ maxWidth: 320 }}>
        <label>Type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="charge">Took products on credit (+ owes more)</option>
          <option value="payment">Made a payment (− owes less)</option>
        </select>
      </div>

      {type === 'charge' ? (
        <form onSubmit={submitCharge}>
          <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Products Taken</label>
          {lines.map((line, i) => (
            <div key={i} className="form-grid" style={{ marginTop: 6, alignItems: 'center' }}>
              <SearchSelect options={productOptions} value={line.productId} onChange={(v) => updateLine(i, { productId: v })} placeholder="Select product..." />
              <input className="input" type="number" min="1" value={line.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} />
              {lines.length > 1 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeLine(i)}>✕</button>}
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addLine}>+ Add Product</button>

          {lineDetails.length > 0 && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>Product Name</th><th>Quantity</th><th>Price</th><th>Total</th></tr></thead>
                <tbody>
                  {lineDetails.map((l, i) => (
                    <tr key={i}><td>{l.name}</td><td>{l.qty}</td><td>{formatMoney(l.unitPrice)}</td><td>{formatMoney(l.lineTotal)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 8, fontWeight: 700 }}>Charge Total: {formatMoney(chargeTotal)}</p>

          <div className="form-row" style={{ marginTop: 10 }}><label>Note (optional)</label>
            <input className="input" placeholder="e.g. picked up in person" value={note} onChange={(e) => setNote(e.target.value)} /></div>

          {error && <div className="login-error">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-primary" disabled={saving || lineDetails.length === 0}>{saving ? 'Saving…' : '+ Record Credit Purchase'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitPayment}>
          <div className="form-grid" style={{ marginTop: 6 }}>
            <div className="form-row"><label>Amount Paid*</label>
              <input className="input" type="number" step="0.01" min="0.01" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></div>
            <div className="form-row"><label>Note (optional)</label>
              <input className="input" placeholder="e.g. partial payment" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          {error && <div className="login-error">{error}</div>}
          <div className="modal-footer">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : '+ Record Payment'}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <h4 style={{ margin: 0 }}>History</h4>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => generateCustomerDebtPdf(customer, entries, { storeName })}>
          ⬇ Download Statement (PDF)
        </button>
      </div>
      <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th></tr></thead>
          <tbody>
            {!loading && entries.length === 0 && <tr><td colSpan={4}><div className="empty-state">No debt history yet.</div></td></tr>}
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{formatTime(e.date)}</td>
                <td><span className={`pill ${e.type === 'charge' ? 'pill-out' : 'pill-in'}`}>{e.type === 'charge' ? 'Credit Purchase' : 'Payment'}</span></td>
                <td>{e.items?.length ? e.items.map((it) => `${it.name} x${it.qty}`).join(', ') : (e.note || '—')}</td>
                <td>{e.type === 'charge' ? '+' : '-'}{formatMoney(e.amount)}</td>
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
