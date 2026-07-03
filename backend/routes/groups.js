// ─────────────────────────────────────────────────────────────
//  Groups Routes — Fetch all user dialogs, mark/unmark groups
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { client } = require('../server');

const MARKED_FILE = path.join(__dirname, '..', 'marked_groups.json');

// ── Helpers ─────────────────────────────────────────────────

/**
 * Load the set of marked group IDs from disk.
 * Returns a Set of string IDs.
 */
function loadMarkedGroups() {
  try {
    if (fs.existsSync(MARKED_FILE)) {
      const data = JSON.parse(fs.readFileSync(MARKED_FILE, 'utf-8'));
      return new Set(Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.warn('⚠️  Could not load marked_groups.json:', err.message);
  }
  return new Set();
}

/**
 * Save the set of marked group IDs to disk.
 */
function saveMarkedGroups(markedSet) {
  try {
    fs.writeFileSync(MARKED_FILE, JSON.stringify([...markedSet], null, 2), 'utf-8');
  } catch (err) {
    console.error('❌ Failed to save marked_groups.json:', err.message);
  }
}

/**
 * Check if an entity is a group or supergroup.
 */
function isGroup(entity) {
  if (!entity) return false;
  const className = entity.className;
  // Chat = basic group, Channel with megagroup = supergroup
  if (className === 'Chat') return true;
  if (className === 'Channel' && entity.megagroup) return true;
  return false;
}

/**
 * Check if an entity is a channel (broadcast, not megagroup).
 */
function isChannel(entity) {
  if (!entity) return false;
  return entity.className === 'Channel' && !entity.megagroup;
}

/**
 * Convert a dialog + entity into a JSON-safe group object.
 * GramJS uses BigInt for IDs — we convert to string for JSON.
 */
function formatGroup(dialog, entity, isMarked) {
  const id = entity.id.toString();
  const type = entity.username ? 'public' : 'private';
  const kind = isChannel(entity) ? 'channel' : 'group';

  return {
    id,
    name: entity.title || 'Untitled',
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
  };
}

// ── GET /api/groups ─────────────────────────────────────────
// Fetch ALL groups, supergroups, & channels the user belongs to
router.get('/', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const markedSet = loadMarkedGroups();

    console.log('📋 Fetching dialogs...');
    const dialogs = await client.getDialogs({ limit: 500 });

    const groups = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!entity) continue;

      // Include all Groups, Supergroups, and Channels (exclude 1-on-1 user DMs)
      const isGroupOrChannel = 
        dialog.isGroup || 
        dialog.isChannel || 
        entity.className === 'Chat' || 
        entity.className === 'Channel';

      if (isGroupOrChannel) {
        const id = entity.id.toString();
        groups.push(formatGroup(dialog, entity, markedSet.has(id)));
      }
    }

    console.log(`✅ Found ${groups.length} groups/channels`);
    res.json(groups);
  } catch (err) {
    console.error('❌ Failed to fetch groups:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups', message: err.message });
  }
});

// ── GET /api/groups/marked ──────────────────────────────────
// Get only the groups that are marked/starred
router.get('/marked', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const markedSet = loadMarkedGroups();
    if (markedSet.size === 0) {
      return res.json([]);
    }

    const dialogs = await client.getDialogs({ limit: 500 });

    const groups = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!entity) continue;

      const isGroupOrChannel = 
        dialog.isGroup || 
        dialog.isChannel || 
        entity.className === 'Chat' || 
        entity.className === 'Channel';

      if (!isGroupOrChannel) continue;

      const id = entity.id.toString();
      if (markedSet.has(id)) {
        groups.push(formatGroup(dialog, entity, true));
      }
    }

    res.json(groups);
  } catch (err) {
    console.error('❌ Failed to fetch marked groups:', err.message);
    res.status(500).json({ error: 'Failed to fetch marked groups', message: err.message });
  }
});

// ── POST /api/groups/mark ───────────────────────────────────
// Toggle a group's marked/starred status
router.post('/mark', async (req, res) => {
  try {
    const { groupId, marked } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const markedSet = loadMarkedGroups();
    const id = groupId.toString();

    if (marked) {
      markedSet.add(id);
    } else {
      markedSet.delete(id);
    }

    saveMarkedGroups(markedSet);

    console.log(`⭐ Group ${id} marked: ${marked}`);
    res.json({ success: true, groupId: id, marked: !!marked });
  } catch (err) {
    console.error('❌ Failed to toggle mark:', err.message);
    res.status(500).json({ error: 'Failed to toggle mark', message: err.message });
  }
});

module.exports = router;
