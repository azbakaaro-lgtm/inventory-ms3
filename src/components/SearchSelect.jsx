import { useMemo, useState, useRef, useEffect } from 'react'

// options: [{ value, label, sublabel }]
export default function SearchSelect({ options, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 30)
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q))
      .slice(0, 30)
  }, [query, options])

  useEffect(() => {
    function handleClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="search-select" ref={boxRef}>
      <input
        className="input"
        placeholder={placeholder || 'Search…'}
        value={open ? query : selected?.label || ''}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="search-select-dropdown">
          {filtered.length === 0 && <div className="search-select-empty">No matches</div>}
          {filtered.map((o) => (
            <div
              key={o.value}
              className="search-select-option"
              onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
            >
              <div>{o.label}</div>
              {o.sublabel && <div className="search-select-sub">{o.sublabel}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
