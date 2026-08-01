import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'
import { generateDailyClosePdf } from '../utils/dailyClosePdf'

export default function CloseDailyModal({ open, onClose, sales, storeName, closedBy }) {
  const { ownerId, firebaseUser, branchOwnerId } = useAuth()
  const [sinceTime, setSinceTime] = useState(null) // Date — start of the currently-open register session
  const [loadingSince, setLoadingSince] = useState(true)
  const [closing, setClosing] = useState(false)
  const [justClosed, setJustClosed] = useState(false)

  // Find when the current register session started: right after the last
  // "Close Daily", or the start of today if this branch has never closed.
  useEffect(() => {
    if (!open || !ownerId || !branchOwnerId) return
    setLoadingSince(true)
    setJustClosed(false)
    async function loadLastClose() {
      const q = query(
        collection(db, 'posSessions'),
        where('ownerId', '==', ownerId),
        where('branchOwnerId', '==', branchOwnerId)
      )
      try {
        const snap = await getDocs(q)
        if (!snap.empty) {
          const latest = snap.docs
            .map((d) => d.data())
            .filter((d) => d.closedAt?.toDate)
            .sort((a, b) => b.closedAt.toDate() - a.closedAt.toDate())[0]
          setSinceTime(latest ? latest.closedAt.toDate() : new Date(new Date().setHours(0, 0, 0, 0)))
        } else {
          setSinceTime(new Date(new Date().setHours(0, 0, 0, 0))) // start of today
        }
      } catch {
        setSinceTime(new Date(new Date().setHours(0, 0, 0, 0)))
      } finally {
        setLoadingSince(false)
      }
    }
    loadLastClose()
  }, [open, ownerId, branchOwnerId])

  const openSales = useMemo(() => {
    if (!sinceTime) return []
    return sales.filter((s) => s.date?.toDate && s.date.toDate() > sinceTime)
  }, [sales, sinceTime])

  const paymentTotals = useMemo(() => {
    const totals = new Map()
    openSales.forEach((sale) => {
      const method = sale.paymentMethod || 'Unspecified'
      const saleTotal = (sale.items || []).reduce((s, it) => s + Number(it.unitPrice || 0) * Number(it.qty || 0), 0)
      totals.set(method, (totals.get(method) || 0) + saleTotal)
    })
    return [...totals.entries()]
  }, [openSales])

  const grandTotal = paymentTotals.reduce((s, [, v]) => s + v, 0)
  const totalItems = openSales.reduce((s, sale) => s + (sale.items || []).reduce((s2, it) => s2 + Number(it.qty || 0), 0), 0)

  async function closeAndDownload() {
    setClosing(true)
    try {
      const now = new Date()
      generateDailyClosePdf(openSales, { storeName, date: now, closedBy })
      await addDoc(collection(db, 'posSessions'), {
        ownerId,
        branchOwnerId,
        subOwnerId: firebaseUser.uid,
        closedBy: closedBy || null,
        openedAt: Timestamp.fromDate(sinceTime),
        closedAt: serverTimestamp(),
        salesCount: openSales.length,
        totalItems,
        grandTotal,
        paymentTotals: Object.fromEntries(paymentTotals),
      })
      setJustClosed(true)
      setSinceTime(now) // the new session starts now, right where we left off
    } finally {
      setClosing(false)
    }
  }

  return (
    <Modal open={open} title="Close Daily" onClose={onClose}>
      {loadingSince && <p>Loading current register session…</p>}

      {!loadingSince && (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {justClosed
              ? '✔ This register session has been closed. A new session has started — new sales will count from here.'
              : `Showing everything sold since the last close (${sinceTime.toLocaleString()}). Closing finalizes this session and starts a fresh one.`}
          </p>

          <div className="cards-grid" style={{ marginTop: 14 }}>
            <div className="card card-accent-teal"><div className="card-label">Sales</div><div className="card-value">{openSales.length}</div></div>
            <div className="card card-accent-gold"><div className="card-label">Items Sold</div><div className="card-value">{totalItems}</div></div>
          </div>

          <h4 style={{ marginTop: 18, marginBottom: 6 }}>Payment Breakdown</h4>
          {paymentTotals.length === 0 && <div className="empty-state">No sales recorded in this session yet.</div>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th>Amount</th></tr></thead>
              <tbody>
                {paymentTotals.map(([method, total]) => (
                  <tr key={method}><td>{method}</td><td>{total.toFixed(2)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 10, fontWeight: 700, fontSize: '1.1rem' }}>Grand Total: {grandTotal.toFixed(2)}</p>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary" disabled={openSales.length === 0 || closing} onClick={closeAndDownload}>
              {closing ? 'Closing…' : '🔒 Close Register & Download PDF'}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
