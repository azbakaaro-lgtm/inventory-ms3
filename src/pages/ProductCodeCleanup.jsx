import { useEffect, useMemo, useState } from 'react'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useTenantCollection } from '../hooks/useTenantCollection'

const CODE_SUFFIX = /-V\d+$/i
const NAME_SUFFIX = /\s*\(Variant\s*\d+\)\s*$/i

function cleanCode(code) {
  return String(code || '').replace(CODE_SUFFIX, '').trim()
}
function cleanName(name) {
  return String(name || '').replace(NAME_SUFFIX, '').trim()
}

export default function ProductCodeCleanup() {
  const { items: products } = useTenantCollection('products')
  const [selected, setSelected] = useState(null) // lazily initialized once products load
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(null)

  const candidates = useMemo(() => {
    return products
      .map((p) => ({ id: p.id, oldCode: p.code, oldName: p.name, newCode: cleanCode(p.code), newName: cleanName(p.name) }))
      .filter((c) => c.newCode !== c.oldCode || c.newName !== c.oldName)
  }, [products])

  // Default every candidate to "included" the first time we see the list.
  useEffect(() => {
    if (selected === null && candidates.length > 0) {
      setSelected(new Set(candidates.map((c) => c.id)))
    }
  }, [candidates, selected])
  const includedIds = selected ?? new Set(candidates.map((c) => c.id))

  function toggle(id) {
    setSelected((prev) => {
      const base = prev ?? new Set(candidates.map((c) => c.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function runCleanup() {
    const toUpdate = candidates.filter((c) => includedIds.has(c.id))
    if (toUpdate.length === 0) return
    setRunning(true)
    try {
      const CHUNK = 400
      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        const batch = writeBatch(db)
        toUpdate.slice(i, i + CHUNK).forEach((c) => {
          batch.update(doc(db, 'products', c.id), { code: c.newCode, name: c.newName })
        })
        await batch.commit()
      }
      setDone(toUpdate.length)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="card">
      <h3>Clean Up Variant Codes</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Removes the old "-V1" / "-V2" suffix from Product Code and "(Variant N)" from Product Name on
        existing products — the same Product Code can already repeat across sizes, distinguished by
        name, so this suffix is no longer needed.
      </p>

      {candidates.length === 0 && !done && <div className="empty-state">No products need cleanup — everything already looks clean 🎉</div>}

      {candidates.length > 0 && !done && (
        <>
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table>
              <thead><tr><th></th><th>Old Code</th><th>New Code</th><th>Old Name</th><th>New Name</th></tr></thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={includedIds.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td>{c.oldCode}</td><td>{c.newCode}</td>
                    <td>{c.oldName}</td><td>{c.newName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" disabled={running} onClick={runCleanup}>
              {running ? 'Updating…' : `Clean Up ${includedIds.size} Product(s)`}
            </button>
          </div>
        </>
      )}

      {done !== null && <p className="qty-ok" style={{ fontWeight: 600 }}>✔ Updated {done} product(s).</p>}
    </div>
  )
}
