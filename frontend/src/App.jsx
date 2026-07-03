import { useState, useEffect, useCallback } from 'react';
import { fetchGroups, fetchMarkedGroups, fetchMessages, toggleMarkGroup, logout } from './api';
import Header from './components/Header';
import GroupList from './components/GroupList';
import MessageFeed from './components/MessageFeed';
import LoginPage from './components/LoginPage';
import SettingsModal from './components/SettingsModal';

export default function App() {
  /* ── State ───────────────────────────────────────────────── */
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'groups' | 'channels' | 'marked'
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ── Load groups directly on mount or tab change ─────────── */
  const loadGroupsList = useCallback(async () => {
    try {
      setLoadingGroups(true);
      setError(null);
      const data = activeTab === 'marked' ? await fetchMarkedGroups() : await fetchGroups();
      const list = Array.isArray(data) ? data : (data?.groups || []);
      setGroups(list);
      setIsUnauthorized(false);
      
      // Update selectedGroup safely without triggering infinite re-renders
      setSelectedGroup((current) => (current ? current : (list.length > 0 ? list[0] : null)));
    } catch (err) {
      console.error('Failed to load groups:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('401') || errMsg.toLowerCase().includes('authorized')) {
        setIsUnauthorized(true);
      } else {
        setError(errMsg || 'Failed to load groups from backend');
      }
    } finally {
      setLoadingGroups(false);
    }
  }, [activeTab]); // ONLY activeTab in dependencies!

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
          console.error('Failed to load messages:', err);
          const errMsg = err?.message || '';
          if (errMsg.includes('401') || errMsg.toLowerCase().includes('authorized')) {
            setIsUnauthorized(true);
          } else {
            setError(errMsg || 'Failed to load messages');
          }
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMsg();
    return () => { cancelled = true; };
  }, [selectedGroup]);

  /* ── Filter groups by tab & search query ────────────────── */
  const filteredGroups = groups.filter((g) => {
    if (!g) return false;
    const query = searchQuery.trim().toLowerCase();
    const nameMatches =
      !query ||
      (g.name || g.title || '').toLowerCase().includes(query) ||
      (g.username || '').toLowerCase().includes(query);

    if (!nameMatches) return false;

    if (activeTab === 'groups') return g.kind === 'group' || g.type === 'private';
    if (activeTab === 'channels') return g.kind === 'channel' || g.type === 'public';
    if (activeTab === 'marked') return !!g.marked;
    return true;
  });

  /* ── Load more messages (pagination) ────────────────────── */
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

  /* ── Toggle mark (star) group ────────────────────────────── */
  const handleToggleMark = useCallback(async (groupId, currentMarked) => {
    const nextMarked = !currentMarked;
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, marked: nextMarked } : g))
    );

    try {
      await toggleMarkGroup(groupId, nextMarked);
    } catch (err) {
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

  /* ── Logout Handler ─────────────────────────────────────── */
  const handleLogout = useCallback(async () => {
    await logout();
    setIsUnauthorized(true);
    setGroups([]);
    setMessages([]);
    setSelectedGroup(null);
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
      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={handleLogout}
      />

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
        <Header
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
        />

        {/* Live Search Box */}
        <div className="search-box-container">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search groups & channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category Tab options */}
        <div className="tab-bar">
          <button
            className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`tab-button ${activeTab === 'groups' ? 'active' : ''}`}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          <button
            className={`tab-button ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            Channels
          </button>
          <button
            className={`tab-button ${activeTab === 'marked' ? 'active' : ''}`}
            onClick={() => setActiveTab('marked')}
          >
            ★ Starred
          </button>
        </div>

        <GroupList
          groups={filteredGroups}
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
