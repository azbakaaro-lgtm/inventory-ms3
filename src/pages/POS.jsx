import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, updateDoc, increment, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useOwnCollection } from '../hooks/useScopedCollection'

export default function POS() {
  const { ownerId, firebaseUser } = useAuth()
  const { items: products } = useOwnCollection('products')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState([]) // [{ productId, qty, priceOverride? }]
  const [selectedLineId, setSelectedLineId] = useState(null)
  const [keypadMode, setKeypadMode] = useState('qty') // 'qty' | 'price'
  const [keypadBuffer, setKeypadBuffer] = useState('')
  const [payingOpen, setPayingOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState('')
  const [checkingOut, setCheckingOut] = useState(false)
  const [done, setDone] = useState(null)

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (category !== 'All' && p.category !== category) return false
      if (!q) return true
      return p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
    })
  }, [products, search, category])

  function addToCart(productId) {
    setCart((prev) => {
      const existing = prev.find((r) => r.productId === productId)
      if (existing) return prev.map((r) => (r.productId === productId ? { ...r, qty: r.qty + 1 } : r))
      return [...prev, { productId, qty: 1 }]
    })
    selectLine(productId)
  }
  function setQty(productId, qty) {
    const n = Math.max(0, Number(qty) || 0)
    setCart((prev) => (n === 0 ? prev.filter((r) => r.productId !== productId) : prev.map((r) => (r.productId === productId ? { ...r, qty: n } : r))))
  }
  function setPriceOverride(productId, price) {
    setCart((prev) => prev.map((r) => (r.productId === productId ? { ...r, priceOverride: Number(price) || 0 } : r)))
  }
  function removeFromCart(productId) {
    setCart((prev) => prev.filter((r) => r.productId !== productId))
    if (selectedLineId === productId) setSelectedLineId(null)
  }

  // Selecting a cart line makes it the target of the numeric keypad below,
  // mirroring the "tap a line, then type" flow of a typical POS keypad.
  function selectLine(productId) {
    setSelectedLineId(productId)
    setKeypadMode('qty')
    setKeypadBuffer('')
  }
  function keypadPress(key) {
    if (!selectedLineId) return
    if (key === 'qty' || key === 'price') {
      setKeypadMode(key)
      setKeypadBuffer('')
      return
    }
    if (key === 'back') {
      const next = keypadBuffer.slice(0, -1)
      setKeypadBuffer(next)
      applyKeypadValue(next)
      return
    }
    const next = key === '.' && keypadBuffer.includes('.') ? keypadBuffer : keypadBuffer + key
    setKeypadBuffer(next)
    applyKeypadValue(next)
  }
  function applyKeypadValue(bufferStr) {
    const value = bufferStr === '' || bufferStr === '.' ? 0 : Number(bufferStr)
    if (keypadMode === 'qty') setQty(selectedLineId, value)
    else setPriceOverride(selectedLineId, value)
  }

  // Barcode scan handler shared by the scanner modal below.
  function handleScanned(code) {
    const clean = code.trim()
    const match = products.find((p) => p.barcode && p.barcode.trim() === clean) || products.find((p) => p.code === clean)
    if (match) {
      addToCart(match.id)
      setScanMessage(`✔ Added: ${match.name}`)
    } else {
      setScanMessage(`No product found for barcode "${clean}". You can add it to that product in Products.`)
    }
  }

  const cartLines = cart.map((r) => {
    const p = products.find((pp) => pp.id === r.productId)
    const unitPrice = r.priceOverride != null ? r.priceOverride : Number(p?.sellingPrice || 0)
    return { ...r, product: p, unitPrice, lineTotal: unitPrice * r.qty }
  })
  const total = cartLines.reduce((sum, l) => sum + l.lineTotal, 0)
  const totalQty = cartLines.reduce((sum, l) => sum + l.qty, 0)

  async function completeSale(method) {
    if (cartLines.length === 0) return
    setCheckingOut(true)
    try {
      const reference = `POS-${Date.now().toString().slice(-6)}`
      await addDoc(collection(db, 'sales'), {
        ownerId,
        subOwnerId: firebaseUser.uid,
        reference,
        customerId: null,
        customerName: 'Walk-in Customer',
        quantity: totalQty,
        paymentMethod: method,
        items: cartLines.map((l) => ({
          productId: l.productId, name: l.product?.name, qty: l.qty,
          unitCost: Number(l.product?.costPrice || 0), unitPrice: l.unitPrice,
        })),
        notes: 'Completed via POS',
        status: 'Completed',
        date: Timestamp.now(),
      })
      for (const l of cartLines) {
        await updateDoc(doc(db, 'products', l.productId), { quantity: increment(-l.qty) })
      }
      setDone({ reference, total, count: cartLines.length, method })
      setCart([])
      setSelectedLineId(null)
      setPayingOpen(false)
      setPaymentMethod(null)
    } catch (err) {
      setScanMessage('Could not complete the sale. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <div className="pos-page">
      <div className="page-header"><h1>Point of Sale</h1></div>

      <div className="pos-layout">
        <div className="pos-catalog">
          <div className="pos-toolbar">
            <input className="input" placeholder="Search by name, code, or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className="btn btn-primary" onClick={() => { setScanMessage(''); setScannerOpen(true) }}>📷 Scan Barcode</button>
          </div>

          <div className="pos-grid">
            {filtered.map((p) => (
              <button type="button" key={p.id} className="pos-tile" onClick={() => addToCart(p.id)} disabled={!p.sellingPrice}>
                <div className="pos-tile-name">{p.name}</div>
                <div className="pos-tile-code">{p.code}</div>
                <div className="pos-tile-price">{p.sellingPrice ? Number(p.sellingPrice).toFixed(2) : 'No price set'}</div>
              </button>
            ))}
            {filtered.length === 0 && <div className="empty-state">No products match.</div>}
          </div>
        </div>

        <div className="pos-cart">
          <h3>Cart</h3>
          {cartLines.length === 0 && <div className="empty-state">Tap a product or scan a barcode to start.</div>}
          {cartLines.map((l) => (
            <div
              className={`pos-cart-line ${selectedLineId === l.productId ? 'selected' : ''}`}
              key={l.productId}
              onClick={() => selectLine(l.productId)}
            >
              <div className="pos-cart-line-name">{l.product?.name || 'Unknown product'}</div>
              <div className="pos-cart-line-controls">
                <span>{l.qty} × {l.unitPrice.toFixed(2)}</span>
                <span className="pos-cart-line-total">{l.lineTotal.toFixed(2)}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); removeFromCart(l.productId) }}>✕</button>
              </div>
            </div>
          ))}

          {selectedLineId && (
            <div className="pos-keypad">
              <div className="pos-keypad-tabs">
                <button type="button" className={`btn btn-sm ${keypadMode === 'qty' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => keypadPress('qty')}>Qty</button>
                <button type="button" className={`btn btn-sm ${keypadMode === 'price' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => keypadPress('price')}>Price</button>
              </div>
              <div className="pos-keypad-grid">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => (
                  <button type="button" key={k} className="btn btn-ghost pos-keypad-key" onClick={() => keypadPress(k)}>{k === 'back' ? '⌫' : k}</button>
                ))}
              </div>
            </div>
          )}

          <div className="pos-cart-total">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
          <button type="button" className="btn btn-primary pos-checkout-btn" disabled={cartLines.length === 0 || checkingOut} onClick={() => setPayingOpen(true)}>
            {`Payment (${totalQty} item${totalQty === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>

      {payingOpen && (
        <div className="modal-backdrop" onClick={() => !checkingOut && setPayingOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3>Choose Payment Method</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, margin: '8px 0 16px' }}>Total: {total.toFixed(2)}</p>
            <div className="pos-payment-options">
              {['Cash', 'Card', 'Mobile Money'].map((m) => (
                <button
                  type="button"
                  key={m}
                  className={`btn ${paymentMethod === m ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" disabled={checkingOut} onClick={() => setPayingOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={!paymentMethod || checkingOut} onClick={() => completeSale(paymentMethod)}>
                {checkingOut ? 'Saving…' : 'Confirm Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {scannerOpen && (
        <BarcodeScannerModal
          onDetected={(code) => handleScanned(code)}
          onClose={() => setScannerOpen(false)}
          message={scanMessage}
        />
      )}

      {done && (
        <div className="pos-toast">
          ✔ Sale {done.reference} saved — {done.count} item(s), total {done.total.toFixed(2)} ({done.method}).
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDone(null)}>Dismiss</button>
        </div>
      )}
    </div>
  )
}

