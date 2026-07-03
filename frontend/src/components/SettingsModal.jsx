import { useState } from 'react';
import { getSavedSession, saveSession, logout } from '../api';

export default function SettingsModal({ isOpen, onClose, onLogout }) {
  const [sessionInput, setSessionInput] = useState(getSavedSession());
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(getSavedSession());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSession = () => {
    if (sessionInput.trim()) {
      saveSession(sessionInput.trim());
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ App Settings & Backend Options</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Section: Backend info */}
          <div className="settings-section">
            <h3>Backend Status</h3>
            <div className="info-row">
              <span>InsForge Project:</span>
              <span className="badge-code">TARIK TELEGRAM</span>
            </div>
            <div className="info-row">
              <span>Backend Provider:</span>
              <span className="badge-code">InsForge Postgres BaaS</span>
            </div>
            <div className="info-row">
              <span>API Gateway:</span>
              <span className="badge-code">https://x8cr8qm2.us-east.insforge.app</span>
            </div>
          </div>

          {/* Section: Telegram Session */}
          <div className="settings-section">
            <h3>Telegram Session Key</h3>
            <p className="settings-desc">
              Your encrypted GramJS MTProto session key is stored in browser localStorage for single-click login.
            </p>
            <div className="session-box">
              <input
                type="password"
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                placeholder="Paste GramJS session string..."
                className="session-input"
              />
              <button className="option-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy Key'}
              </button>
            </div>
            {savedMsg && <div className="success-msg">Session key updated!</div>}
          </div>

          {/* Section: Account Actions */}
          <div className="settings-section">
            <h3>Account Operations</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="option-btn primary"
                onClick={handleSaveSession}
              >
                Save Session Changes
              </button>
              <button
                className="option-btn danger"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                Log Out & Switch Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
