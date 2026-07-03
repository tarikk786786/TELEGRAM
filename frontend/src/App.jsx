import { useState, useEffect, useCallback } from 'react';
import { fetchGroups, fetchMarkedGroups, fetchMessages, toggleMarkGroup } from './api';
import Header from './components/Header';
import GroupList from './components/GroupList';
import MessageFeed from './components/MessageFeed';
import LoginPage from './components/LoginPage';

export default function App() {
  /* ── Dashboard state ─────────────────────────────────────── */
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'marked'

  /* ── Load groups directly on mount or tab change ─────────── */
  const loadGroupsList = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setError(null);
      const data = activeTab === 'marked' ? await fetchMarkedGroups() : await fetchGroups();
      const list = Array.isArray(data) ? data : (data?.groups || []);
      setGroups(list);
      setIsUnauthorized(false);
      if (list.length > 0 && !selectedGroup) {
        setSelectedGroup(list[0]);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
      if (err.message.includes('401') || err.message.toLowerCase().includes('authorized')) {
        setIsUnauthorized(true);
      } else {
        setError(err.message || 'Failed to load groups from backend');
      }
    } finally {
      setLoadingGroups(false);
    }
  }, [activeTab, selectedGroup]);

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
          setMessages(data.messages || []);
          setHasMore(!!data.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load messages:', err);
          if (err.message.includes('401') || err.message.toLowerCase().includes('authorized')) {
            setIsUnauthorized(true);
          } else {
            setError(err.message || 'Failed to load messages');
          }
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMsg();
    return () => { cancelled = true; };
  }, [selectedGroup]);

  /* ── Load more messages (pagination) ────────────────────── */
  const handleLoadMore = useCallback(async () => {
    if (!selectedGroup || messages.length === 0) return;
    const lastMsgId = messages[messages.length - 1]?.id;
    if (!lastMsgId) return;

    try {
      const data = await fetchMessages(selectedGroup.id, 50, lastMsgId);
      const newMsgs = data.messages || [];
      setMessages((prev) => [...prev, ...newMsgs]);
      setHasMore(!!data.hasMore);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    }
  }, [selectedGroup, messages]);

  /* ── Toggle mark (star) group ────────────────────────────── */
  const handleToggleMark = useCallback(async (groupId, currentMarked) => {
    const nextMarked = !currentMarked;
    // Optimistic UI update
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, marked: nextMarked } : g))
    );

    try {
      await toggleMarkGroup(groupId, nextMarked);
    } catch (err) {
      // Revert on error
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, marked: currentMarked } : g))
      );
      console.error('Failed to toggle mark:', err);
    }
  }, []);

  /* ── Select group & close mobile sidebar ─────────────────── */
  const handleSelectGroup = useCallback((group) => {
    setSelectedGroup(group);
    setSidebarOpen(false);
  }, []);

  /* ── Handle Login Success ────────────────────────────────── */
  const handleLoginSuccess = useCallback(() => {
    setIsUnauthorized(false);
    loadGroupsList();
  }, [loadGroupsList]);

  /* ── If Unauthorized, render 1-time setup form ───────────── */
  if (isUnauthorized) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  /* ── Render Dashboard ───────────────────────────────────── */
  return (
    <div className="app">
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <Header />

        {/* Tab bar */}
        <div className="tab-bar">
          <button
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Groups
          </button>
          <button
            className={`tab-button ${activeTab === 'marked' ? 'active' : ''}`}
            onClick={() => setActiveTab('marked')}
          >
            ★ Marked
          </button>
        </div>

        <GroupList
          groups={groups}
          selectedGroup={selectedGroup}
          onSelectGroup={handleSelectGroup}
          onToggleMark={handleToggleMark}
          activeTab={activeTab}
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
          groupName={selectedGroup ? selectedGroup.name : ''}
          chatId={selectedGroup ? selectedGroup.id : ''}
          loading={loadingMessages}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </main>
    </div>
  );
}
