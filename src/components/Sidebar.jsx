import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/pos', label: 'POS', icon: '🛒' },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/stock-in', label: 'Stock In', icon: '⬇️' },
  { to: '/stock-out', label: 'Stock Out', icon: '⬆️' },
  { to: '/sales', label: 'Sales', icon: '🧾' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/reports', label: 'Reports', icon: '📑' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ open, collapsed, onClose }) {
  const { profile, logout, lockNow } = useAuth()

  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''} ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-brand">
          <img src="/icon.png" alt="Inventory MS" className="sidebar-brand-mark" />
          <span className="sidebar-label-text sidebar-brand-text">Inventory MS</span>
        </div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              title={l.label}
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
              onClick={onClose}
            >
              <span className="sidebar-icon">{l.icon}</span>
              <span className="sidebar-label-text">{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user" title={profile?.name}>
            <div className="avatar">{(profile?.name || '?')[0]?.toUpperCase()}</div>
            <div className="sidebar-label-text sidebar-user-info">
              <div className="sidebar-user-name">{profile?.name}</div>
              <div className="sidebar-user-role">{profile?.role}</div>
            </div>
          </div>
          {profile?.pin && (
            <button className="btn btn-ghost logout-btn" onClick={lockNow} title="Lock">
              <span className="sidebar-label-text">Lock</span>
              <span className="logout-icon">🔒</span>
            </button>
          )}
          <button className="btn btn-ghost logout-btn" onClick={logout} title="Logout">
            <span className="sidebar-label-text">Logout</span>
            <span className="logout-icon">⏻</span>
          </button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
    </>
  )
}
