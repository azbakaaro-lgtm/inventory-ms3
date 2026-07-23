const CATEGORIES = [
  { icon: '👕', label: 'Clothing' },
  { icon: '💻', label: 'Electronics' },
  { icon: '🛒', label: 'Groceries' },
  { icon: '🏠', label: 'Home Goods' },
]

const FEATURES = [
  { icon: '⏱️', label: 'Real-time tracking' },
  { icon: '🔔', label: 'Low stock alerts' },
  { icon: '📊', label: 'Smart reports' },
]

// Shared two-panel layout for the auth screens (Login, PIN setup/unlock) —
// a branding panel on the left, the actual form card on the right.
// `theme` picks a distinct background so the Login screen and the PIN
// screen don't look identical.
export default function AuthShell({ theme = 'login', children }) {
  return (
    <div className={`auth-shell auth-shell-${theme}`}>
      <div className="auth-panel">
        <div className="auth-cube auth-cube-1" />
        <div className="auth-cube auth-cube-2" />
        <div className="auth-cube auth-cube-3" />
        <div className="auth-panel-content">
          <div className="auth-panel-brand">
            <img src="/icon.png" alt="" className="auth-panel-logo" />
            <div>
              <div className="auth-panel-brand-name">Inventory <span>MS</span></div>
              <div className="auth-panel-tagline">Stock control, simplified</div>
            </div>
          </div>

          <h1 className="auth-headline">
            Manage smarter.<br />
            Stock better.<br />
            <span className="auth-headline-accent">Grow faster.</span>
          </h1>

          <div className="auth-badge-row">
            {CATEGORIES.map((c) => (
              <div key={c.label} className="auth-badge">
                <span className="auth-badge-icon">{c.icon}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>

          <div className="auth-feature-row">
            {FEATURES.map((f) => (
              <div key={f.label} className="auth-feature">
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        {children}
      </div>
    </div>
  )
}
