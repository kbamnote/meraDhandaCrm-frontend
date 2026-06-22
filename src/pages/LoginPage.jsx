// Phone + OTP login via the backend (JWT). Replaces Firebase phone auth.
//   1. user enters phone        -> POST /auth/request-otp
//   2. user enters the OTP code -> POST /auth/verify-otp -> { token, profile }
// In dev (OTP_DEV_MODE=true) the server returns the code, which we show in a
// toast so you can sign in without an SMS provider.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav('/admin', { replace: true });
  }, [loading, user, nav]);

  const sendOtp = async (e) => {
    e.preventDefault();
    if (!/^\+\d{8,15}$/.test(phone)) {
      return showToast('Phone number must start with country code, e.g. +919999999999', 'error');
    }
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone);
      setOtpSent(true);
      if (res.devCode) showToast(`Dev OTP: ${res.devCode}`, 'success');
      else showToast('OTP sent', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send OTP', 'error');
    } finally { setBusy(false); }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 4) return showToast('Enter the OTP code', 'error');
    setBusy(true);
    try {
      const { token, profile } = await authApi.verifyOtp(phone, otp);
      login(token, profile);
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || 'Invalid OTP. Try again.', 'error');
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

        {!otpSent ? (
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
              onClick={() => { setOtpSent(false); setOtp(''); }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
