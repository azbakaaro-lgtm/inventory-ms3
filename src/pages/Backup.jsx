import { useState } from 'react'
import { useTenantCollection } from '../hooks/useTenantCollection'

// Strips Firestore Timestamp objects down to plain ISO strings so the
// backup is a clean, portable JSON file (no special Firestore types).
function cleanForJson(items) {
  return items.map((item) => {
    const out = {}
    Object.entries(item).forEach(([key, value]) => {
      if (value && typeof value.toDate === 'function') {
        out[key] = value.toDate().toISOString()
      } else {
        out[key] = value
      }
    })
    return out
  })
}

export default function Backup() {
  const { items: products } = useTenantCollection('products')
  const { items: sales } = useTenantCollection('sales')
  const { items: stockIn } = useTenantCollection('stockIn')
  const { items: stockOut } = useTenantCollection('stockOut')
  const { items: customers } = useTenantCollection('customers')
  const { items: branches } = useTenantCollection('branches')
  const { items: departments } = useTenantCollection('departments')
  const [downloading, setDownloading] = useState(false)

  function downloadBackup() {
    setDownloading(true)
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        products: cleanForJson(products),
        sales: cleanForJson(sales),
        stockIn: cleanForJson(stockIn),
        stockOut: cleanForJson(stockOut),
        customers: cleanForJson(customers),
        branches: cleanForJson(branches),
        departments: cleanForJson(departments),
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const totalRecords = products.length + sales.length + stockIn.length + stockOut.length + customers.length + branches.length + departments.length

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3>Backup</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Downloads everything in your store — Products, Sales, Stock In/Out, Customers, Branches, and
        Departments — as one JSON file you can keep somewhere safe (Google Drive, email to yourself, a USB
        drive, etc.). This does not restore data automatically; keep it as a safety copy.
      </p>
      <p style={{ fontSize: '0.85rem' }}><strong>{totalRecords}</strong> total records ready to back up.</p>
      <button type="button" className="btn btn-primary" onClick={downloadBackup} disabled={downloading}>
        {downloading ? 'Preparing…' : '⬇ Download Backup (JSON)'}
      </button>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
        Tip: do this regularly (e.g. once a week) and save each file with its date, so you always have a
        recent copy if something ever goes wrong.
      </p>
    </div>
  )
}
