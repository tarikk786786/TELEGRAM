import { useState, useEffect, useCallback } from 'react';
import { fetchGroups, fetchPublicGroups, fetchMessages } from './api';
import Header from './components/Header';
import GroupList from './components/GroupList';
import MessageFeed from './components/MessageFeed';
import AdminPanel from './components/AdminPanel';

export default function App() {
  /* ── State ───────────────────────────────────────────────── */
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);

  /* ── Load groups directly on mount or tab change ─────────── */
  const loadGroupsList = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setError(null);
      let data;
      try {
        data = await fetchGroups();
      } catch (err) {
        console.warn('Main groups fetch failed, attempting public groups fallback:', err.message);
        data = await fetchPublicGroups().catch(() => []);
      }

      const list = Array.isArray(data) ? data : (data?.groups || []);
      setGroups(list);
      
      // Update selectedGroup safely without triggering infinite re-renders
      setSelectedGroup((current) => (current ? current : (list.length > 0 ? list[0] : null)));
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError('Could not load groups list.');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    loadGroupsList();
  }, [loadGroupsList]);

  /* ── Load messages when selected group changes ──────────── */
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      return;
    }
    let cancelled = false;

    async function loadMsg() {
      try {
        setLoadingMessages(true);
        setError(null);
        const data = await fetchMessages(selectedGroup.id, 50, 0);
        if (!cancelled) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
          setHasMore(!!data?.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load messages for group:', err.message);
          setMessages([]);
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMsg();
    return () => { cancelled = true; };
  }, [selectedGroup]);

  /* ── Filter groups ────────────────── */
  const filteredGroups = groups.filter((g) => !!g && g.isPublished !== false);
  const handleLoadMore = useCallback(async () => {
    if (!selectedGroup || messages.length === 0) return;
    const lastMsgId = messages[messages.length - 1]?.id;
    if (!lastMsgId) return;

    try {
      const data = await fetchMessages(selectedGroup.id, 50, lastMsgId);
      const newMsgs = Array.isArray(data?.messages) ? data.messages : [];
      setMessages((prev) => [...prev, ...newMsgs]);
      setHasMore(!!data?.hasMore);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    }
  }, [selectedGroup, messages]);

  /* ── Select group ─────────────────── */
  const handleSelectGroup = useCallback((group) => {
    setSelectedGroup(group);
  }, []);

  /* ── Render Dashboard Directly (No Login Gate) ────────── */
  return (
    <div className="app">
      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={adminOpen}
        onClose={() => setAdminOpen(false)}
        groups={groups}
        onGroupUpdated={loadGroupsList}
      />

      {/* Sidebar */}
      <aside className="sidebar">
        <Header
          onOpenAdmin={() => setAdminOpen(true)}
        />

        <GroupList
          groups={filteredGroups}
          selectedGroup={selectedGroup}
          onSelectGroup={handleSelectGroup}
          loading={loadingGroups}
        />
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={loadGroupsList}>Retry</button>
          </div>
        )}

        <MessageFeed
          messages={messages}
          groupName={selectedGroup ? selectedGroup.name || selectedGroup.title || '' : ''}
          chatId={selectedGroup ? selectedGroup.id : ''}
          groupInfo={selectedGroup}
          loading={loadingMessages}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </main>
    </div>
  );
}
