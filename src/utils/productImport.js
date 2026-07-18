import * as XLSX from 'xlsx'

const CODE_HEADERS = ['product code', 'code', 'item code', 'sku']
const NAME_HEADERS = ['product name', 'name', 'item name']
const CATEGORY_HEADERS = ['category', 'product category']
const QTY_HEADERS = ['qty on hand', 'quantity', 'qty', 'stock', 'current quantity']
const UNIT_HEADERS = ['unit type', 'unit', 'uom']

const SUMMARY_LABEL_PATTERNS = [
  /wadarta guud/i, /total qty/i, /^total$/i, /tirada alaabta/i, /items count/i, /grand total/i,
]

function normalize(v) {
  return String(v ?? '').trim()
}

function matchHeader(headerRow, candidates) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = normalize(headerRow[i]).toLowerCase()
    if (!cell) continue
    if (candidates.some((c) => cell === c || cell.includes(c))) return i
  }
  return -1
}

// Scans the first ~15 rows for a row that contains both a "code"-like and
// "name"-like header — real-world exports often have title/date rows above
// the actual table header (as in Bakaaro-style stock sheets).
function findHeaderRowIndex(rows) {
  const scanLimit = Math.min(rows.length, 15)
  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i] || []
    const codeIdx = matchHeader(row, CODE_HEADERS)
    const nameIdx = matchHeader(row, NAME_HEADERS)
    if (codeIdx !== -1 && nameIdx !== -1) return i
  }
  return -1
}

function isSummaryRow(row) {
  return row.some((cell) => SUMMARY_LABEL_PATTERNS.some((re) => re.test(normalize(cell))))
}

// Reads a File (.xlsx/.xls/.csv) and returns { toCreate, skipped, error }.
// - toCreate: [{ code, name, category, quantity, unitType }]
// - skipped: [{ row, reason }] — duplicates (in-file or vs. existing) and
//   rows missing a required field.
export async function parseProductFile(file, existingProducts) {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

  const headerIdx = findHeaderRowIndex(rows)
  if (headerIdx === -1) {
    return { toCreate: [], skipped: [], error: 'Could not find a header row with a Product Code and Product Name column.' }
  }
  const headerRow = rows[headerIdx]
  const codeCol = matchHeader(headerRow, CODE_HEADERS)
  const nameCol = matchHeader(headerRow, NAME_HEADERS)
  const categoryCol = matchHeader(headerRow, CATEGORY_HEADERS)
  const qtyCol = matchHeader(headerRow, QTY_HEADERS)
  const unitCol = matchHeader(headerRow, UNIT_HEADERS)

  const existingCodes = new Set(existingProducts.map((p) => normalize(p.code).toLowerCase()).filter(Boolean))
  const seenInFile = new Set()
  const toCreate = []
  const skipped = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || []
    const isBlank = row.every((c) => normalize(c) === '')
    if (isBlank) continue
    if (isSummaryRow(row)) continue

    const rawCode = normalize(row[codeCol])
    const rawName = normalize(row[nameCol])
    const rowLabel = `Row ${i + 1}`

    if (!rawCode || rawCode === '-') {
      skipped.push({ row: rowLabel, reason: 'Missing Product Code' })
      continue
    }
    if (!rawName || rawName === '-') {
      skipped.push({ row: rowLabel, reason: 'Missing Product Name' })
      continue
    }

    const codeKey = rawCode.toLowerCase()
    if (existingCodes.has(codeKey)) {
      skipped.push({ row: rowLabel, reason: `Duplicate — Product Code "${rawCode}" already exists` })
      continue
    }
    if (seenInFile.has(codeKey)) {
      skipped.push({ row: rowLabel, reason: `Duplicate — Product Code "${rawCode}" repeated in this file` })
      continue
    }
    seenInFile.add(codeKey)

    const quantityRaw = qtyCol !== -1 ? row[qtyCol] : 0
    const quantity = Number(quantityRaw)

    toCreate.push({
      code: rawCode,
      name: rawName,
      category: categoryCol !== -1 ? normalize(row[categoryCol]) : '',
      quantity: Number.isFinite(quantity) ? quantity : 0,
      unitType: unitCol !== -1 && normalize(row[unitCol]) ? normalize(row[unitCol]) : 'Piece',
      minQuantity: 5,
      description: '',
    })
  }

  return { toCreate, skipped, error: null }
}
