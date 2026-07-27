import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { useAppLogo } from '../hooks/useAppLogo'

function getInitialCollapsed() {
  try {
    return localStorage.getItem('inv_ms_sidebar_collapsed') === '1'
  } catch {
    return false
  }
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)
  const logo = useAppLogo()

  // Keep the browser tab icon in sync with the store's custom logo too.
  useEffect(() => {
    const link = document.querySelector('link[rel="icon"]')
    if (link) link.href = logo
  }, [logo])

  function toggleSidebar() {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      setSidebarOpen((o) => !o)
    } else {
      setCollapsed((c) => {
        const next = !c
        try { localStorage.setItem('inv_ms_sidebar_collapsed', next ? '1' : '0') } catch {}
        return next
      })
    }
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} collapsed={collapsed} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">☰</button>
          <div className="topbar-title"><img src={logo} alt="" className="topbar-logo" /> Inventory MS</div>
          <div style={{ width: 40 }} />
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
