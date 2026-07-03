import { useState } from 'react';
import { sendCode, verifyCode, verify2FA } from '../api';

export default function LoginPage({ onLoginSuccess }) {
  const [step, setStep] = useState(1); // 1 = phone, 2 = code, 3 = 2FA
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalSteps = 3;

  /* ── Step 1: Send Code ───────────────────────────────────── */
  async function handleSendCode(e) {
    e.preventDefault();
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await sendCode(phoneNumber.trim());
      setPhoneCodeHash(data.phoneCodeHash);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 2: Verify Code ─────────────────────────────────── */
  async function handleVerifyCode(e) {
    e.preventDefault();
    if (!phoneCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await verifyCode(phoneNumber.trim(), phoneCode.trim(), phoneCodeHash);
      if (data.requires2FA) {
        setStep(3);
      } else {
        onLoginSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 3: 2FA Password ────────────────────────────────── */
  async function handleVerify2FA(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await verify2FA(password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Telegram icon */}
        <div className="login-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.665 3.717l-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
          </svg>
        </div>

        {/* Step indicator */}
        <div className="login-step">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`login-step-dot ${i + 1 <= step ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* ── Step 1: Phone Number ──────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleSendCode}>
            <h2 className="login-title">Sign in to Telegram</h2>
            <p className="login-subtitle">
              Enter your phone number to receive a verification code.
            </p>
            <input
              className="login-input"
              type="tel"
              placeholder="+1 234 567 8900"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <button className="login-button" type="submit" disabled={loading || !phoneNumber.trim()}>
              {loading ? 'Sending…' : 'Send Code'}
            </button>
          </form>
        )}

        {/* ── Step 2: Verification Code ────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            <h2 className="login-title">Enter Code</h2>
            <p className="login-subtitle">
              We sent a code to <strong>{phoneNumber}</strong>
            </p>
            <input
              className="login-input"
              type="text"
              placeholder="12345"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              autoFocus
              disabled={loading}
              maxLength={6}
              style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.4rem' }}
            />
            <button className="login-button" type="submit" disabled={loading || !phoneCode.trim()}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <div
              className="login-back"
              onClick={() => { setStep(1); setError(''); setPhoneCode(''); }}
            >
              ← Back to phone number
            </div>
          </form>
        )}

        {/* ── Step 3: 2FA Password ─────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleVerify2FA}>
            <h2 className="login-title">Two-Factor Auth</h2>
            <p className="login-subtitle">
              Your account has 2FA enabled. Enter your cloud password.
            </p>
            <input
              className="login-input"
              type="password"
              placeholder="Cloud password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <button className="login-button" type="submit" disabled={loading || !password}>
              {loading ? 'Submitting…' : 'Submit'}
            </button>
            <div
              className="login-back"
              onClick={() => { setStep(2); setError(''); setPassword(''); }}
            >
              ← Back to code
            </div>
          </form>
        )}

        {/* Error */}
        {error && <div className="login-error">{error}</div>}
      </div>
    </div>
  );
}
