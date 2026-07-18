import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { ONLINE_WINDOW_MS } from '../hooks/useSessionTracker'

function formatTime(ts) {
  if (!ts?.toDate) return '—'
  return ts.toDate().toLocaleString()
}

function isOnline(session) {
  const last = session.lastActive?.toDate ? session.lastActive.toDate().getTime() : 0
  return Date.now() - last < ONLINE_WINDOW_MS
}

export default function Sessions() {
  const { ownerId, isAdmin, firebaseUser } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ownerId) return
    const q = query(collection(db, 'sessions'), where('ownerId', '==', ownerId))
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      rows.sort((a, b) => (b.lastActive?.seconds || 0) - (a.lastActive?.seconds || 0))
      setSessions(rows)
      setLoading(false)
    })
    return unsub
  }, [ownerId])

  if (!isAdmin) return <div className="empty-state">Only admins can view active sessions.</div>

  const onlineCount = sessions.filter(isOnline).length

  async function forceLogout(session) {
    if (!confirm(`Force log out ${session.userName || session.email} on this ${session.device}/${session.browser} session?`)) return
    await updateDoc(doc(db, 'sessions', session.id), { forceLogout: true })
  }

  async function removeDevice(session) {
    if (!confirm('Remove this device/session from the list?')) return
    await deleteDoc(doc(db, 'sessions', session.id))
  }

  return (
    <div>
      <div className="page-header"><h2>Active Sessions</h2></div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Every device currently or recently signed in to this store. A session is shown as Online if
        it has checked in within the last 2 minutes.
      </p>

      <div className="cards-grid" style={{ marginBottom: 18 }}>
        <div className="card card-accent-teal"><div className="card-label">Total Sessions</div><div className="card-value">{sessions.length}</div></div>
        <div className="card card-accent-gold"><div className="card-label">Online Now</div><div className="card-value">{onlineCount}</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th><th>Role</th><th>Device</th><th>Browser</th><th>OS</th>
              <th>IP Address</th><th>Login Time</th><th>Last Active</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && sessions.length === 0 && (
              <tr><td colSpan={10}><div className="empty-state">No sessions recorded yet.</div></td></tr>
            )}
            {sessions.map((s) => {
              const online = isOnline(s)
              const isSelf = s.uid === firebaseUser?.uid
              return (
                <tr key={s.id}>
                  <td>{s.userName || s.email}{isSelf && <span style={{ color: 'var(--text-muted)' }}> (you)</span>}</td>
                  <td>{s.role}</td>
                  <td>{s.device}</td>
                  <td>{s.browser}</td>
                  <td>{s.os}</td>
                  <td>{s.ip || 'Unavailable'}</td>
                  <td>{formatTime(s.loginAt)}</td>
                  <td>{formatTime(s.lastActive)}</td>
                  <td><span className={`pill ${online ? 'pill-in' : 'pill-out'}`}>{online ? 'Online' : 'Offline'}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => forceLogout(s)}>Force Logout</button>{' '}
                    <button className="btn btn-danger btn-sm" onClick={() => removeDevice(s)}>Remove</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
