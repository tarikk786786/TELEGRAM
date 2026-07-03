export default function GroupList({ groups, selectedGroup, onSelectGroup, onToggleMark, activeTab }) {
  if (!groups.length) {
    return (
      <div className="group-list">
        <div className="no-messages">
          <p>{activeTab === 'marked' ? 'No marked groups yet. Star a group to see it here.' : 'No groups found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group-list">
      {groups.map((group) => {
        const isActive = selectedGroup?.id === group.id;
        const isPublic =
          group.type === 'supergroup' ||
          group.type === 'channel' ||
          group.type === 'public' ||
          group.username;

        const lastPreview = group.lastMessage
          ? group.lastMessage.length > 50
            ? group.lastMessage.slice(0, 50) + '…'
            : group.lastMessage
          : null;

        return (
          <div
            key={group.id}
            className={`group-card ${isActive ? 'active' : ''}`}
            onClick={() => onSelectGroup(group)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectGroup(group);
              }
            }}
          >
            <div className="group-card-header">
              <span className="group-name">
                {group.title || group.name || `Group ${group.id}`}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {group.unreadCount > 0 && (
                  <span className="unread-badge">{group.unreadCount > 99 ? '99+' : group.unreadCount}</span>
                )}
                <span className={`badge ${isPublic ? 'public' : 'private'}`}>
                  {isPublic ? 'Public' : 'Private'}
                </span>
                <button
                  className={`mark-button ${group.marked ? 'marked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMark(group.id, !group.marked);
                  }}
                  title={group.marked ? 'Unmark group' : 'Mark group'}
                  aria-label={group.marked ? 'Unmark group' : 'Mark group'}
                >
                  {group.marked ? '★' : '☆'}
                </button>
              </div>
            </div>

            {lastPreview && (
              <p className="last-message-preview">{lastPreview}</p>
            )}

            {group.memberCount != null && (
              <div className="group-meta">
                <span className="member-count">
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                  </svg>
                  {group.memberCount.toLocaleString()} members
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
