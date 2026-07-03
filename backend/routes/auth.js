// ─────────────────────────────────────────────────────────────
//  Auth Routes — Phone login + code verification + 2FA + Session
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { Api } = require('telegram/tl');
const { StringSession } = require('telegram/sessions');
const { client, saveSession, API_ID, API_HASH } = require('../server');

// In-memory store for phone code hashes (keyed by phone number)
const phoneCodeHashes = new Map();

// ── GET /api/auth/status ────────────────────────────────────
// Check whether the user is currently authorized
router.get('/status', async (req, res) => {
  try {
    if (!client.connected) {
      await client.connect();
    }
    const authorized = await client.isUserAuthorized();
    let sessionStr = null;
    if (authorized) {
      try {
        sessionStr = client.session.save();
      } catch {}
    }
    res.json({
      authorized,
      session: sessionStr,
    });
  } catch (err) {
    console.error('Auth status check failed:', err.message);
    res.json({ authorized: false, session: null });
  }
});

// ── POST /api/auth/session ──────────────────────────────────
// Manually set or update session string directly
router.post('/session', async (req, res) => {
  try {
    const { session } = req.body;
    if (!session) {
      return res.status(400).json({ error: 'Session string is required' });
    }

    client.session = new StringSession(session);
    if (!client.connected) {
      await client.connect();
    }

    const authorized = await client.isUserAuthorized();
    if (authorized) {
      saveSession();
      console.log('✅ Custom session set successfully!');
      return res.json({ success: true, authorized: true, session: client.session.save() });
    } else {
      return res.status(400).json({ error: 'Invalid or expired session string' });
    }
  } catch (err) {
    console.error('❌ Failed to set session:', err.message);
    res.status(500).json({ error: 'Failed to set session', message: err.message });
  }
});

// ── POST /api/auth/send-code ────────────────────────────────
// Send SMS or Telegram in-app code to phone number
router.post('/send-code', async (req, res) => {
  try {
    let { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean and format phone number to international format
    phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }

    // Make sure client is connected
    if (!client.connected) {
      await client.connect();
    }

    console.log(`📱 Sending code to ${phoneNumber}...`);

    const result = await client.sendCode(
      { apiId: API_ID, apiHash: API_HASH },
      phoneNumber
    );

    // Store the phoneCodeHash for this phone number
    phoneCodeHashes.set(phoneNumber, result.phoneCodeHash);

    console.log('✅ Code sent successfully');
    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
      phoneNumber,
    });
  } catch (err) {
    console.error('❌ Send code failed:', err);
    const errorMsg = err.errorMessage || err.message || 'Failed to send code';
    const displayMsg = errorMsg === 'PHONE_NUMBER_INVALID'
      ? 'Invalid phone number format. Please include country code e.g. +1234567890'
      : errorMsg;

    res.status(400).json({
      error: displayMsg,
      message: displayMsg,
    });
  }
});

// ── POST /api/auth/verify-code ──────────────────────────────
// Verify the login code the user received
router.post('/verify-code', async (req, res) => {
  try {
    let { phoneNumber, phoneCode, phoneCodeHash } = req.body;

    if (!phoneNumber || !phoneCode) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    phoneNumber = phoneNumber.replace(/[\s\-\(\)]/g, '').trim();
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = '+' + phoneNumber;
    }

    const cleanCode = phoneCode.toString().replace(/\D/g, '').trim();

    // Use provided hash or look it up from memory
    const hash = phoneCodeHash || phoneCodeHashes.get(phoneNumber);
    if (!hash) {
      return res.status(400).json({
        error: 'No phone code hash found. Please click Back and request a new code.',
      });
    }

    if (!client.connected) {
      await client.connect();
    }

    console.log(`🔐 Verifying code ${cleanCode} for ${phoneNumber}...`);

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: hash,
          phoneCode: cleanCode,
        })
      );

      // Success — save session
      saveSession();
      phoneCodeHashes.delete(phoneNumber);

      const sessionStr = client.session.save();
      console.log('✅ Login successful!');
      res.json({ success: true, session: sessionStr });
    } catch (signInErr) {
      // Check if 2FA is required
      if (signInErr.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        console.log('🔑 2FA password required');
        return res.json({
          success: false,
          requires2FA: true,
          message: 'Two-factor authentication password required',
        });
      }

      const errCode = signInErr.errorMessage || signInErr.message || 'Verification failed';
      let userMsg = errCode;
      if (errCode === 'PHONE_CODE_INVALID') userMsg = 'Invalid code entered. Please check your Telegram app.';
      if (errCode === 'PHONE_CODE_EXPIRED') userMsg = 'Code expired. Please request a new code.';

      return res.status(400).json({ error: userMsg, message: userMsg });
    }
  } catch (err) {
    console.error('❌ Code verification error:', err.message);
    res.status(500).json({
      error: 'Failed to verify code',
      message: err.message,
    });
  }
});

// ── POST /api/auth/verify-2fa ───────────────────────────────
// Verify 2FA password
router.post('/verify-2fa', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: '2FA Password is required' });
    }

    if (!client.connected) {
      await client.connect();
    }

    console.log('🔑 Verifying 2FA password...');

    try {
      const passwordInfo = await client.invoke(new Api.account.GetPassword());
      const passwordSrp = await client.computeSrpParams(passwordInfo, password);
      await client.invoke(new Api.auth.CheckPassword({ password: passwordSrp }));
    } catch (checkErr) {
      console.warn('SRP CheckPassword failed, trying signInWithPassword fallback:', checkErr.message);
      try {
        await client.signInWithPassword(
          { apiId: API_ID, apiHash: API_HASH },
          { password: () => Promise.resolve(password) }
        );
      } catch (fallbackErr) {
        const msg = fallbackErr.errorMessage || fallbackErr.message || checkErr.errorMessage || 'Incorrect 2FA password';
        const displayMsg = (msg === 'PASSWORD_HASH_INVALID' || msg === 'PASSWORD_EMPTY')
          ? 'Incorrect 2FA password. Please try again.'
          : msg;
        return res.status(400).json({ error: displayMsg, message: displayMsg });
      }
    }

    // Success — save session
    saveSession();

    const sessionStr = client.session.save();
    console.log('✅ 2FA verification successful!');
    res.json({ success: true, session: sessionStr });
  } catch (err) {
    console.error('❌ 2FA verification failed:', err);
    res.status(400).json({
      error: 'Failed to verify 2FA password',
      message: err.message,
    });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
// Log out and clear the session
router.post('/logout', async (req, res) => {
  try {
    if (client.connected) {
      await client.invoke(new Api.auth.LogOut());
    }
    saveSession(); // Saves empty session
    console.log('👋 Logged out');
    res.json({ success: true });
  } catch (err) {
    console.error('Logout failed:', err.message);
    res.json({ success: true }); // Always return success for logout
  }
});

module.exports = router;
