const API_BASE = import.meta.env.VITE_API_URL || '';

/* ── Auth ──────────────────────────────────────────────────── */

export async function checkAuthStatus() {
  const res = await fetch(`${API_BASE}/api/auth/status`);
  if (!res.ok) throw new Error(`Auth check failed (${res.status})`);
  return await res.json();
}

export async function sendCode(phoneNumber) {
  const res = await fetch(`${API_BASE}/api/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, phoneCode, phoneCodeHash }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Verify code failed (${res.status})`);
  }
  return await res.json();
}

export async function verify2FA(password) {
  const res = await fetch(`${API_BASE}/api/auth/verify-2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `2FA verification failed (${res.status})`);
  }
  return await res.json();
}

/* ── Groups ────────────────────────────────────────────────── */

export async function fetchGroups() {
  const res = await fetch(`${API_BASE}/api/groups`);
  if (!res.ok) throw new Error(`Failed to fetch groups (${res.status})`);
  return await res.json();
}

export async function fetchMarkedGroups() {
  const res = await fetch(`${API_BASE}/api/groups/marked`);
  if (!res.ok) throw new Error(`Failed to fetch marked groups (${res.status})`);
  return await res.json();
}

export async function toggleMarkGroup(groupId, marked) {
  const res = await fetch(`${API_BASE}/api/groups/mark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, marked }),
  });
  if (!res.ok) throw new Error(`Failed to toggle mark (${res.status})`);
  return await res.json();
}

/* ── Messages ──────────────────────────────────────────────── */

export async function fetchMessages(groupId, limit = 50, offsetId = 0) {
  const res = await fetch(
    `${API_BASE}/api/groups/${encodeURIComponent(groupId)}/messages?limit=${limit}&offsetId=${offsetId}`
  );
  if (!res.ok) throw new Error(`Failed to fetch messages (${res.status})`);
  return await res.json();
}

/* ── Media ─────────────────────────────────────────────────── */

export function getMediaUrl(chatId, messageId) {
  return `${API_BASE}/api/media/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}`;
}
