// ─────────────────────────────────────────────────────────────
//  Media Routes — Download & stream media from messages
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { client } = require('../server');

/**
 * Determine the Content-Type from a GramJS message's media.
 */
function getContentType(message) {
  if (!message.media) return 'application/octet-stream';

  const className = message.media.className;

  // Photos are always JPEG from Telegram
  if (className === 'MessageMediaPhoto') {
    return 'image/jpeg';
  }

  // Documents — check MIME type
  if (className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (doc && doc.mimeType) {
      return doc.mimeType;
    }
  }

  return 'application/octet-stream';
}

/**
 * Get a filename from the media (if available).
 */
function getFilename(message) {
  if (!message.media) return null;

  if (message.media.className === 'MessageMediaPhoto') {
    return `photo_${message.id}.jpg`;
  }

  if (message.media.className === 'MessageMediaDocument') {
    const doc = message.media.document;
    if (doc && doc.attributes) {
      for (const attr of doc.attributes) {
        if (attr.className === 'DocumentAttributeFilename') {
          return attr.fileName;
        }
      }
    }
    // Fallback filename
    const mime = doc?.mimeType || '';
    const ext = mime.split('/')[1] || 'bin';
    return `file_${message.id}.${ext}`;
  }

  return `media_${message.id}`;
}

// ── GET /api/media/:chatId/:messageId ───────────────────────
// Download media from a specific message and stream it back
router.get('/:chatId/:messageId', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    if (!authorized) {
      return res.status(401).json({ error: 'Not authorized. Please log in first.' });
    }

    const { chatId, messageId } = req.params;

    console.log(`📥 Downloading media: chat=${chatId}, message=${messageId}`);

    // Resolve the entity
    let entity;
    try {
      entity = await client.getEntity(BigInt(chatId));
    } catch {
      entity = await client.getEntity(chatId);
    }

    // Get the specific message
    const messages = await client.getMessages(entity, {
      ids: [parseInt(messageId)],
    });

    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[0];

    if (!message.media) {
      return res.status(404).json({ error: 'No media in this message' });
    }

    // Download the media to a buffer
    const buffer = await client.downloadMedia(message, {});

    if (!buffer || buffer.length === 0) {
      return res.status(404).json({ error: 'Failed to download media' });
    }

    const contentType = getContentType(message);
    const filename = getFilename(message);

    console.log(`✅ Downloaded ${buffer.length} bytes (${contentType})`);

    // ── Range request support (for video seeking) ─────────
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.set({
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      });
      res.end(buffer.slice(start, end + 1));
    } else {
      res.set({
        'Content-Type': contentType,
        'Content-Length': buffer.length,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      });
      res.end(buffer);
    }
  } catch (err) {
    console.error('❌ Media download failed:', err.message);
    res.status(500).json({
      error: 'Failed to download media',
      message: err.message,
    });
  }
});

module.exports = router;
