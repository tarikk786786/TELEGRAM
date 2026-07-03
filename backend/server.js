// ─────────────────────────────────────────────────────────────
//  Telegram Hub Backend — GramJS MTProto User Client
//  Connects as a REAL USER (not a bot) for full access
// ─────────────────────────────────────────────────────────────

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

// ── Config ──────────────────────────────────────────────────
const API_ID = parseInt(process.env.API_ID || '34262949', 10);
const API_HASH = process.env.API_HASH || '258dc51f68f72b92d134706d06e89fbb';
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SESSION_FILE = path.join(__dirname, 'session.txt');

// ── Load saved session ──────────────────────────────────────
let savedSession = '';
try {
  if (fs.existsSync(SESSION_FILE)) {
    savedSession = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
    console.log('📂 Loaded saved session from session.txt');
  }
} catch (err) {
  console.warn('⚠️  Could not load session file:', err.message);
}

// ── Create TelegramClient ───────────────────────────────────
const stringSession = new StringSession(savedSession);
const client = new TelegramClient(stringSession, API_ID, API_HASH, {
  connectionRetries: 5,
});

/**
 * Save the current session string to disk.
 * Call this after any successful auth action.
 */
function saveSession() {
  try {
    const sessionStr = client.session.save();
    fs.writeFileSync(SESSION_FILE, sessionStr, 'utf-8');
    console.log('💾 Session saved to session.txt');
  } catch (err) {
    console.error('❌ Failed to save session:', err.message);
  }
}

// Export client + helpers so routes can use them
module.exports = { client, saveSession, API_ID, API_HASH };

// ── Express App ─────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: true, // Allow any origin in production for seamless Render + Vercel deployment
  credentials: true,
}));

app.use(express.json());

// ── Session Middleware ──────────────────────────────────────
// Restores the GramJS user session from x-telegram-session header or query param
app.use(async (req, res, next) => {
  const sessionHeader = req.headers['x-telegram-session'] || req.query.session;
  if (sessionHeader) {
    try {
      const currentSession = client.session.save();
      if (sessionHeader !== currentSession) {
        client.session = new StringSession(sessionHeader);
        if (!client.connected) {
          await client.connect();
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not restore session from header:', err.message);
    }
  }
  next();
});

// ── Mount Routes ────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const messagesRoutes = require('./routes/messages');
const mediaRoutes = require('./routes/media');

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/groups', messagesRoutes);
app.use('/api/media', mediaRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    res.json({
      status: 'ok',
      connected: client.connected,
      authorized,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.json({ status: 'ok', connected: false, authorized: false });
  }
});

// ── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong',
  });
});

// ── Start Server ────────────────────────────────────────────
async function start() {
  try {
    console.log('🔌 Connecting to Telegram...');
    await client.connect();
    console.log('✅ Connected to Telegram MTProto');

    const isAuthorized = await client.isUserAuthorized();
    if (isAuthorized) {
      console.log('🔓 User is already authorized — session is valid');
    } else {
      console.log('🔒 User is NOT authorized — waiting for login via /api/auth');
    }
  } catch (err) {
    console.error('⚠️  Could not connect to Telegram:', err.message);
    console.log('   The server will still start — auth endpoints are available.');
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 Telegram Hub backend running on http://localhost:${PORT}`);
    console.log(`   Frontend URL: ${FRONTEND_URL}`);
    console.log('   Routes:');
    console.log('     GET  /api/health');
    console.log('     GET  /api/auth/status');
    console.log('     POST /api/auth/send-code');
    console.log('     POST /api/auth/verify-code');
    console.log('     POST /api/auth/verify-2fa');
    console.log('     GET  /api/groups');
    console.log('     GET  /api/groups/marked');
    console.log('     POST /api/groups/mark');
    console.log('     GET  /api/groups/:groupId/messages');
    console.log('     GET  /api/media/:chatId/:messageId');
    console.log('');
  });
}

start();
