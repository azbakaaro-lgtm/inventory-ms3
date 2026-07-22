import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PinGate from './PinGate'

function BrandedLoading({ children }) {
  return (
    <div className="login-page">
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', color: '#eafffb' }}>
        <img src="/icon.png" alt="" style={{ width: 72, height: 72, marginBottom: 14 }} />
        <div>{children}</div>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { firebaseUser, profile, loading } = useAuth()

  if (loading) return <BrandedLoading>Loading…</BrandedLoading>
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (!profile || profile.status !== 'active') {
    return <BrandedLoading>Your account isn't active yet. Ask your admin to activate it.</BrandedLoading>
  }
  return <PinGate>{children}</PinGate>
}
