import { useState, useEffect, useCallback } from 'react';
import { checkAuthStatus, fetchGroups, fetchMarkedGroups, fetchMessages, toggleMarkGroup } from './api';
import Header from './components/Header';
import GroupList from './components/GroupList';
import MessageFeed from './components/MessageFeed';
import LoginPage from './components/LoginPage';

export default function App() {
  /* ── Auth state ──────────────────────────────────────────── */
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'unauthorized' | 'authorized'

  /* ── Dashboard state ─────────────────────────────────────── */
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'marked'

  /* ── Check auth on mount ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const data = await checkAuthStatus();
        if (!cancelled) {
          setAuthStatus(data.authorized ? 'authorized' : 'unauthorized');
        }
      } catch {
        if (!cancelled) setAuthStatus('unauthorized');
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  /* ── Load groups when authorized or tab changes ──────────── */
  useEffect(() => {
    if (authStatus !== 'authorized') return;
    let cancelled = false;

    async function load() {
      try {
        setLoadingGroups(true);
        setError(null);
        const data = activeTab === 'marked' ? await fetchMarkedGroups() : await fetchGroups();
        const list = Array.isArray(data) ? data : (data?.groups || []);
        if (!cancelled) setGroups(list);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [authStatus, activeTab]);

  /* ── Load messages when a group is selected ─────────────── */
  useEffect(() => {
    if (!selectedGroup) return;
    let cancelled = false;

    async function load() {
      try {
        setLoadingMessages(true);
        setError(null);
        const data = await fetchMessages(selectedGroup.id, 50);
        if (!cancelled) {
          setMessages(data.messages || data);
          setHasMore(data.hasMore || false);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedGroup]);

  /* ── Load more messages ─────────────────────────────────── */
  const handleLoadMore = useCallback(async () => {
    if (!selectedGroup || messages.length === 0) return;
    try {
      const oldestId = messages[0]?.id || 0;
      const data = await fetchMessages(selectedGroup.id, 50, oldestId);
      const newMsgs = data.messages || data;
      setMessages((prev) => [...newMsgs, ...prev]);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err.message);
    }
  }, [selectedGroup, messages]);

  /* ── Select group ───────────────────────────────────────── */
  const handleSelectGroup = useCallback((group) => {
    setSelectedGroup(group);
    setMessages([]);
    setHasMore(false);
    setSidebarOpen(false);
  }, []);

  /* ── Toggle mark ────────────────────────────────────────── */
  const handleToggleMark = useCallback(async (groupId, marked) => {
    try {
      await toggleMarkGroup(groupId, marked);
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, marked } : g))
      );
    } catch (err) {
      setError(err.message);
    }
  }, []);

  /* ── Retry ──────────────────────────────────────────────── */
  const handleRetry = useCallback(() => {
    setError(null);
    if (selectedGroup) {
      setSelectedGroup({ ...selectedGroup });
    } else {
      setLoadingGroups(true);
      const loadFn = activeTab === 'marked' ? fetchMarkedGroups : fetchGroups;
      loadFn()
        .then(setGroups)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingGroups(false));
    }
  }, [selectedGroup, activeTab]);

  /* ── Auth checking / unauthorized → Login ────────────────── */
  if (authStatus === 'checking') {
    return (
      <div className="login-page">
        <div className="loading">
          <div className="loading-spinner" />
          <span className="loading-text">Connecting…</span>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized') {
    return <LoginPage onLoginSuccess={() => setAuthStatus('authorized')} />;
  }

  /* ── Authorized → Dashboard ─────────────────────────────── */
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

        {loadingGroups ? (
          <div className="loading">
            <div className="loading-spinner" />
            <span className="loading-text">Loading groups…</span>
          </div>
        ) : error && !selectedGroup ? (
          <div className="error-state">
            <div className="error-state-icon">⚠️</div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button className="retry-button" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        ) : (
          <GroupList
            groups={groups}
            selectedGroup={selectedGroup}
            onSelectGroup={handleSelectGroup}
            onToggleMark={handleToggleMark}
            activeTab={activeTab}
          />
        )}
      </aside>

      {/* Main content */}
      <main className="main-content">
        {error && selectedGroup ? (
          <div className="error-state">
            <div className="error-state-icon">⚠️</div>
            <h3>Couldn't load messages</h3>
            <p>{error}</p>
            <button className="retry-button" onClick={handleRetry}>
              Try Again
            </button>
          </div>
        ) : selectedGroup ? (
          <MessageFeed
            messages={messages}
            groupName={selectedGroup.title || selectedGroup.name}
            loading={loadingMessages}
            chatId={selectedGroup.id}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/>
              </svg>
            </div>
            <h3>Welcome to Telegram Hub</h3>
            <p>Select a group from the sidebar to browse messages and media content.</p>
          </div>
        )}
      </main>
    </div>
  );
}
