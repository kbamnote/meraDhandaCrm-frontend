/**
 * Billing & company — the tenant's own plan / trial status, plus company name
 * editing for owners/admins. Upgrade is a placeholder CTA for now (Razorpay
 * subscription automation is the next iteration).
 */
import { useState } from 'react';
import { tenantApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function BillingPage() {
  const { tenant, hasRole, refreshTenant, setTenant } = useAuth();
  const t = tenant || {};
  const canManage = hasRole('owner', 'admin', 'superadmin');
  const [name, setName] = useState(t.name || '');
  const [busy, setBusy] = useState(false);

  const onTrial = t.plan === 'trial';
  const expired = t.expired;
  const statusBadge = expired ? 'badge-red' : t.status === 'suspended' ? 'badge-red'
    : onTrial ? 'badge-amber' : 'badge-green';
  const statusText = expired ? 'Trial ended' : t.status === 'suspended' ? 'Suspended'
    : onTrial ? `Trial · ${t.trialDaysLeft ?? '—'} days left` : (t.plan || 'active');

  const saveName = async () => {
    if (!name.trim()) return showToast('Company name required', 'error');
    setBusy(true);
    try {
      const res = await tenantApi.update({ name: name.trim() });
      setTenant({ ...t, ...res.tenant });
      showToast('Company name updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div data-legacy-id="page-billing">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>💳 Billing &amp; Plan</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Your subscription and company details</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Plan</div>
          <div style={{ fontSize: 22, fontWeight: 700, textTransform: 'capitalize' }}>{t.plan || '—'}</div>
          <div style={{ marginTop: 8 }}><span className={`badge ${statusBadge}`}>{statusText}</span></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Company</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t.name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Tenant ID: {t.id || '—'}</div>
        </div>
      </div>

      {(onTrial || expired) && (
        <div className="card" style={{ marginTop: 16, background: expired ? 'var(--red-light)' : 'var(--amber-light)', borderColor: expired ? 'var(--red)' : 'var(--amber)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: expired ? 'var(--red)' : 'var(--amber)' }}>
            {expired ? '⛔ Your free trial has ended' : `⏳ ${t.trialDaysLeft ?? 0} days left in your free trial`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
            {expired
              ? 'Upgrade to a paid plan to keep adding and editing data. Your data is safe and still viewable.'
              : 'Upgrade any time to keep full access after your trial.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => showToast('To upgrade, contact MeraDhanda support — online payment is coming soon.', 'success')}>
            Upgrade plan
          </button>
        </div>
      )}

      {canManage && (
        <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Company settings
          </div>
          <div className="form-group">
            <label>Company name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveName} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
