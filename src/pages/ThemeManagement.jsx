import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

const swatchKeys = ['--teal-700', '--gold-500', '--bg', '--surface']

const emptyColors = {
  '--teal-900': '#073b3a', '--teal-800': '#0b4f4d', '--teal-700': '#0f6b66',
  '--teal-600': '#16897f', '--teal-500': '#1fa895',
  '--gold-500': '#e6b94d', '--gold-400': '#f0cd73',
  '--bg': '#f4faf9', '--surface': '#ffffff', '--surface-2': '#eef7f5',
  '--text-main': '#0d2b2a', '--text-muted': '#52706d', '--border': '#d9ece9',
}

function ThemeSwatch({ colors }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {swatchKeys.map((k) => (
        <span key={k} style={{ width: 18, height: 18, borderRadius: 4, background: colors[k], border: '1px solid rgba(0,0,0,0.15)' }} />
      ))}
    </div>
  )
}

export default function ThemeManagement() {
  const { themes, activeThemeId, setActiveTheme, addTheme, deleteTheme } = useTheme()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [colors, setColors] = useState(emptyColors)
  const [saving, setSaving] = useState(false)

  function updateColor(key, value) {
    setColors((c) => ({ ...c, [key]: value }))
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const id = await addTheme(name.trim(), colors)
      setShowForm(false)
      setName('')
      setColors(emptyColors)
      if (id) await setActiveTheme(id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 4 }}>
        <h3 style={{ margin: 0 }}>Theme Management</h3>
        <button type="button" className="btn btn-gold btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ Add Theme'}
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Choose the color theme for this store. The selection is saved and applies for everyone on
        this account across devices — it stays after logout or refresh.
      </p>

      {showForm && (
        <form onSubmit={handleAdd} className="card" style={{ background: 'var(--surface-2)', marginBottom: 16 }}>
          <div className="form-row"><label>Theme Name*</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emerald Night" /></div>
          <div className="form-grid">
            <div className="form-row"><label>Primary (sidebar/header)</label>
              <input type="color" className="input" value={colors['--teal-700']} onChange={(e) => updateColor('--teal-700', e.target.value)} /></div>
            <div className="form-row"><label>Accent (buttons/highlights)</label>
              <input type="color" className="input" value={colors['--gold-500']} onChange={(e) => updateColor('--gold-500', e.target.value)} /></div>
          </div>
          <div className="form-grid">
            <div className="form-row"><label>Page Background</label>
              <input type="color" className="input" value={colors['--bg']} onChange={(e) => updateColor('--bg', e.target.value)} /></div>
            <div className="form-row"><label>Card / Surface Background</label>
              <input type="color" className="input" value={colors['--surface']} onChange={(e) => updateColor('--surface', e.target.value)} /></div>
          </div>
          <div className="modal-footer">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Theme'}</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Theme</th><th>Preview</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {themes.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td><ThemeSwatch colors={t.colors} /></td>
                <td>{activeThemeId === t.id ? <span className="pill pill-in">Active</span> : '—'}</td>
                <td>
                  {activeThemeId !== t.id && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setActiveTheme(t.id)}>Set Active</button>
                  )}
                  {!t.builtIn && (
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: 6 }} onClick={() => deleteTheme(t.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
