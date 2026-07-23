import { useState } from 'react'
import { addDoc, collection, doc, updateDoc, increment, runTransaction, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import { useScopedCollection, useOwnCollection, useProductsForSubOwner } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
import Modal from '../components/Modal'
import SearchSelect from '../components/SearchSelect'
import SalesPdfImportModal from '../components/SalesPdfImportModal'

const emptyRows = () => [{ productId: '', qty: 1 }]
const todayStr = () => new Date().toISOString().slice(0, 10)
// Keeps the time-of-day from "now" so same-day edits don't all collapse to midnight.
function dateStrToTimestamp(dateStr) {
  const now = new Date()
  const [y, m, d] = dateStr.split('-').map(Number)
  const combined = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds())
  return Timestamp.fromDate(combined)
}

export default function Sales() {
  const { ownerId, firebaseUser, isAdmin } = useAuth()
  const { items: sales, loading } = useScopedCollection('sales')
  const { items: ownProducts } = useOwnCollection('products') // product picker for a NEW sale
  const { items: customers } = useTenantCollection('customers')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewingSale, setViewingSale] = useState(null)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [editingSale, setEditingSale] = useState(null)
  const [customerId, setCustomerId] = useState('')
  const [rows, setRows] = useState(emptyRows())
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState(todayStr())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // When editing an existing sale, the product picker must show whoever
  // originally created it — not necessarily the current editor's own stock.
  const editSubOwnerId = editingSale?.subOwnerId || firebaseUser?.uid
  const editOwnerProducts = useProductsForSubOwner(editingSale ? editSubOwnerId : null)
  const products = editingSale ? editOwnerProducts : ownProducts

  const productOptions = products.map((p) => ({ value: p.id, label: p.name, sublabel: p.code }))
  const customerOptions = [{ value: '', label: 'Walk-in Customer' }, ...customers.map((c) => ({ value: c.id, label: c.name }))]

  const filtered = sales
    .filter((s) => !search || s.customerName?.toLowerCase().includes(search.toLowerCase()) || s.reference?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))

  function updateRow(i, patch) { setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))) }
  function addRow() { setRows([...rows, { productId: '', qty: 1 }]) }
  function resetForm() { setCustomerId(''); setRows(emptyRows()); setNotes(''); setEditingSale(null); setError(''); setSaleDate(todayStr()) }

  function openNewSale() {
    resetForm()
    setModalOpen(true)
  }

  function openEditSale(sale) {
    setEditingSale(sale)
    setCustomerId(sale.customerId || '')
    setRows((sale.items || []).map((it) => ({ productId: it.productId, qty: it.qty })))
    setNotes(sale.notes || '')
    setSaleDate(sale.date?.toDate ? sale.date.toDate().toISOString().slice(0, 10) : todayStr())
    setError('')
    setModalOpen(true)
  }

  function canManage(sale) {
    return isAdmin || sale.subOwnerId === firebaseUser?.uid
  }

  async function completeSale(e) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.productId && Number(r.qty) > 0)
    if (validRows.length === 0) return
    setBusy(true)
    setError('')
    try {
      if (editingSale) {
        await editSaleTransaction(editingSale, validRows)
      } else {
        await createSale(validRows)
      }
      setModalOpen(false)
      resetForm()
    } catch (err) {
      setError('Could not save this sale. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function createSale(validRows) {
    const customer = customers.find((c) => c.id === customerId)
    const totalQty = validRows.reduce((s, r) => s + Number(r.qty), 0)
    const reference = `SALE-${Date.now().toString().slice(-6)}`

    await addDoc(collection(db, 'sales'), {
      ownerId,
      subOwnerId: firebaseUser.uid,
      reference,
      customerId: customerId || null,
      customerName: customer?.name || 'Walk-in Customer',
      quantity: totalQty,
      items: validRows.map((r) => {
        const p = products.find((pp) => pp.id === r.productId)
        return { productId: r.productId, name: p?.name, qty: Number(r.qty), unitCost: Number(p?.costPrice || 0), unitPrice: Number(p?.sellingPrice || 0) }
      }),
      notes,
      status: 'Completed',
      date: dateStrToTimestamp(saleDate),
    })

    for (const r of validRows) {
      await updateDoc(doc(db, 'products', r.productId), { quantity: increment(-Number(r.qty)) })
    }
    if (customer) {
      await updateDoc(doc(db, 'customers', customer.id), { totalPurchases: increment(totalQty) })
    }
  }

  async function editSaleTransaction(sale, validRows) {
    const newItems = validRows.map((r) => {
      const p = products.find((pp) => pp.id === r.productId)
      return { productId: r.productId, name: p?.name, qty: Number(r.qty), unitCost: Number(p?.costPrice || 0), unitPrice: Number(p?.sellingPrice || 0) }
    })
    const newTotalQty = newItems.reduce((s, r) => s + r.qty, 0)
    const newCustomer = customers.find((c) => c.id === customerId)

    const oldItems = sale.items || []
    const productIds = new Set([...oldItems.map((i) => i.productId), ...newItems.map((i) => i.productId)])
    const customerIds = new Set([sale.customerId, customerId].filter(Boolean))

    await runTransaction(db, async (tx) => {
      const saleRef = doc(db, 'sales', sale.id)

      const productRefs = {}
      const productSnaps = {}
      for (const pid of productIds) {
        const ref = doc(db, 'products', pid)
        productRefs[pid] = ref
        productSnaps[pid] = await tx.get(ref)
      }
      const customerRefs = {}
      const customerSnaps = {}
      for (const cid of customerIds) {
        const ref = doc(db, 'customers', cid)
        customerRefs[cid] = ref
        customerSnaps[cid] = await tx.get(ref)
      }

      const oldQtyByProduct = {}
      oldItems.forEach((i) => { oldQtyByProduct[i.productId] = (oldQtyByProduct[i.productId] || 0) + i.qty })
      const newQtyByProduct = {}
      newItems.forEach((i) => { newQtyByProduct[i.productId] = (newQtyByProduct[i.productId] || 0) + i.qty })

      for (const pid of productIds) {
        const snap = productSnaps[pid]
        if (!snap.exists()) continue
        const delta = (oldQtyByProduct[pid] || 0) - (newQtyByProduct[pid] || 0)
        if (delta !== 0) tx.update(productRefs[pid], { quantity: increment(delta) })
      }

      const oldCustomerId = sale.customerId || null
      if (oldCustomerId && oldCustomerId === customerId) {
        const deltaQty = newTotalQty - (sale.quantity || 0)
        if (deltaQty !== 0 && customerSnaps[oldCustomerId]?.exists()) {
          tx.update(customerRefs[oldCustomerId], { totalPurchases: increment(deltaQty) })
        }
      } else {
        if (oldCustomerId && customerSnaps[oldCustomerId]?.exists()) {
          tx.update(customerRefs[oldCustomerId], { totalPurchases: increment(-(sale.quantity || 0)) })
        }
        if (customerId && customerSnaps[customerId]?.exists()) {
          tx.update(customerRefs[customerId], { totalPurchases: increment(newTotalQty) })
        }
      }

      tx.update(saleRef, {
        customerId: customerId || null,
        customerName: newCustomer?.name || 'Walk-in Customer',
        quantity: newTotalQty,
        items: newItems,
        notes,
        date: dateStrToTimestamp(saleDate),
      })
    })
  }

  async function removeSale(sale) {
    if (!confirm(`Delete sale ${sale.reference}? Stock quantities will be restored.`)) return
    const items = sale.items || []
    const productIds = [...new Set(items.map((i) => i.productId))]

    await runTransaction(db, async (tx) => {
      const saleRef = doc(db, 'sales', sale.id)
      const productRefs = {}
      const productSnaps = {}
      for (const pid of productIds) {
        const ref = doc(db, 'products', pid)
        productRefs[pid] = ref
        productSnaps[pid] = await tx.get(ref)
      }
      let customerRef = null
      let customerSnap = null
      if (sale.customerId) {
        customerRef = doc(db, 'customers', sale.customerId)
        customerSnap = await tx.get(customerRef)
      }

      const qtyByProduct = {}
      items.forEach((i) => { qtyByProduct[i.productId] = (qtyByProduct[i.productId] || 0) + i.qty })
      for (const pid of productIds) {
        if (productSnaps[pid]?.exists()) tx.update(productRefs[pid], { quantity: increment(qtyByProduct[pid] || 0) })
      }
      if (customerRef && customerSnap?.exists()) {
        tx.update(customerRef, { totalPurchases: increment(-(sale.quantity || 0)) })
      }
      tx.delete(saleRef)
    })
  }

  return (
    <div>
      <UserScopeSelector />
      <div className="page-header">
        <h1>Sales</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setPdfImportOpen(true)}>⬆ Import Sales (PDF)</button>
          <button className="btn btn-gold" onClick={openNewSale}>+ New Sale</button>
        </div>
      </div>

      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search by customer or reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Reference</th><th>Customer</th><th>Quantity</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state">No data available</div></td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.date?.toDate ? s.date.toDate().toLocaleDateString() : '—'}</td>
                <td>{s.reference}</td><td>{s.customerName}</td><td>{s.quantity}</td>
                <td><span className="pill pill-in">{s.status}</span></td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setViewingSale(s)}>👁️ View</button>{' '}
                  {canManage(s) && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditSale(s)}>✏️</button>{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => removeSale(s)}>🗑️</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!viewingSale} title={viewingSale ? `Sale — ${viewingSale.reference}` : ''} onClose={() => setViewingSale(null)}>
        {viewingSale && (
          <div>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div><strong>Customer:</strong> {viewingSale.customerName}</div>
              <div><strong>Date:</strong> {viewingSale.date?.toDate ? viewingSale.date.toDate().toLocaleString() : '—'}</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Product</th><th>Qty</th></tr></thead>
                <tbody>
                  {(viewingSale.items || []).map((it, i) => (
                    <tr key={i}><td>{it.name || '—'}</td><td>{it.qty}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewingSale.notes && <p style={{ marginTop: 10 }}><strong>Notes:</strong> {viewingSale.notes}</p>}
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setViewingSale(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalOpen} title={editingSale ? `Edit Sale — ${editingSale.reference}` : 'New Sale'} onClose={() => setModalOpen(false)} wide>
        <form onSubmit={completeSale}>
          <div className="form-grid">
            <div className="form-row"><label>Customer Name (Optional)</label>
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customerOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div className="form-row"><label>Date</label>
              <input className="input" type="date" value={saleDate} max={todayStr()} onChange={(e) => setSaleDate(e.target.value)} required /></div>
          </div>

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

          {error && <div className="login-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editingSale ? 'Save Changes' : 'Complete Sale'}</button>
          </div>
        </form>
      </Modal>

      <SalesPdfImportModal
        open={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
        ownerId={ownerId}
        subOwnerId={firebaseUser?.uid}
        products={ownProducts}
      />
    </div>
  )
}
