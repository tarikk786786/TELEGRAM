const API_BASE = import.meta.env.VITE_API_URL || '';

// Persistent session storage in browser
export function getSavedSession() {
  return localStorage.getItem('telegram_session') || '';
}

export function saveSession(sessionStr) {
  if (sessionStr) {
    localStorage.setItem('telegram_session', sessionStr);
  }
}

export function clearSavedSession() {
  localStorage.removeItem('telegram_session');
}

function getAuthHeaders(headers = {}) {
  const session = getSavedSession();
  if (session) {
    headers['x-telegram-session'] = session;
  }
  return headers;
}

/* ── Auth ──────────────────────────────────────────────────── */

export async function checkAuthStatus() {
  const res = await fetch(`${API_BASE}/api/auth/status`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Auth check failed (${res.status})`);
  const data = await res.json();
  if (data.session) saveSession(data.session);
  return data;
}

export async function sendCode(phoneNumber) {
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Send code failed (${res.status})`);
  }
  return await res.json();
}

export async function verifyCode(phoneNumber, phoneCode, phoneCodeHash) {
  const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ phoneNumber, phoneCode, phoneCodeHash }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Verify code failed (${res.status})`);
  }
  const data = await res.json();
  if (data.session) saveSession(data.session);
  return data;
}

export async function verify2FA(password) {
  const res = await fetch(`${API_BASE}/api/auth/verify-2fa`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `2FA verification failed (${res.status})`);
  }
  const data = await res.json();
  if (data.session) saveSession(data.session);
  return data;
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch {}
  clearSavedSession();
}

/* ── Groups ────────────────────────────────────────────────── */

export async function fetchGroups() {
  const res = await fetch(`${API_BASE}/api/groups`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch groups (${res.status})`);
  return await res.json();
}

export async function fetchPublicGroups() {
  const res = await fetch(`${API_BASE}/api/groups/public`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch public groups (${res.status})`);
  return await res.json();
}

export async function fetchMarkedGroups() {
  const res = await fetch(`${API_BASE}/api/groups/marked`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch marked groups (${res.status})`);
  return await res.json();
}

export async function toggleMarkGroup(groupId, marked) {
  const res = await fetch(`${API_BASE}/api/groups/mark`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ groupId, marked }),
  });
  if (!res.ok) throw new Error(`Failed to toggle mark (${res.status})`);
  return await res.json();
}

export async function publishGroup(groupId, isPublished, inviteLink = null, customTitle = null, name = null) {
  const res = await fetch(`${API_BASE}/api/groups/publish`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ groupId, isPublished, inviteLink, customTitle, name }),
  });
  if (!res.ok) throw new Error(`Failed to publish group (${res.status})`);
  return await res.json();
}

export async function fetchGroupInviteLink(groupId) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(groupId)}/invite`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to get invite link (${res.status})`);
  return await res.json();
}

/* ── Messages ──────────────────────────────────────────────── */

export async function fetchMessages(groupId, limit = 50, offsetId = 0) {
  const res = await fetch(
    `${API_BASE}/api/groups/${encodeURIComponent(groupId)}/messages?limit=${limit}&offsetId=${offsetId}`,
    {
      headers: getAuthHeaders(),
    }
  );
  if (!res.ok) throw new Error(`Failed to fetch messages (${res.status})`);
  return await res.json();
}

/* ── Media ─────────────────────────────────────────────────── */

export function getMediaUrl(chatId, messageId) {
  const session = getSavedSession();
  const query = session ? `?session=${encodeURIComponent(session)}` : '';
  return `${API_BASE}/api/media/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}${query}`;
}
