import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import AuthShell from './AuthShell'

function PinDots({ value }) {
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0' }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid var(--teal-600)',
            background: value.length > i ? 'var(--teal-600)' : 'transparent',
          }}
        />
      ))}
    </div>
  )
}

function PinPad({ value, onChange, onSubmit }) {
  function press(d) {
    if (value.length < 4) {
      const next = value + d
      onChange(next)
      if (next.length === 4) onSubmit(next)
    }
  }
  function backspace() {
    onChange(value.slice(0, -1))
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10, justifyContent: 'center' }}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className="btn btn-ghost" style={{ height: 56, fontSize: '1.2rem' }} onClick={() => press(d)}>{d}</button>
      ))}
      <div />
      <button type="button" className="btn btn-ghost" style={{ height: 56, fontSize: '1.2rem' }} onClick={() => press('0')}>0</button>
      <button type="button" className="btn btn-ghost" style={{ height: 56 }} onClick={backspace}>⌫</button>
    </div>
  )
}

function PinSetup() {
  const { setUserPin } = useAuth()
  const [step, setStep] = useState('create') // 'create' | 'confirm'
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleFirstEntry(value) {
    setFirstPin(value)
    setPin('')
    setStep('confirm')
  }

  async function handleConfirm(value) {
    if (value !== firstPin) {
      setError('PINs did not match. Please try again.')
      setFirstPin('')
      setPin('')
      setStep('create')
      return
    }
    await setUserPin(value)
  }

  return (
    <AuthShell theme="pin">
      <div className="login-card">
        <div className="login-brand">Set a PIN</div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, textAlign: 'center' }}>
          {step === 'create' ? 'Create a 4-digit PIN to quickly unlock the app next time.' : 'Enter your new PIN again to confirm.'}
        </p>
        <PinDots value={pin} />
        {error && <div className="login-error">{error}</div>}
        <PinPad
          value={pin}
          onChange={setPin}
          onSubmit={step === 'create' ? handleFirstEntry : handleConfirm}
        />
      </div>
    </AuthShell>
  )
}

function PinUnlock() {
  const { unlockWithPin, logout, profile } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(value) {
    const ok = unlockWithPin(value)
    if (!ok) {
      setError('Incorrect PIN. Please try again.')
      setPin('')
    }
  }

  return (
    <AuthShell theme="pin">
      <div className="login-card">
        <div className="login-brand">Welcome back{profile?.name ? `, ${profile.name}` : ''}</div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0, textAlign: 'center' }}>Enter your 4-digit PIN to continue</p>
        <PinDots value={pin} />
        {error && <div className="login-error">{error}</div>}
        <PinPad value={pin} onChange={setPin} onSubmit={handleSubmit} />
        <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={logout}>
          Not you? Sign out
        </button>
      </div>
    </AuthShell>
  )
}

// Sits in front of the app once someone is signed in: first asks them to
// create a PIN if they don't have one yet, then asks for it on every new
// browser session afterwards — without requiring a full email/password
// sign-in again.
export default function PinGate({ children }) {
  const { profile, pinUnlocked } = useAuth()

  if (pinUnlocked) return children
  if (!profile?.pin) return <PinSetup />
  return <PinUnlock />
}
