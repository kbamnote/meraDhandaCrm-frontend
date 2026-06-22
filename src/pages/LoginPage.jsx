// Phone OTP login — mirrors the legacy flow:
//   1. user enters phone -> reCAPTCHA verifier -> signInWithPhoneNumber
//   2. backend confirmation result -> user enters OTP -> confirm()
// On success, AuthContext picks up the auth state change and routes them in.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const verifierRef = useRef(null);

  useEffect(() => {
    if (!loading && user) nav('/admin', { replace: true });
  }, [loading, user, nav]);

  useEffect(() => {
    // Set up an invisible reCAPTCHA once per mount.
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
    return () => {
      try { verifierRef.current?.clear(); } catch { /* ignore */ }
      verifierRef.current = null;
    };
  }, []);

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!/^\+\d{8,15}$/.test(phone)) {
      return showToast('Phone number must start with country code, e.g. +919999999999', 'error');
    }
    setBusy(true);
    try {
      const result = await signInWithPhoneNumber(auth, phone, verifierRef.current);
      setConfirmation(result);
      showToast('OTP sent', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to send OTP', 'error');
    } finally { setBusy(false); }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return showToast('Enter the OTP code', 'error');
    setBusy(true);
    try {
      await confirmation.confirm(otp);
      // AuthContext effect handles the redirect.
    } catch (err) {
      showToast('Invalid OTP. Try again.', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 380, width: '92%' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 36 }}>🖨</div>
          <h2 style={{ marginTop: 6 }}>MrPrint World CRM</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>Sign in with your phone</p>
        </div>

        {!confirmation ? (
          <form onSubmit={sendOtp}>
            <div className="form-group">
              <label>Phone number</label>
              <input
                className="input"
                type="tel"
                placeholder="+919999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <div className="form-group">
              <label>Enter OTP sent to {phone}</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.trim())}
                autoFocus
                required
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full mt-2"
              onClick={() => { setConfirmation(null); setOtp(''); }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
