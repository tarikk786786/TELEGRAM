// ─────────────────────────────────────────────────────────────
//  Groups Routes — Admin Group Control & Public Publishing
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Api } = require('telegram/tl');
const { client } = require('../server');

const MARKED_FILE = path.join(__dirname, '..', 'marked_groups.json');
const PUBLISHED_FILE = path.join(__dirname, '..', 'published_groups.json');

// ── Helpers ─────────────────────────────────────────────────

function loadJsonMap(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data && typeof data === 'object' ? data : {};
    }
  } catch (err) {
    console.warn(`⚠️ Could not load ${path.basename(filePath)}:`, err.message);
  }
  return {};
}

function saveJsonMap(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`❌ Failed to save ${path.basename(filePath)}:`, err.message);
  }
}

function isChannel(entity) {
  if (!entity) return false;
  return entity.className === 'Channel' && !entity.megagroup;
}

function formatGroup(dialog, entity, isMarked, publishMeta = {}) {
  const id = entity.id.toString();
  const type = entity.username ? 'public' : 'private';
  const kind = isChannel(entity) ? 'channel' : 'group';
  const defaultLink = entity.username ? `https://t.me/${entity.username}` : null;

  return {
    id,
    name: publishMeta.customTitle || entity.title || entity.first_name || 'Untitled Group',
    rawTitle: entity.title || entity.first_name || 'Untitled Group',
    type,
    kind,
    username: entity.username || null,
    memberCount: entity.participantsCount || null,
    unreadCount: dialog.unreadCount || 0,
    lastMessage: dialog.message?.message
      ? dialog.message.message.substring(0, 120)
      : null,
    lastMessageDate: dialog.message?.date
      ? new Date(dialog.message.date * 1000).toISOString()
      : null,
    marked: isMarked,
    isPublished: publishMeta.isPublished !== undefined ? publishMeta.isPublished : true,
    inviteLink: publishMeta.inviteLink || defaultLink,
  };
}

// ── GET /api/groups ─────────────────────────────────────────
// Fetch ALL groups for Admin
router.get('/', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const markedMap = loadJsonMap(MARKED_FILE);
    const publishedMap = loadJsonMap(PUBLISHED_FILE);

    console.log('📋 Fetching main and archived dialogs for Admin...');
    const mainDialogs = await client.getDialogs({});
    let archivedDialogs = [];
    try {
      archivedDialogs = await client.getDialogs({ folder: 1 });
    } catch {}

    const allDialogs = [...mainDialogs, ...archivedDialogs];
    const groups = [];
    const seenIds = new Set();

    for (const dialog of allDialogs) {
      const entity = dialog.entity;
      if (!entity || entity.className === 'User') continue;

      const id = entity.id.toString();
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const isMarked = !!markedMap[id];
      const publishMeta = publishedMap[id] || {};
      groups.push(formatGroup(dialog, entity, isMarked, publishMeta));
    }

    console.log(`✅ Found ${groups.length} total groups & channels`);
    res.json(groups);
  } catch (err) {
    console.error('❌ Failed to fetch groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups', message: err.message });
  }
});

// ── GET /api/groups/public ──────────────────────────────────
// Public endpoint for non-admin visitors (returns published curated groups)
router.get('/public', async (req, res) => {
  try {
    const publishedMap = loadJsonMap(PUBLISHED_FILE);
    const markedMap = loadJsonMap(MARKED_FILE);

    const authorized = await client.isUserAuthorized();
    if (authorized) {
      const mainDialogs = await client.getDialogs({});
      let archivedDialogs = [];
      try { archivedDialogs = await client.getDialogs({ folder: 1 }); } catch {}

      const allDialogs = [...mainDialogs, ...archivedDialogs];
      const publicGroups = [];
      const seenIds = new Set();

      for (const dialog of allDialogs) {
        const entity = dialog.entity;
        if (!entity || entity.className === 'User') continue;

        const id = entity.id.toString();
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const publishMeta = publishedMap[id];
        // Only include if published explicitly or defaults to true if publishedMap is empty
        const isPub = publishMeta ? publishMeta.isPublished : Object.keys(publishedMap).length === 0;

        if (isPub) {
          publicGroups.push(formatGroup(dialog, entity, !!markedMap[id], publishMeta || {}));
        }
      }

      return res.json(publicGroups);
    }

    // Fallback: return static published items if offline
    const fallbackList = Object.entries(publishedMap)
      .filter(([_, meta]) => meta.isPublished)
      .map(([id, meta]) => ({
        id,
        name: meta.customTitle || meta.name || 'Public Group',
        type: 'public',
        kind: 'group',
        inviteLink: meta.inviteLink || null,
        isPublished: true,
      }));

    res.json(fallbackList);
  } catch (err) {
    console.error('❌ Failed to fetch public groups:', err);
    res.status(500).json({ error: 'Failed to fetch public groups', message: err.message });
  }
});

