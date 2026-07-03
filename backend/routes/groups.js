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

// Default initial public showcase groups if none are saved
const DEFAULT_PUBLIC_GROUPS = [
  {
    id: 'pub_1',
    name: 'Telegram Official News',
    title: 'Telegram Official News',
    type: 'public',
    kind: 'channel',
    username: 'telegram',
    inviteLink: 'https://t.me/telegram',
    isPublished: true,
    description: 'Official announcements and updates from Telegram',
  },
  {
    id: 'pub_2',
    name: 'Pavel Durov Channel',
    title: 'Pavel Durov Channel',
    type: 'public',
    kind: 'channel',
    username: 'durov',
    inviteLink: 'https://t.me/durov',
    isPublished: true,
    description: 'Thoughts and updates from Telegram Founder Pavel Durov',
  },
  {
    id: 'pub_3',
    name: 'Digital Products Showcase Hub',
    title: 'Digital Products Showcase Hub',
    type: 'public',
    kind: 'group',
    inviteLink: 'https://t.me/telegram',
    isPublished: true,
    description: 'Curated list of premium digital products and Telegram communities',
  },
];

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
    description: publishMeta.description || null,
  };
}

// ── GET /api/groups ─────────────────────────────────────────
// Fetch ALL groups for Admin (or fallback to published list)
router.get('/', async (req, res) => {
  try {
    const markedMap = loadJsonMap(MARKED_FILE);
    const publishedMap = loadJsonMap(PUBLISHED_FILE);

    let isAuth = false;
    try {
      if (client.connected) {
        isAuth = await client.isUserAuthorized();
      }
    } catch {}

    const groups = [];
    const seenIds = new Set();

    if (isAuth) {
      console.log('📋 Fetching Telegram account dialogs...');
      try {
        const mainDialogs = await client.getDialogs({});
        let archivedDialogs = [];
        try { archivedDialogs = await client.getDialogs({ folder: 1 }); } catch {}

        const allDialogs = [...mainDialogs, ...archivedDialogs];

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
      } catch (dErr) {
        console.warn('Could not fetch live dialogs:', dErr.message);
      }
    }

    // Add custom published groups from published_groups.json
    Object.entries(publishedMap).forEach(([id, meta]) => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        groups.push({
          id,
          name: meta.customTitle || meta.name || 'Custom Group',
          type: meta.type || 'public',
          kind: meta.kind || 'group',
          username: meta.username || null,
          inviteLink: meta.inviteLink || null,
          isPublished: meta.isPublished !== undefined ? meta.isPublished : true,
          description: meta.description || null,
          marked: !!markedMap[id],
        });
      }
    });

    // If still empty, add default public groups
    if (groups.length === 0) {
      DEFAULT_PUBLIC_GROUPS.forEach((g) => groups.push(g));
    }

    console.log(`✅ Returning ${groups.length} total groups for display`);
    res.json(groups);
  } catch (err) {
    console.error('❌ Failed to fetch groups:', err);
    res.json(DEFAULT_PUBLIC_GROUPS);
  }
});

// ── GET /api/groups/public ──────────────────────────────────
// Public endpoint for non-admin visitors (returns published curated groups)
router.get('/public', async (req, res) => {
  try {
    const publishedMap = loadJsonMap(PUBLISHED_FILE);
    const markedMap = loadJsonMap(MARKED_FILE);

    const publicGroups = [];
    const seenIds = new Set();

    let isAuth = false;
    try {
      if (client.connected) {
        isAuth = await client.isUserAuthorized();
      }
    } catch {}

    if (isAuth) {
      try {
        const mainDialogs = await client.getDialogs({});
        let archivedDialogs = [];
        try { archivedDialogs = await client.getDialogs({ folder: 1 }); } catch {}

        const allDialogs = [...mainDialogs, ...archivedDialogs];

        for (const dialog of allDialogs) {
          const entity = dialog.entity;
          if (!entity || entity.className === 'User') continue;

          const id = entity.id.toString();
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const publishMeta = publishedMap[id];
          const isPub = publishMeta ? publishMeta.isPublished : true;

          if (isPub) {
            publicGroups.push(formatGroup(dialog, entity, !!markedMap[id], publishMeta || {}));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch dialogs for public endpoint:', e.message);
      }
    }

    // Add custom published groups
    Object.entries(publishedMap).forEach(([id, meta]) => {
      if (!seenIds.has(id) && meta.isPublished !== false) {
        seenIds.add(id);
        publicGroups.push({
          id,
          name: meta.customTitle || meta.name || 'Public Group',
          type: meta.type || 'public',
          kind: meta.kind || 'group',
          username: meta.username || null,
          inviteLink: meta.inviteLink || null,
          isPublished: true,
          description: meta.description || null,
        });
      }
    });

    if (publicGroups.length === 0) {
      DEFAULT_PUBLIC_GROUPS.forEach((g) => publicGroups.push(g));
    }

    res.json(publicGroups);
  } catch (err) {
    console.error('❌ Failed to fetch public groups:', err);
    res.json(DEFAULT_PUBLIC_GROUPS);
  }
});

// ── POST /api/groups/publish ────────────────────────────────
// Admin: Toggle public visibility & update invite link / custom title
router.post('/publish', async (req, res) => {
  try {
    const { groupId, isPublished, inviteLink, customTitle, name, description } = req.body;

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
      description: description || publishedMap[id]?.description || null,
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

// ── POST /api/groups/add-custom ─────────────────────────────
// Admin: Add ANY Telegram group, channel, or custom link directly
router.post('/add-custom', async (req, res) => {
  try {
    const { name, inviteLink, type, kind, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const publishedMap = loadJsonMap(PUBLISHED_FILE);
    const customId = `custom_${Date.now()}`;

    // Extract username if invite link is t.me/username
    let username = null;
    if (inviteLink && inviteLink.includes('t.me/')) {
      const match = inviteLink.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match && !match[1].startsWith('+') && !match[1].startsWith('joinchat')) {
        username = match[1];
      }
    }

    publishedMap[customId] = {
      id: customId,
      name: name.trim(),
      customTitle: name.trim(),
      inviteLink: inviteLink ? inviteLink.trim() : null,
      type: type || (username ? 'public' : 'private'),
      kind: kind || 'group',
      username,
      description: description ? description.trim() : null,
      isPublished: true,
      createdAt: new Date().toISOString(),
    };

    saveJsonMap(PUBLISHED_FILE, publishedMap);

    console.log(`➕ Admin added custom group: ${name} (${customId})`);
    res.json({ success: true, group: publishedMap[customId] });
  } catch (err) {
    console.error('❌ Failed to add custom group:', err);
    res.status(500).json({ error: 'Failed to add group', message: err.message });
  }
});

// ── POST /api/groups/delete-custom ──────────────────────────
// Admin: Delete a custom added group
router.post('/delete-custom', async (req, res) => {
  try {
    const { groupId } = req.body;
    if (!groupId) return res.status(400).json({ error: 'groupId required' });

    const publishedMap = loadJsonMap(PUBLISHED_FILE);
    const id = groupId.toString();

    if (publishedMap[id]) {
      delete publishedMap[id];
      saveJsonMap(PUBLISHED_FILE, publishedMap);
      console.log(`🗑️ Deleted custom group ${id}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Failed to delete custom group:', err);
    res.status(500).json({ error: 'Failed to delete group', message: err.message });
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
