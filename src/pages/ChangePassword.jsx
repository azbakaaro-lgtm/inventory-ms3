import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

function ChangePin() {
  const { profile, setUserPin } = useAuth()
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)

    if (profile?.pin && currentPin !== profile.pin) {
      setError('Your current PIN is incorrect.')
      return
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.')
      return
    }
    await setUserPin(newPin)
    setDone(true)
    setCurrentPin(''); setNewPin(''); setConfirmPin('')
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h3>{profile?.pin ? 'Change PIN' : 'Set PIN'}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Your 4-digit PIN is asked for each time you reopen the app on this device, instead of your full password.
      </p>
      <form onSubmit={handleSubmit}>
        {profile?.pin && (
          <div className="form-row"><label>Current PIN*</label>
            <input className="input" type="password" inputMode="numeric" maxLength={4} required value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} /></div>
        )}
        <div className="form-row"><label>New PIN (4 digits)*</label>
          <input className="input" type="password" inputMode="numeric" maxLength={4} required value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} /></div>
        <div className="form-row"><label>Confirm New PIN*</label>
          <input className="input" type="password" inputMode="numeric" maxLength={4} required value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} /></div>

        {error && <div className="login-error">{error}</div>}
        {done && <p className="qty-ok" style={{ fontWeight: 600 }}>✔ PIN saved.</p>}

        <div className="modal-footer">
          <button className="btn btn-primary">{profile?.pin ? 'Change PIN' : 'Set PIN'}</button>
        </div>
      </form>
    </div>
  )
}

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setBusy(true)
    try {
      const user = auth.currentUser
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setDone(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Your current password is incorrect.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a bit and try again.')
      } else {
        setError('Could not change your password. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ maxWidth: 420 }}>
        <h3>Change Password</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          This changes the password for your own account ({auth.currentUser?.email}).
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-row"><label>Current Password*</label>
            <input className="input" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
          <div className="form-row"><label>New Password*</label>
            <input className="input" type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          <div className="form-row"><label>Confirm New Password*</label>
            <input className="input" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>

          {error && <div className="login-error">{error}</div>}
          {done && <p className="qty-ok" style={{ fontWeight: 600 }}>✔ Password changed successfully.</p>}

          <div className="modal-footer">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</button>
          </div>
        </form>
      </div>
      <ChangePin />
    </div>
  )
}
