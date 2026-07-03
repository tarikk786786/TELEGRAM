// ─────────────────────────────────────────────────────────────
//  Auth Routes — Phone login + code verification + 2FA
// ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const { Api } = require('telegram/tl');
const { client, saveSession, API_ID, API_HASH } = require('../server');

// In-memory store for phone code hashes (keyed by phone number)
const phoneCodeHashes = new Map();

// ── GET /api/auth/status ────────────────────────────────────
// Check whether the user is currently authorized
router.get('/status', async (req, res) => {
  try {
    const authorized = await client.isUserAuthorized();
    res.json({ authorized });
  } catch (err) {
    console.error('Auth status check failed:', err.message);
    res.json({ authorized: false });
  }
});

// ── POST /api/auth/send-code ────────────────────────────────
// Send a login code to the user's phone number
router.post('/send-code', async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
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
    });
  } catch (err) {
    console.error('❌ Send code failed:', err.message);
    res.status(500).json({
      error: 'Failed to send code',
      message: err.message,
    });
  }
});

// ── POST /api/auth/verify-code ──────────────────────────────
// Verify the login code the user received
router.post('/verify-code', async (req, res) => {
  try {
    const { phoneNumber, phoneCode, phoneCodeHash } = req.body;

    if (!phoneNumber || !phoneCode) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    // Use provided hash or look it up from memory
    const hash = phoneCodeHash || phoneCodeHashes.get(phoneNumber);
    if (!hash) {
      return res.status(400).json({
        error: 'No phone code hash found. Please request a new code.',
      });
    }

    console.log(`🔐 Verifying code for ${phoneNumber}...`);

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash: hash,
          phoneCode: phoneCode.toString(),
        })
      );

      // Success — save session
      saveSession();
      phoneCodeHashes.delete(phoneNumber);

      console.log('✅ Login successful!');
      res.json({ success: true });
    } catch (signInErr) {
      // Check if 2FA is required
      if (signInErr.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        console.log('🔑 2FA password required');
        res.json({
          success: false,
          requires2FA: true,
          message: 'Two-factor authentication password required',
        });
      } else {
        throw signInErr;
      }
    }
  } catch (err) {
    console.error('❌ Code verification failed:', err.message);
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
      return res.status(400).json({ error: 'Password is required' });
    }

    console.log('🔑 Verifying 2FA password...');

    // Get the current password info and compute SRP
    const passwordInfo = await client.invoke(new Api.account.GetPassword());
    const passwordSrp = await client.computeSrpParams(passwordInfo, password);

    await client.invoke(
      new Api.auth.CheckPassword({ password: passwordSrp })
    );

    // Success — save session
    saveSession();

    console.log('✅ 2FA verification successful!');
    res.json({ success: true });
  } catch (err) {
    console.error('❌ 2FA verification failed:', err.message);
    res.status(500).json({
      error: 'Failed to verify 2FA password',
      message: err.message,
    });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────
// Log out and clear the session
router.post('/logout', async (req, res) => {
  try {
    await client.invoke(new Api.auth.LogOut());
    saveSession(); // Saves the now-empty session
    console.log('👋 Logged out');
    res.json({ success: true });
  } catch (err) {
    console.error('Logout failed:', err.message);
    res.status(500).json({ error: 'Logout failed', message: err.message });
  }
});

module.exports = router;
