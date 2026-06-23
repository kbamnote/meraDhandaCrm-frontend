/**
 * Platform super-admin console — manage ALL tenants (MeraDhanda staff only).
 * Lists every company on the platform with plan/trial/status + actions to
 * suspend/activate and extend trials. Gated server-side to platformAdmin and
 * route-gated to isPlatformAdmin.
 */
import { useEffect, useState, useCallback } from 'react';
import { platformApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PlatformConsolePage() {
  const { isPlatformAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([platformApi.stats(), platformApi.tenants()]);
      setStats(s);
      setTenants(t);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load', 'error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, body, msg) => {
    try {
      await platformApi.updateTenant(id, body);
      showToast(msg, 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    }
  };

  if (!isPlatformAdmin) {
    return <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <h3>Platform admins only</h3>
      <p style={{ color: 'var(--text2)', marginTop: 8 }}>This console is for MeraDhanda staff.</p>
    </div>;
  }

  const statusBadge = (s, expired) => expired ? 'badge-red'
    : s === 'suspended' ? 'badge-red' : s === 'active' ? 'badge-green' : 'badge-amber';

  return (
    <div data-legacy-id="page-platform">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>👑 Platform Console</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>All companies on MeraDhanda CRM</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
        {[['Tenants', stats?.tenants], ['Active', stats?.active], ['Total users', stats?.users]].map(([label, val]) => (
          <div key={label} className="card">
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : !tenants.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No tenants yet.</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Company</th><th>Plan</th><th>Status</th><th>Users</th>
                <th>Trial ends</th><th>Created</th><th style={{ minWidth: 280 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const expired = t.status === 'expired' || (t.plan === 'trial' && t.trialEndsAt && Date.now() > t.trialEndsAt);
                return (
                  <tr key={t.id}>
                    <td><b>{t.name}</b>{t.legacy && <span className="badge badge-blue" style={{ marginLeft: 6 }}>own</span>}</td>
                    <td style={{ textTransform: 'capitalize' }}>{t.plan}</td>
                    <td><span className={`badge ${statusBadge(t.status, expired)}`}>{expired ? 'expired' : t.status}{t.plan === 'trial' && !expired && t.trialDaysLeft != null ? ` · ${t.trialDaysLeft}d` : ''}</span></td>
                    <td>{t.userCount}</td>
                    <td>{fmtDate(t.trialEndsAt)}</td>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => act(t.id, { extendDays: 30 }, 'Trial extended 30 days')}>+30 days</button>
                        {t.status === 'suspended'
                          ? <button className="btn btn-success btn-xs" onClick={() => act(t.id, { status: 'active' }, 'Reactivated')}>Activate</button>
                          : <button className="btn btn-danger btn-xs" onClick={() => act(t.id, { status: 'suspended' }, 'Suspended')}>Suspend</button>}
                        <button className="btn btn-ghost btn-xs" onClick={() => act(t.id, { plan: 'pro', status: 'active' }, 'Marked as paid (pro)')}>Mark paid</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
