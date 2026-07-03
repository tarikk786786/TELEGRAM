import { useState, useEffect } from 'react';
import { publishGroup, fetchGroupInviteLink, addCustomGroup, deleteCustomGroup, adminLogin, checkAuthStatus, sendCode, verifyCode, verify2FA } from '../api';

export default function AdminPanel({ groups, onGroupUpdated, isOpen, onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [localGroups, setLocalGroups] = useState(groups || []);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [description, setDescription] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Telegram Auth State
  const [telegramStatus, setTelegramStatus] = useState('checking'); // checking, unauthorized, authorized
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [authStep, setAuthStep] = useState('phone'); // phone, code, 2fa
  const [tgAuthError, setTgAuthError] = useState('');

  useEffect(() => {
    setLocalGroups(groups || []);
  }, [groups]);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isOpen) {
      checkAuthStatus().then(data => {
        setTelegramStatus(data.authorized ? 'authorized' : 'unauthorized');
      }).catch(err => {
        setTelegramStatus('unauthorized');
      });
    }
  }, [isAuthenticated, isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await adminLogin(password);
      if (res.success) {
        sessionStorage.setItem('admin_token', res.token);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setAuthError('Invalid password. Please try again.');
    }
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setTgAuthError('');
    try {
      const res = await sendCode(phoneNumber);
      setPhoneCodeHash(res.phoneCodeHash);
      setAuthStep('code');
    } catch (err) {
      setTgAuthError(err.message);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setTgAuthError('');
    try {
      const res = await verifyCode(phoneNumber, phoneCode, phoneCodeHash);
      if (res.requires2FA) {
        setAuthStep('2fa');
      } else {
        setTelegramStatus('authorized');
        if (onGroupUpdated) onGroupUpdated();
      }
    } catch (err) {
      setTgAuthError(err.message);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setTgAuthError('');
    try {
      await verify2FA(twoFAPassword);
      setTelegramStatus('authorized');
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      setTgAuthError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card admin-modal login-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>🛡️ Admin Login</h2>
            <button className="modal-close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleLogin} className="admin-login-form">
              <p style={{ marginBottom: '1rem', color: '#8b949e' }}>
                Please enter the admin password to access the control panel.
              </p>
              {authError && <div style={{ color: '#ff4d4f', marginBottom: '1rem' }}>{authError}</div>}
              <div className="form-field">
                <input
                  type="password"
                  className="search-input"
                  placeholder="Admin Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="option-btn primary full-width" style={{ marginTop: '1rem' }}>
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const handleTogglePublish = async (group) => {
    const nextPublished = !group.isPublished;
    setSavingId(group.id);

    try {
      await publishGroup(
        group.id,
        nextPublished,
        group.inviteLink,
        group.customTitle || group.name,
        group.name,
        group.description
      );
      setLocalGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, isPublished: nextPublished } : g))
      );
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      console.error('Failed to update public status:', err);
    } finally {
      setSavingId(null);
    }
  };

  const handleStartEdit = (group) => {
    setEditingGroupId(group.id);
    setCustomTitle(group.name || group.title || '');
    setInviteLink(group.inviteLink || '');
    setDescription(group.description || '');
  };

  const handleSaveEdit = async (groupId) => {
    const group = localGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSavingId(groupId);

    try {
      await publishGroup(
        groupId,
        group.isPublished,
        inviteLink.trim(),
        customTitle.trim(),
        group.name,
        description.trim()
      );
      setLocalGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? {
                ...g,
                name: customTitle.trim() || g.rawTitle || g.name,
                inviteLink: inviteLink.trim(),
                description: description.trim(),
              }
            : g
        )
      );
      setEditingGroupId(null);
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      console.error('Failed to save group edit:', err);
    } finally {
      setSavingId(null);
    }
  };



  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Are you sure you want to remove this group link from the public showcase?')) return;
    try {
      await deleteCustomGroup(groupId);
      setLocalGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (onGroupUpdated) onGroupUpdated();
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const handleFetchInvite = async (group) => {
    try {
      const data = await fetchGroupInviteLink(group.id);
      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      }
    } catch (err) {
      console.error('Could not fetch invite link:', err);
    }
  };

  const handleCopyLink = (groupId, link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🛡️ Admin Control Panel — Select & Manage Public Groups</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body admin-body">
          {telegramStatus === 'unauthorized' ? (
            <div className="telegram-login-section" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <h3>🔌 Connect Telegram Account</h3>
              <p style={{ color: '#8b949e', fontSize: '0.9rem', marginBottom: '15px' }}>
                Your backend needs to be connected to your Telegram account to fetch groups. This is only visible to you.
              </p>
              {tgAuthError && <div style={{ color: '#ff4d4f', marginBottom: '10px' }}>{tgAuthError}</div>}
              
              {authStep === 'phone' && (
                <form onSubmit={handleSendCode} style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" className="search-input" placeholder="Phone Number (e.g. +123456789)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required />
                  <button type="submit" className="option-btn primary">Send Code</button>
                </form>
              )}
              {authStep === 'code' && (
                <form onSubmit={handleVerifyCode} style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" className="search-input" placeholder="Login Code from Telegram" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} required />
                  <button type="submit" className="option-btn primary">Verify</button>
                </form>
              )}
              {authStep === '2fa' && (
                <form onSubmit={handleVerify2FA} style={{ display: 'flex', gap: '10px' }}>
                  <input type="password" className="search-input" placeholder="2FA Password" value={twoFAPassword} onChange={e => setTwoFAPassword(e.target.value)} required />
                  <button type="submit" className="option-btn primary">Submit 2FA</button>
                </form>
              )}
            </div>
          ) : telegramStatus === 'checking' ? (
            <div style={{ marginBottom: '20px', color: '#8b949e' }}>Checking Telegram connection...</div>
          ) : (
            <div style={{ marginBottom: '20px', background: 'rgba(46, 160, 67, 0.1)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(46, 160, 67, 0.3)' }}>
              <div style={{ color: '#2ea043', fontWeight: 600, marginBottom: '10px' }}>✅ Telegram Backend Connected</div>
              <div style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '10px' }}>
                <strong>Important:</strong> Because free backend servers restart periodically, your login will be erased. To make this login <strong>PERMANENT</strong> so you never have to log in again:
                <ol style={{ marginLeft: '20px', marginTop: '5px' }}>
                  <li>Copy the Session Key below.</li>
                  <li>Go to your Render Dashboard ➔ Environment Variables.</li>
                  <li>Add a new variable named <strong>TELEGRAM_SESSION</strong> and paste the key.</li>
                </ol>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="password" 
                  className="search-input" 
                  value={localStorage.getItem('telegram_session') || ''} 
                  readOnly 
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                <button 
                  type="button" 
                  className="option-btn" 
                  onClick={() => {
                    navigator.clipboard.writeText(localStorage.getItem('telegram_session') || '');
                    alert('Session Key Copied! Now add it to Render.');
                  }}
                >
                  Copy Key
                </button>
              </div>
            </div>
          )}

          <h3>📋 Manage Public Groups ({localGroups.length})</h3>

          <div className="admin-group-list">
            {localGroups.map((group) => {
              const isEditing = editingGroupId === group.id;
              const isSaving = savingId === group.id;

              return (
                <div key={group.id} className="admin-group-item">
                  <div className="admin-item-top">
                    <div className="admin-item-info">
                      <span className="admin-group-title">
                        {group.name || group.title || `Group ${group.id}`}
                      </span>
                      <div className="admin-item-meta">
                        <span className={`badge ${group.type === 'public' || group.username ? 'public' : 'private'}`}>
                          {group.type === 'public' || group.username ? 'Public' : 'Private'}
                        </span>
                        <span className="kind-badge">{group.kind || 'group'}</span>
                        {group.memberCount && (
                          <span className="member-count">{group.memberCount.toLocaleString()} members</span>
                        )}
                      </div>
                    </div>

                    {/* Toggle Public Visibility */}
                    <div className="admin-toggle-box">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={group.isPublished !== false}
                          onChange={() => handleTogglePublish(group)}
                          disabled={isSaving}
                        />
                        <span className="slider round"></span>
                      </label>
                      <span className="toggle-label">
                        {group.isPublished !== false ? '🌐 Visible: ON' : '🔒 Visible: OFF'}
                      </span>
                    </div>
                  </div>

                  {/* Public Link & Edit Controls */}
                  {isEditing ? (
                    <div className="admin-edit-box">
                      <div className="edit-field">
                        <label>Public Display Title:</label>
                        <input
                          type="text"
                          className="search-input"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                        />
                      </div>
                      <div className="edit-field">
                        <label>Telegram Join / Invite Link (t.me/...):</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            className="search-input"
                            placeholder="https://t.me/yourgroup or invite link..."
                            value={inviteLink}
                            onChange={(e) => setInviteLink(e.target.value)}
                          />
                          <button
                            type="button"
                            className="option-btn"
                            onClick={() => handleFetchInvite(group)}
                          >
                            Auto-Get Link
                          </button>
                        </div>
                      </div>
                      <div className="edit-field">
                        <label>Description:</label>
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Description..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          className="option-btn primary"
                          onClick={() => handleSaveEdit(group.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          className="option-btn"
                          onClick={() => setEditingGroupId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-item-bottom">
                      {group.inviteLink ? (
                        <div className="link-badge">
                          <span>🔗 {group.inviteLink}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={() => handleCopyLink(group.id, group.inviteLink)}
                          >
                            {copiedId === group.id ? 'Copied!' : 'Copy Link'}
                          </button>
                        </div>
                      ) : (
                        <span className="no-link-text">No public join link attached yet</span>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="option-btn"
                          onClick={() => handleStartEdit(group)}
                        >
                          ✏️ Edit
                        </button>
                        {group.id.startsWith('custom_') && (
                          <button
                            type="button"
                            className="option-btn danger"
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
