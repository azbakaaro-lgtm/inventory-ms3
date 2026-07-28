import { useState } from 'react'
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

// Records created before the branch/manager system existed don't have a
// branchOwnerId field, so a branch manager's query (where branchOwnerId ==
// their uid) simply finds nothing for that older data — Firestore equality
// queries never match a missing field. This tool fixes that WITHOUT
// touching anything else:
//   - It only looks at records that are missing branchOwnerId entirely.
//   - It only ever sets branchOwnerId — every other field (quantities,
//     prices, dates, names, etc.) stays exactly as it was.
//   - It sets branchOwnerId to that same record's own subOwnerId, because
//     before branches existed every account was effectively its own branch
//     owner — this matches how new records are created today.
//   - Records that already have branchOwnerId are left untouched.
const COLLECTIONS = ['stockIn', 'stockOut', 'sales']

export default function LegacyBranchDataFix() {
  const { ownerId } = useAuth()
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function run() {
    setStatus('running')
    setError('')
    try {
      const perCollection = {}
      let totalFixed = 0
      for (const colName of COLLECTIONS) {
        const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', ownerId)))
        const missing = snap.docs.filter((d) => {
          const data = d.data()
          return data.branchOwnerId === undefined && data.subOwnerId
        })
        // Firestore batches cap at 500 writes — chunk to stay well under that.
        for (let i = 0; i < missing.length; i += 400) {
          const batch = writeBatch(db)
          missing.slice(i, i + 400).forEach((d) => {
            batch.update(doc(db, colName, d.id), { branchOwnerId: d.data().subOwnerId })
          })
          await batch.commit()
        }
        perCollection[colName] = missing.length
        totalFixed += missing.length
      }
      setResult({ totalFixed, perCollection })
      setStatus('done')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  return (
    <div className="card">
      <h3>Fix Legacy Branch Data</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Stock In, Stock Out, and Sales records created before branch managers existed are missing the
        newer <code>branchOwnerId</code> field, so a manager can't see their own older records for those
        pages (Products already has this fixed). Running this adds the missing field only — it never
        changes any other field, and never touches records that already have it. Safe to run more than
        once; it will simply find nothing left to fix.
      </p>
      {status === 'idle' && (
        <button type="button" className="btn btn-primary" onClick={run}>Run Fix</button>
      )}
      {status === 'running' && <p>Fixing… please don't close this page.</p>}
      {status === 'done' && (
        <div className="qty-ok">
          ✔ Done. Updated {result.totalFixed} record(s) — Stock In: {result.perCollection.stockIn},
          Stock Out: {result.perCollection.stockOut}, Sales: {result.perCollection.sales}.
        </div>
      )}
      {status === 'error' && <div className="login-error">Error: {error}. Nothing was partially changed for a collection until its batch finished — try running it again.</div>}
    </div>
  )
}
