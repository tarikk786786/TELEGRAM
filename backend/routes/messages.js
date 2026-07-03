// ─────────────────────────────────────────────────────────────
//  Messages Routes — Fetch message history from any group
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { Api } = require('telegram/tl');
const { client } = require('../server');

/**
 * Determine media type from a GramJS message object.
 */
function getMediaType(message) {
  if (!message.media) return null;
  const className = message.media.className;

  if (className === 'MessageMediaPhoto') return 'photo';
  if (className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (!doc) return 'document';

    // Check MIME type
    const mime = doc.mimeType || '';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('image/')) return 'photo';

    // Check for video/audio/sticker attributes
    for (const attr of doc.attributes || []) {
      if (attr.className === 'DocumentAttributeVideo') return 'video';
      if (attr.className === 'DocumentAttributeAudio') return 'audio';
      if (attr.className === 'DocumentAttributeSticker') return 'sticker';
      if (attr.className === 'DocumentAttributeAnimated') return 'gif';
    }

    return 'document';
  }

  if (className === 'MessageMediaWebPage') return 'webpage';
  if (className === 'MessageMediaGeo') return 'location';
  if (className === 'MessageMediaContact') return 'contact';
  if (className === 'MessageMediaPoll') return 'poll';

  return 'other';
}

/**
 * Get the sender's display name from a message.
 */
function getSenderName(message) {
  const sender = message._sender || message.sender;
  if (!sender) return 'Unknown';

  if (sender.firstName || sender.lastName) {
    return [sender.firstName, sender.lastName].filter(Boolean).join(' ');
  }
  if (sender.title) return sender.title;
  if (sender.username) return sender.username;
  return 'Unknown';
}

/**
 * Format a single message into a JSON-safe object.
 */
function formatMessage(message, chatId) {
  const mediaType = getMediaType(message);

  return {
    id: message.id,
    text: message.message || '',
    date: message.date ? new Date(message.date * 1000).toISOString() : null,
    senderId: message.senderId ? message.senderId.toString() : null,
    senderName: getSenderName(message),
    hasMedia: !!message.media,
    mediaType,
    hasPhoto: mediaType === 'photo',
    hasVideo: mediaType === 'video',
    // For media download: use chatId + messageId
    chatId: chatId.toString(),
    isReply: !!message.replyTo,
    replyToMsgId: message.replyTo?.replyToMsgId || null,
    isForwarded: !!message.fwdFrom,
    views: message.views || null,
    forwards: message.forwards || null,
  };
}

// ── GET /api/groups/:groupId/messages ───────────────────────
// Fetch paginated message history from a group
router.get('/:groupId/messages', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const { groupId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offsetId = parseInt(req.query.offsetId) || 0;

    console.log(`💬 Fetching messages from group ${groupId} (limit=${limit}, offset=${offsetId})`);

    // Resolve the entity — try as BigInt first, then as-is
    let entity;
    try {
      entity = await client.getEntity(BigInt(groupId));
    } catch {
      entity = await client.getEntity(groupId);
    }

    // Fetch messages
    const messages = await client.getMessages(entity, {
      limit,
      offsetId: offsetId || undefined,
    });

    const formatted = messages.map((msg) => formatMessage(msg, groupId));

    console.log(`✅ Got ${formatted.length} messages`);
    res.json({
      messages: formatted,
      total: formatted.length,
      hasMore: formatted.length === limit,
      groupId: groupId.toString(),
    });
  } catch (err) {
    console.error('❌ Failed to fetch messages:', err.message);
    res.status(500).json({
      error: 'Failed to fetch messages',
      message: err.message,
    });
  }
});

module.exports = router;
