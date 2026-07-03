import { useState, useEffect } from 'react';
import { publishGroup, fetchGroupInviteLink, addCustomGroup, deleteCustomGroup } from '../api';

export default function AdminPanel({ groups, onGroupUpdated, isOpen, onClose }) {
  const [localGroups, setLocalGroups] = useState(groups || []);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [description, setDescription] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // New Group Form State
  const [newName, setNewName] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newKind, setNewKind] = useState('group'); // 'group' | 'channel'
  const [newType, setNewType] = useState('public'); // 'public' | 'private'
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState(null);

  useEffect(() => {
    setLocalGroups(groups || []);
  }, [groups]);

  if (!isOpen) return null;

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

  const handleAddCustomGroup = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    setAddMsg(null);

    try {
      const res = await addCustomGroup(
        newName.trim(),
        newLink.trim(),
        newType,
        newKind,
        newDesc.trim()
      );

      if (res.group) {
        setLocalGroups((prev) => [res.group, ...prev]);
        setNewName('');
        setNewLink('');
        setNewDesc('');
        setAddMsg('✅ Group added and published to website!');
        setTimeout(() => setAddMsg(null), 3000);
        if (onGroupUpdated) onGroupUpdated();
      }
    } catch (err) {
      console.error('Failed to add custom group:', err);
      setAddMsg('❌ Failed to add group. Please try again.');
    } finally {
      setAdding(false);
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
          {/* ➕ Add New Group / Channel Form */}
          <form className="add-group-form" onSubmit={handleAddCustomGroup}>
            <h3>➕ Add Any Telegram Group or Channel Link</h3>
            {addMsg && <div className="add-msg">{addMsg}</div>}

            <div className="form-row">
              <div className="form-field flex-2">
                <label>Group / Channel Title:</label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="e.g. VIP Trading Signals"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="form-field flex-3">
                <label>Telegram Link or Username (`t.me/...`):</label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="https://t.me/yourgroup or @username"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field flex-1">
                <label>Category:</label>
                <select
                  className="search-input"
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value)}
                >
                  <option value="group">Group</option>
                  <option value="channel">Channel</option>
                </select>
              </div>

              <div className="form-field flex-1">
                <label>Privacy Type:</label>
                <select
                  className="search-input"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="form-field flex-2">
                <label>Short Description (Optional):</label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Short description..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="option-btn primary full-width" disabled={adding}>
              {adding ? 'Adding to Website…' : '🚀 Add & Publish Group Link'}
            </button>
          </form>

          <hr className="admin-divider" />

          <h3>📋 Manage Existing & Fetched Groups ({localGroups.length})</h3>

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
