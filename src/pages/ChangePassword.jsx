import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth } from '../firebase'

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
  )
}
