import { useState, useEffect } from 'react';
import { publishGroup, fetchGroupInviteLink } from '../api';

export default function AdminPanel({ groups, onGroupUpdated, isOpen, onClose }) {
  const [localGroups, setLocalGroups] = useState(groups || []);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setLocalGroups(groups || []);
  }, [groups]);

  if (!isOpen) return null;

  const handleTogglePublish = async (group) => {
    const nextPublished = !group.isPublished;
    setSavingId(group.id);

    try {
      await publishGroup(group.id, nextPublished, group.inviteLink, group.customTitle || group.name, group.name);
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
  };

  const handleSaveEdit = async (groupId) => {
    const group = localGroups.find((g) => g.id === groupId);
    if (!group) return;
    setSavingId(groupId);

    try {
      await publishGroup(groupId, group.isPublished, inviteLink.trim(), customTitle.trim(), group.name);
      setLocalGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, name: customTitle.trim() || g.rawTitle || g.name, inviteLink: inviteLink.trim() }
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
          <h2>🛡️ Admin Control Panel — Manage Public Showcase</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body admin-body">
          <p className="settings-desc">
            Select which groups and channels are <strong>Publicly Visible</strong> to web visitors, edit custom titles, and attach Telegram invite/join links (`t.me/...`).
          </p>

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
                        {group.isPublished !== false ? '🌐 Public ON' : '🔒 Private OFF'}
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
                          <button className="option-btn" onClick={() => handleFetchInvite(group)}>
                            Auto-Get Link
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          className="option-btn primary"
                          onClick={() => handleSaveEdit(group.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button className="option-btn" onClick={() => setEditingGroupId(null)}>
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
                            className="copy-btn"
                            onClick={() => handleCopyLink(group.id, group.inviteLink)}
                          >
                            {copiedId === group.id ? 'Copied!' : 'Copy Link'}
                          </button>
                        </div>
                      ) : (
                        <span className="no-link-text">No public join link attached yet</span>
                      )}
                      <button className="option-btn" onClick={() => handleStartEdit(group)}>
                        ✏️ Edit Display & Link
                      </button>
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
