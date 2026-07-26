import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

function formatTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleString()
}

export default function AuditLog() {
  const { ownerId, isAdmin } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!ownerId || !isAdmin) return
    const q = query(collection(db, 'auditLog'), where('ownerId', '==', ownerId))
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort((a, b) => (b.at?.seconds || 0) - (a.at?.seconds || 0))
      setEntries(rows)
      setLoading(false)
    })
    return unsub
  }, [ownerId, isAdmin])

  if (!isAdmin) return <div className="empty-state">Only admins can view the audit log.</div>

  const filtered = entries.filter((e) =>
    !search ||
    e.userName?.toLowerCase().includes(search.toLowerCase()) ||
    e.action?.toLowerCase().includes(search.toLowerCase()) ||
    e.entityName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header"><h2>Audit Log</h2></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        A running record of who made which changes — new products, edited or deleted sales, stock
        adjustments, and staff account changes.
      </p>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="Search by user, action, or item..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Item</th><th>Details</th></tr></thead>
          <tbody>
            {!loading && filtered.length === 0 && <tr><td colSpan={5}><div className="empty-state">No activity recorded yet.</div></td></tr>}
            {filtered.map((e) => (
              <tr key={e.id}>
                <td>{formatTime(e.at)}</td>
                <td>{e.userName}</td>
                <td>{e.action}</td>
                <td>{e.entityName || '—'}</td>
                <td>{e.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
