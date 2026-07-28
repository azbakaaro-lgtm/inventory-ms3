import { useState, useEffect } from 'react'
import { doc, updateDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import ItemLookup from '../components/ItemLookup'
import Branches from './Branches'
import Users from './Users'
import ThemeManagement from './ThemeManagement'
import Sessions from './Sessions'
import ProductCodeCleanup from './ProductCodeCleanup'
import ChangePassword from './ChangePassword'
import Backup from './Backup'
import AuditLog from './AuditLog'
import { fileToResizedDataUrl } from '../utils/imageUpload'

const TABS = ['Theme Management', 'Language', 'Low Stock Settings', 'Item Lookup', 'Branches & Departments', 'Users', 'Payment Methods', 'Active Sessions', 'Clean Up Variant Codes', 'Change Password', 'Backup', 'Audit Log']

function LanguageSettings() {
  const [language, setLanguage] = useState('English')
  return (
    <div className="card">
      <h3>Language</h3>
      <div className="form-row" style={{ maxWidth: 300 }}>
        <label>Language</label>
        <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option>English</option>
          <option>Somali</option>
        </select>
      </div>
    </div>
  )
}

import { useScopedCollection } from '../hooks/useScopedCollection'
import UserScopeSelector from '../components/UserScopeSelector'
function LowStockSettings() {
  const { items: products } = useScopedCollection('products')
  async function updateMin(p, value) {
    await updateDoc(doc(db, 'products', p.id), { minQuantity: Number(value) })
  }
  return (
    <div className="card">
      <UserScopeSelector />
      <h3>Set Low Stock Threshold</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Set the minimum quantity for each product. Items at or below this number show as low stock everywhere in the app.
      </p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Current Qty</th><th>Minimum Qty</th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={4}><div className="empty-state">No products yet.</div></td></tr>}
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td><td>{p.name}</td>
                <td className={p.quantity <= (p.minQuantity ?? 5) ? 'qty-low' : 'qty-ok'}>{p.quantity}</td>
                <td>
                  <input className="input" style={{ maxWidth: 100 }} type="number"
                    defaultValue={p.minQuantity ?? 5}
                    onBlur={(e) => updateMin(p, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Admin-managed list of payment methods staff can pick from in POS (e.g.
// EVC Plus, Salaam Bank, eDahab). Each has a name and the store's own
// receiving account/phone number, shown to staff at checkout so they know
// what number to give the customer. Staff can see this list (read-only);
// only admin can add, rename, or remove entries.
const DEFAULT_PAYMENT_METHODS = [
  { id: 'evc', name: 'EVC Plus', account: '' },
  { id: 'salaam', name: 'Salaam Bank', account: '' },
  { id: 'edahab', name: 'eDahab', account: '' },
]

function PaymentMethodsSettings() {
  const { ownerId, isAdmin } = useAuth()
  const [methods, setMethods] = useState(DEFAULT_PAYMENT_METHODS)
  const [storeName, setStoreName] = useState('')
  const [appLogo, setAppLogo] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!ownerId) return
    const ref = doc(db, 'posSettings', ownerId)
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (data?.paymentMethods?.length) setMethods(data.paymentMethods)
      setStoreName(data?.storeName || '')
      setAppLogo(data?.appLogo || '')
    })
    return unsub
  }, [ownerId])

  async function saveAll() {
    setSaving(true)
    setError('')
    setSavedMsg('')
    try {
      await setDoc(doc(db, 'posSettings', ownerId), { paymentMethods: methods, storeName, appLogo }, { merge: true })
      setSavedMsg('✔ Saved')
      setTimeout(() => setSavedMsg(''), 2500)
    } catch (err) {
      setError(`Could not save: ${err.message || 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToResizedDataUrl(file, 256)
      setAppLogo(dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleMethodIconUpload(id, e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await fileToResizedDataUrl(file, 96)
      updateField(id, 'iconData', dataUrl)
    } catch (err) {
      setError(err.message)
    }
  }

  function updateField(id, field, value) {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)))
  }
  function addMethod() {
    setMethods((prev) => [...prev, { id: `m${Date.now()}`, name: 'New Method', account: '' }])
  }
  function removeMethod(id) {
    setMethods((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="card">
      <h3>App Logo</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Replace the cube logo shown in the sidebar and browser tab with your own. Best as a square image.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <img src={appLogo || '/icon.png'} alt="Logo preview" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)' }} />
        {isAdmin && (
          <div>
            <input type="file" accept="image/*" onChange={handleLogoUpload} />
            {appLogo && <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setAppLogo('')}>Reset to default</button>}
          </div>
        )}
      </div>

      <h3 style={{ marginTop: 24 }}>Store Name</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        This name appears at the top of every printed receipt instead of "Inventory MS".
      </p>
      <div className="form-row" style={{ maxWidth: 320 }}>
        <input
          className="input"
          value={storeName}
          disabled={!isAdmin}
          placeholder="e.g. A2Z Sports House"
          onChange={(e) => setStoreName(e.target.value)}
        />
      </div>

      <h3 style={{ marginTop: 24 }}>Payment Methods</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        These are the payment options staff see at checkout in POS. Add your store's own account/phone number,
        and optionally upload each one's real logo, so staff know what to tell the customer.
      </p>
      {!isAdmin && <p style={{ fontStyle: 'italic' }}>Only an admin can change these.</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Icon</th><th>Method Name</th><th>Account / Phone Number</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {methods.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {m.iconData
                      ? <img src={m.iconData} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: '50%' }} />
                      : <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>💰</span>}
                    {isAdmin && <input type="file" accept="image/*" style={{ width: 90 }} onChange={(e) => handleMethodIconUpload(m.id, e)} />}
                  </div>
                </td>
                <td>
                  <input className="input" value={m.name} disabled={!isAdmin} onChange={(e) => updateField(m.id, 'name', e.target.value)} />
                </td>
                <td>
                  <input className="input" value={m.account} disabled={!isAdmin} placeholder="e.g. 61XXXXXXX" onChange={(e) => updateField(m.id, 'account', e.target.value)} />
                </td>
                {isAdmin && (
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeMethod(m.id)}>✕</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost" onClick={addMethod} disabled={saving}>+ Add Payment Method</button>
          <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving}>{saving ? 'Saving…' : '💾 Save Changes'}</button>
          {savedMsg && <span className="qty-ok" style={{ fontWeight: 600 }}>{savedMsg}</span>}
          {error && <span className="login-error" style={{ marginTop: 0 }}>{error}</span>}
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const { isAdmin, isManager } = useAuth()
  const [tab, setTab] = useState('Theme Management')

  const visibleTabs = TABS.filter((t) => {
    if (t === 'Users') return isAdmin || isManager
    if (t === 'Active Sessions' || t === 'Clean Up Variant Codes' || t === 'Payment Methods' || t === 'Backup' || t === 'Audit Log') return isAdmin
    return true
  })

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>
      <div className="tabs">
        {visibleTabs.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Theme Management' && <ThemeManagement />}
      {tab === 'Language' && <LanguageSettings />}
      {tab === 'Low Stock Settings' && <LowStockSettings />}
      {tab === 'Item Lookup' && <div className="card"><ItemLookup /></div>}
      {tab === 'Branches & Departments' && <Branches />}
      {tab === 'Users' && <Users />}
      {tab === 'Payment Methods' && <PaymentMethodsSettings />}
      {tab === 'Active Sessions' && <Sessions />}
      {tab === 'Clean Up Variant Codes' && <ProductCodeCleanup />}
      {tab === 'Change Password' && <ChangePassword />}
      {tab === 'Backup' && <Backup />}
      {tab === 'Audit Log' && <AuditLog />}
    </div>
  )
}