// A self-contained camera barcode scanner using html5-qrcode. It renders its
// own start/stop and camera-picker UI inside the #pos-barcode-reader div.
// Supports common retail barcode formats (EAN-13/8, UPC-A/E, Code128, Code39)
// in addition to QR, since store products are usually labeled with EAN/UPC.
function BarcodeScannerModal({ onDetected, onClose, message }) {
  const scannerRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let scanner
    let cancelled = false
    import('html5-qrcode').then(({ Html5QrcodeScanner, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return
      scanner = new Html5QrcodeScanner(
        'pos-barcode-reader',
        {
          fps: 10,
          qrbox: { width: 260, height: 160 },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
        },
        false
      )
      scanner.render(
        (decodedText) => onDetected(decodedText),
        () => {} // ignore per-frame "not found" callbacks — expected while aiming the camera
      )
      scannerRef.current = scanner
    }).catch(() => setError('Could not start the camera scanner on this device/browser.'))

    return () => {
      cancelled = true
      if (scannerRef.current) scannerRef.current.clear().catch(() => {})
    }
  }, [onDetected])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h3>Scan a Barcode</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Point the camera at the product's barcode.</p>
        <div id="pos-barcode-reader" />
        {error && <div className="login-error">{error}</div>}
        {message && <p style={{ marginTop: 8 }}>{message}</p>}
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Done Scanning</button>
        </div>
      </div>
    </div>
  )
}
