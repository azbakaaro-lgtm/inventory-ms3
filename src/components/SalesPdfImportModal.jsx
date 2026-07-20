import { useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import Modal from './Modal'
import { parseSalesReportPdf, parseSalesReportText } from '../utils/salesPdfImport'

function normalize(v) {
  return String(v ?? '').trim().toLowerCase()
}

// Finds products sharing this exact code — codes are allowed to repeat
// across sizes/variants, so a single code can have several candidates.
function candidatesForCode(products, code) {
  const key = normalize(code)
  if (!key) return []
  return products.filter((p) => normalize(p.code) === key)
}

// Best-effort auto-pick when a code has multiple size/variant candidates:
// prefer the one whose name shares the most words with the PDF row's name.
function bestGuess(candidates, rowName) {
  if (candidates.length === 1) return candidates[0]
  const rowWords = normalize(rowName).split(/[^a-z0-9]+/).filter(Boolean)
  let best = null
  let bestScore = 0
  candidates.forEach((p) => {
    const nameWords = normalize(p.name).split(/[^a-z0-9]+/).filter(Boolean)
    const score = nameWords.filter((w) => rowWords.includes(w)).length
    if (score > bestScore) { bestScore = score; best = p }
  })
  return bestScore > 0 ? best : null
}

function mmddyyyyToInputDate(str) {
  if (!str) return null
  const [m, d, y] = str.split('/')
  if (!m || !d || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function RowPicker({ row, products, selection, onChange }) {
  return (
    <tr>
      <td><input type="checkbox" checked={selection.included} onChange={(e) => onChange({ ...selection, included: e.target.checked })} /></td>
      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.rawLine}</td>
      <td>{row.qty}</td>
      <td>
        <select
          className="input"
          value={selection.productId || ''}
          onChange={(e) => onChange({ ...selection, productId: e.target.value || null })}
        >
          <option value="">— skip / no match —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
      </td>
    </tr>
  )
}

export default function SalesPdfImportModal({ open, onClose, ownerId, products }) {
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState(null) // { reportDate, withCode, noCode }
  const [selections, setSelections] = useState([]) // [{ included, productId, qty, rawLine }]
  const [saleDate, setSaleDate] = useState('')
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)

  function reset() {
    setFileName(''); setParsed(null); setSelections([]); setSaleDate(''); setDone(null); setError(''); setPasteText(''); setShowPaste(false)
  }

  function applyResult(result) {
    const withCodeSel = result.withCode.map((row) => {
      const candidates = candidatesForCode(products, row.code)
      const guess = bestGuess(candidates, row.name)
      return { included: !!guess, productId: guess?.id || '', qty: row.qty, rawLine: row.rawLine }
    })
    const noCodeSel = result.noCode.map((row) => ({ included: false, productId: '', qty: row.qty, rawLine: row.rawLine }))
    setParsed(result)
    setSelections([...withCodeSel, ...noCodeSel])
    setSaleDate(mmddyyyyToInputDate(result.reportDate) || new Date().toISOString().slice(0, 10))
    if (result.withCode.length === 0 && result.noCode.length === 0) {
      setError('No rows were found. If you uploaded a PDF and got no results, try the "paste text" option below instead.')
    } else {
      setError('')
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParsing(true)
    setError('')
    try {
      const result = await parseSalesReportPdf(file)
      applyResult(result)
    } catch (err) {
      setError('Could not read this PDF. Please make sure it\'s a text-based sales report (not a scanned image), or try the "paste text" option below.')
    } finally {
      setParsing(false)
    }
  }

  function handleParsePastedText() {
    if (!pasteText.trim()) return
    setError('')
    const result = parseSalesReportText(pasteText)
    applyResult(result)
  }

  function updateSelection(index, next) {
    setSelections((prev) => prev.map((s, i) => (i === index ? next : s)))
  }

  const includedRows = selections.filter((s) => s.included && s.productId)
  const totalQty = includedRows.reduce((sum, s) => sum + Number(s.qty || 0), 0)

  async function confirmImport() {
    if (includedRows.length === 0) return
    setImporting(true)
    setError('')
    try {
      const [y, m, d] = saleDate.split('-').map(Number)
      const now = new Date()
      const date = Timestamp.fromDate(new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()))

      const items = includedRows.map((s) => {
        const p = products.find((pp) => pp.id === s.productId)
        return { productId: s.productId, name: p?.name, qty: Number(s.qty) }
      })

      await addDoc(collection(db, 'sales'), {
        ownerId,
        reference: `IMPORT-${Date.now().toString().slice(-6)}`,
        customerId: null,
        customerName: 'Walk-in Customer',
        quantity: totalQty,
        items,
        notes: `Imported from sales report PDF${fileName ? ` (${fileName})` : ''}. Stock was not adjusted — this is a record only.`,
        status: 'Completed',
        date,
      })

      setDone({ count: includedRows.length })
    } catch (err) {
      setError('Could not save the imported sale. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={open} title="Import Sales from PDF Report" onClose={handleClose} wide>
      {!parsed && !done && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Upload a daily/session sales report PDF (the "[Code] Name  Qty  $Amount" style export).
            This only records the <strong>quantity sold</strong> for reporting — it does <strong>not</strong>{' '}
            change product stock, since that report reflects sales that already happened.
          </p>
          <input type="file" accept=".pdf" onChange={handleFile} />
          {parsing && <p>Reading PDF…</p>}
          {error && <div className="login-error">{error}</div>}

          <div style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPaste((s) => !s)}>
              {showPaste ? 'Hide' : 'Or paste the report text instead'}
            </button>
            {showPaste && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Open the PDF, select all the text (Ctrl+A), copy it (Ctrl+C), and paste it below. Use this if uploading the PDF file directly finds no rows.
                </p>
                <textarea className="input" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the sales report text here..." />
                <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleParsePastedText}>Parse Pasted Text</button>
              </div>
            )}
          </div>
        </div>
      )}

      {parsed && !done && selections.length === 0 && (
        <div>
          <div className="login-error">{error || 'No rows were found in this file.'}</div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Try pasting the report text instead — open the PDF, select all (Ctrl+A), copy (Ctrl+C), and paste below.
            </p>
            <textarea className="input" rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste the sales report text here..." />
            <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={handleParsePastedText}>Parse Pasted Text</button>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={reset}>Choose Different File</button>
          </div>
        </div>
      )}

      {parsed && !done && selections.length > 0 && (
        <div>
          <div className="form-row" style={{ maxWidth: 220 }}>
            <label>Sale Date</label>
            <input className="input" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </div>

          <h4 style={{ marginBottom: 4 }}>Matched to a product ({selections.filter((s) => s.included && s.productId).length} selected)</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Review each row — some product codes repeat across sizes, so double-check the picked product matches the size/name in the report line.
          </p>
          <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead><tr><th></th><th>Report Line</th><th>Qty</th><th>Product</th></tr></thead>
              <tbody>
                {selections.map((s, i) => (
                  <RowPicker key={i} row={s} products={products} selection={s} onChange={(next) => updateSelection(i, next)} />
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: 10, fontWeight: 600 }}>Total quantity to record: {totalQty}</p>

          {error && <div className="login-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={reset}>Choose Different File</button>
            <button type="button" className="btn btn-primary" disabled={includedRows.length === 0 || importing} onClick={confirmImport}>
              {importing ? 'Saving…' : `Import ${includedRows.length} Item(s) as One Sale`}
            </button>
          </div>
        </div>
      )}

      {done && (
        <div>
          <p className="qty-ok" style={{ fontWeight: 600 }}>✔ Recorded a sale with {done.count} item(s). Stock quantities were not changed.</p>
          <div className="modal-footer">
            <button type="button" className="btn btn-primary" onClick={handleClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
