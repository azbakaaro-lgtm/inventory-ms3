import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

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
    } catch (signInErr) {
      // No account with this email/password yet — this is how the very first
      // admin (and, later, anyone typing a brand-new email) gets created.
      try {
        await createUserWithEmailAndPassword(auth, email, password)
      } catch (createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          setError('That email exists already — the password you typed is incorrect.')
        } else if (createErr.code === 'auth/weak-password') {
          setError('Password must be at least 6 characters.')
        } else if (createErr.code === 'auth/invalid-email') {
          setError('Please enter a valid email address.')
        } else {
          setError('Could not sign in. Please try again.')
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
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
          First time signing in on a brand-new project? Signing in creates the admin account automatically.
          New staff accounts are created by the admin from Settings → Users.
        </p>
      </div>
    </div>
  )
}
