import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <div className="page-loading">Loading…</div>
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (!profile || profile.status !== 'active') {
    return (
      <div className="page-loading">
        Your account isn't active yet. Ask your admin to activate it.
      </div>
    )
  }
  return children
}
