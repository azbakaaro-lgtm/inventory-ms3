import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Matches a trailing "<qty> $<amount>" or "<qty> <amount>" pair at the end
// of a line, e.g. "1.0 $6.50" or "46.0 $236.00".
const TRAILING_NUMBERS = /([\d,]+\.?\d*)\s+\$?([\d,]+\.\d{2})\s*$/
// Matches a leading "[CODE]" or "[[CODE]]" style product code.
const CODE_PREFIX = /^\[+\s*([^\]]+?)\s*\]+\s*/

const STOP_SECTIONS = ['taxes on sales', 'payments', 'discounts', 'invoices', 'session control']

function normalize(v) {
  return String(v ?? '').trim()
}

// Groups pdf.js text items into lines using their vertical (y) position —
// items on the same visual line share (roughly) the same y coordinate.
async function extractLines(pdf) {
  const lines = []
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const rows = new Map() // y (rounded) -> array of {x, str}
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5])
      const x = item.transform[4]
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y).push({ x, str: item.str })
    })
    const sortedY = [...rows.keys()].sort((a, b) => b - a) // top to bottom
    sortedY.forEach((y) => {
      const parts = rows.get(y).sort((a, b) => a.x - b.x)
      const line = parts.map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim()
      if (line) lines.push(line)
    })
  }
  return lines
}

// Parses a Daily/Session Sales Report PDF (the "[CODE] Name  Qty  $Amount"
// style export) into product rows. Ignores the money amount per the store's
// requirement — only Qty is used. Rows without a recognizable "[CODE]"
// prefix (branch/category subtotals, discounts, unlabeled items) are
// returned separately under `noCode` so the person can review and decide
// which — if any — to include, rather than guessing automatically.
export async function parseSalesReportPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const lines = await extractLines(pdf)

  const dateMatch = lines.join(' ').match(/As of\s+(\d{1,2}\/\d{1,2}\/\d{4})/i)
  const reportDate = dateMatch ? dateMatch[1] : null

  const withCode = []
  const noCode = []
  let stopped = false

  for (const rawLine of lines) {
    const lower = rawLine.toLowerCase()
    if (STOP_SECTIONS.some((s) => lower.startsWith(s))) { stopped = true; break }
    if (stopped) break
    if (/^total\s/i.test(rawLine) || lower === 'total') continue
    if (lower === 'sales') continue

    const numMatch = rawLine.match(TRAILING_NUMBERS)
    if (!numMatch) continue // not a data row (e.g. address lines, headers)

    const qty = parseFloat(numMatch[1].replace(/,/g, ''))
    if (!Number.isFinite(qty)) continue

    let rest = rawLine.slice(0, numMatch.index).trim()
    const codeMatch = rest.match(CODE_PREFIX)

    if (codeMatch) {
      const code = normalize(codeMatch[1])
      const name = normalize(rest.slice(codeMatch[0].length))
      withCode.push({ code, name, qty, rawLine })
    } else {
      noCode.push({ code: '', name: rest, qty, rawLine })
    }
  }

  return { reportDate, withCode, noCode }
}
