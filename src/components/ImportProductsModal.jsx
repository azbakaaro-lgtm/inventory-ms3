import { useState } from 'react'
import { writeBatch, collection, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import Modal from './Modal'
import { parseProductFile } from '../utils/productImport'

const CHUNK_SIZE = 400 // stay comfortably under Firestore's 500-write batch limit

export default function ImportProductsModal({ open, onClose, ownerId, subOwnerId, existingProducts }) {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [result, setResult] = useState(null) // { toCreate, skipped, error }
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(null) // { createdCount }

  function reset() {
    setFileName(''); setResult(null); setDone(null)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setDone(null)
    setParsing(true)
    try {
      const parsed = await parseProductFile(file, existingProducts)
      setResult(parsed)
    } catch (err) {
      setResult({ toCreate: [], skipped: [], error: 'Could not read this file. Please upload a valid .xlsx or .csv file.' })
    } finally {
      setParsing(false)
    }
  }

  async function confirmImport() {
    if (!result?.toCreate?.length) return
    setImporting(true)
    try {
      const rows = result.toCreate
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        const batch = writeBatch(db)
        chunk.forEach((row) => {
          const ref = doc(collection(db, 'products'))
          batch.set(ref, { ...row, ownerId, subOwnerId, createdAt: serverTimestamp() })
        })
        await batch.commit()
      }
      setDone({ createdCount: rows.length })
      setResult(null)
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={open} title="Import Products" onClose={handleClose} wide>
      {!result && !done && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Upload an Excel (.xlsx) or CSV (.csv) file. The app will look for columns like
            <strong> Product Code</strong>, <strong>Product Name</strong>, Category, Quantity, and Unit —
            title rows and summary rows are skipped automatically.
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          {parsing && <p>Reading file…</p>}
        </div>
      )}

      {result && !done && (
        <div>
          {result.error ? (
            <div className="login-error">{result.error}</div>
          ) : (
            <>
              <p>
                <strong>{fileName}</strong> — {result.toCreate.length} product(s) ready to import,{' '}
                {result.skipped.length} row(s) skipped.
              </p>
              {result.toCreate.length > 0 && (
                <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Qty</th><th>Unit</th></tr></thead>
                    <tbody>
                      {result.toCreate.slice(0, 200).map((r, i) => (
                        <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.category || '—'}</td><td>{r.quantity}</td><td>{r.unitType}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.skipped.length > 0 && (
                <>
                  <h4 style={{ marginBottom: 6 }}>Skipped rows</h4>
                  <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <table>
                      <thead><tr><th>Row</th><th>Reason</th></tr></thead>
                      <tbody>
                        {result.skipped.map((s, i) => <tr key={i}><td>{s.row}</td><td>{s.reason}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={reset}>Choose Different File</button>
                <button type="button" className="btn btn-primary" disabled={result.toCreate.length === 0 || importing} onClick={confirmImport}>
                  {importing ? 'Importing…' : `Import ${result.toCreate.length} Product(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {done && (
        <div>
          <p className="qty-ok" style={{ fontWeight: 600 }}>
            ✔ Successfully imported {done.createdCount} product(s).
          </p>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={handleClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
