import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTenantCollection } from '../hooks/useTenantCollection'
import ItemLookup from '../components/ItemLookup'
import Branches from './Branches'
import Users from './Users'

const TABS = ['Theme & Language', 'Low Stock Settings', 'Item Lookup', 'Branches & Departments', 'Users']

function ThemeLanguage() {
  const [language, setLanguage] = useState('English')
  return (
    <div className="card">
      <h3>Theme & Language</h3>
      <div className="form-row" style={{ maxWidth: 300 }}>
        <label>Theme</label>
        <select className="input" defaultValue="Teal & Gold (default)">
          <option>Teal & Gold (default)</option>
        </select>
      </div>
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

function LowStockSettings() {
  const { items: products } = useTenantCollection('products')
  async function updateMin(p, value) {
    await updateDoc(doc(db, 'products', p.id), { minQuantity: Number(value) })
  }
  return (
    <div className="card">
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

export default function Settings() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('Theme & Language')

  const visibleTabs = TABS.filter((t) => t !== 'Users' || isAdmin)

  return (
    <div>
      <div className="page-header"><h1>Settings</h1></div>
      <div className="tabs">
        {visibleTabs.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Theme & Language' && <ThemeLanguage />}
      {tab === 'Low Stock Settings' && <LowStockSettings />}
      {tab === 'Item Lookup' && <div className="card"><ItemLookup /></div>}
      {tab === 'Branches & Departments' && <Branches />}
      {tab === 'Users' && <Users />}
    </div>
  )
}