// ── GET /api/groups/marked ──────────────────────────────────
router.get('/marked', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const markedMap = loadJsonMap(MARKED_FILE);
    const publishedMap = loadJsonMap(PUBLISHED_FILE);

    const mainDialogs = await client.getDialogs({});
    let archivedDialogs = [];
    try { archivedDialogs = await client.getDialogs({ folder: 1 }); } catch {}

    const allDialogs = [...mainDialogs, ...archivedDialogs];
    const groups = [];
    const seenIds = new Set();

    for (const dialog of allDialogs) {
      const entity = dialog.entity;
      if (!entity || entity.className === 'User') continue;

      const id = entity.id.toString();
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      if (markedMap[id]) {
        groups.push(formatGroup(dialog, entity, true, publishedMap[id] || {}));
      }
    }

    res.json(groups);
  } catch (err) {
    console.error('❌ Failed to fetch marked groups:', err);
    res.status(500).json({ error: 'Failed to fetch marked groups', message: err.message });
  }
});

// ── POST /api/groups/publish ────────────────────────────────
// Admin: Toggle public visibility & update invite link / custom title
router.post('/publish', async (req, res) => {
  try {
    const { groupId, isPublished, inviteLink, customTitle, name } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const publishedMap = loadJsonMap(PUBLISHED_FILE);
    const id = groupId.toString();

    publishedMap[id] = {
      ...(publishedMap[id] || {}),
      name: name || publishedMap[id]?.name || 'Group',
      isPublished: isPublished !== undefined ? !!isPublished : true,
      inviteLink: inviteLink || publishedMap[id]?.inviteLink || null,
      customTitle: customTitle || publishedMap[id]?.customTitle || null,
      updatedAt: new Date().toISOString(),
    };

    saveJsonMap(PUBLISHED_FILE, publishedMap);

    console.log(`🛡️ Admin updated public status for Group ${id}: published=${isPublished}`);
    res.json({ success: true, groupId: id, meta: publishedMap[id] });
  } catch (err) {
    console.error('❌ Failed to publish group:', err);
    res.status(500).json({ error: 'Failed to publish group', message: err.message });
  }
});

// ── POST /api/groups/mark ───────────────────────────────────
router.post('/mark', async (req, res) => {
  try {
    const { groupId, marked } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const markedMap = loadJsonMap(MARKED_FILE);
    const id = groupId.toString();

    if (marked) {
      markedMap[id] = true;
    } else {
      delete markedMap[id];
    }

    saveJsonMap(MARKED_FILE, markedMap);

    console.log(`⭐ Group ${id} marked: ${marked}`);
    res.json({ success: true, groupId: id, marked: !!marked });
  } catch (err) {
    console.error('❌ Failed to toggle mark:', err);
    res.status(500).json({ error: 'Failed to toggle mark', message: err.message });
  }
});

// ── GET /api/groups/:groupId/invite ─────────────────────────
// Export or fetch official Telegram invite link for a group/channel
router.get('/:groupId/invite', async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!client.connected) await client.connect();

    let entity;
    try {
      entity = await client.getEntity(BigInt(groupId));
    } catch {
      entity = await client.getEntity(groupId);
    }

    if (entity.username) {
      return res.json({ inviteLink: `https://t.me/${entity.username}` });
    }

    // Try to export chat invite link via GramJS Api
    try {
      const exportResult = await client.invoke(
        new Api.messages.ExportChatInvite({
          peer: entity,
        })
      );
      if (exportResult && exportResult.link) {
        return res.json({ inviteLink: exportResult.link });
      }
    } catch (expErr) {
      console.warn(`Could not export invite link for ${groupId}:`, expErr.message);
    }

    res.json({ inviteLink: null, message: 'Private group link requires invite permissions' });
  } catch (err) {
    console.error('Failed to get invite link:', err.message);
    res.status(500).json({ error: 'Failed to get invite link', message: err.message });
  }
});

module.exports = router;
