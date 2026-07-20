import { useAuth } from '../context/AuthContext'
import { useViewScope } from '../context/ViewScopeContext'
import { useTenantCollection } from '../hooks/useTenantCollection'

// Lets an admin switch between "All Staff (Combined)" and one specific
// person's data on any page that shows per-user scoped data (Products,
// Stock In, Stock Out, Sales, Dashboard, Reports, Analytics). Renders
// nothing for staff accounts — their view is always locked to themselves.
export default function UserScopeSelector() {
  const { isAdmin, firebaseUser } = useAuth()
  const { viewingUserId, setViewingUserId } = useViewScope()
  const { items: users } = useTenantCollection('users')

  if (!isAdmin) return null

  const sorted = [...users].sort((a, b) => (a.role === 'admin' ? -1 : 1) - (b.role === 'admin' ? -1 : 1))

  return (
    <div className="form-row" style={{ maxWidth: 260, marginBottom: 14 }}>
      <label>Viewing</label>
      <select className="input" value={viewingUserId || ''} onChange={(e) => setViewingUserId(e.target.value || null)}>
        <option value="">All Staff (Combined)</option>
        {sorted.map((u) => (
          <option key={u.id} value={u.id}>{u.name}{u.id === firebaseUser?.uid ? ' (You)' : ''}{u.role === 'admin' ? ' — Admin' : ''}</option>
        ))}
      </select>
    </div>
  )
}
