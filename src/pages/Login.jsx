import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'

export default function Login() {
  const { login, firebaseUser, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && firebaseUser) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError('Incorrect email or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell theme="login">
      <div className="login-card">
        <div className="login-brand">Inventory MS</div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Sign in to continue</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 16 }}>
          Forgot your password? Contact your administrator.
        </p>
      </div>
    </AuthShell>
  )
}
