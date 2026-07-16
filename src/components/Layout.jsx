import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-title">Inventory MS</div>
          <div style={{ width: 40 }} />
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
