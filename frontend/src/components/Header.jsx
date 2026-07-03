export default function Header({ onOpenSettings, onLogout }) {
  return (
    <div className="header">
      <div className="header-content">
        <div className="header-icon">
          {/* Telegram paper-plane logo */}
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
          </svg>
        </div>
        <div className="header-text" style={{ flex: 1 }}>
          <h1>Telegram Hub</h1>
          <p>All your groups in one place</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Settings & Options"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ⚙️
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              title="Log Out"
              style={{
                background: 'rgba(255, 107, 107, 0.15)',
                border: '1px solid rgba(255, 107, 107, 0.3)',
                color: '#ff6b6b',
                borderRadius: '8px',
                padding: '0.4rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Log Out
            </button>
          )}
        </div>
      </div>
      <div className="header-separator" />
    </div>
  );
}
