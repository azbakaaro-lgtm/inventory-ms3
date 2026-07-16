import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const links = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/stock-in', label: 'Stock In', icon: '⬇️' },
  { to: '/stock-out', label: 'Stock Out', icon: '⬆️' },
  { to: '/sales', label: 'Sales', icon: '🧾' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/reports', label: 'Reports', icon: '📑' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Sidebar({ open, onClose }) {
  const { profile, logout } = useAuth()

  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">Inventory MS</div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
              onClick={onClose}
            >
              <span className="sidebar-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{(profile?.name || '?')[0]?.toUpperCase()}</div>
            <div>
              <div className="sidebar-user-name">{profile?.name}</div>
              <div className="sidebar-user-role">{profile?.role}</div>
            </div>
          </div>
          <button className="btn btn-ghost logout-btn" onClick={logout}>Logout</button>
        </div>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
    </>
  )
}
