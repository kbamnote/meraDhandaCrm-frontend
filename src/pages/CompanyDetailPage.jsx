/**
 * Company detail (platform super-admin) — a full page for one tenant: its plan/
 * status, activity totals, staff roster, and the same manage actions as the
 * console. Reached from the Platform Console "View" button at /company/:id.
 * Gated to platform admins (server-side too via /api/platform).
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { platformApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const fmtDate = (ms) => {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ROLE_BADGE = { admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red', hr: 'badge-amber', manager: 'badge-amber', staff: 'badge-green' };

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isPlatformAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await platformApi.tenantDetail(id)); }
    catch (e) { showToast(e.response?.data?.error || 'Failed to load', 'error'); setData(null); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (body, msg) => {
    try { await platformApi.updateTenant(id, body); showToast(msg, 'success'); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  if (!isPlatformAdmin) {
    return <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}><h3>Platform admins only</h3></div>;
  }

  const back = <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate('/platform')}>← All companies</button>;
  if (loading) return <div data-legacy-id="page-company-detail">{back}<div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>…</div></div>;
  if (!data) return <div data-legacy-id="page-company-detail">{back}<div className="card">Company not found.</div></div>;

  const tn = data.tenant;
  const expired = tn.status === 'expired' || (tn.plan === 'trial' && tn.trialEndsAt && Date.now() > tn.trialEndsAt);
  const statusBadge = expired || tn.status === 'suspended' ? 'badge-red' : tn.status === 'active' ? 'badge-green' : 'badge-amber';

  return (
    <div data-legacy-id="page-company-detail">
      {back}

      <div className="card mb-4">
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{tn.name}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
          <span style={{ textTransform: 'capitalize' }}>{tn.plan}</span> · <span className={`badge ${statusBadge}`}>{expired ? 'expired' : tn.status}</span>
          {' · '}Created {fmtDate(tn.createdAt)}{tn.trialEndsAt ? ` · Trial ends ${fmtDate(tn.trialEndsAt)}` : ''}
        </div>
        <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => act({ extendDays: 30 }, 'Trial extended 30 days')}>+30 days</button>
          {tn.status === 'suspended'
            ? <button className="btn btn-success btn-sm" onClick={() => act({ status: 'active' }, 'Reactivated')}>Activate</button>
            : <button className="btn btn-danger btn-sm" onClick={() => act({ status: 'suspended' }, 'Suspended')}>Suspend</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => act({ plan: 'pro', status: 'active' }, 'Marked paid (pro)')}>Mark paid</button>
        </div>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>📊 Activity</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[['Staff', data.staff?.length], ['Jobs', data.activity?.jobs], ['Invoices', data.activity?.invoices], ['Leads', data.activity?.leads], ['Customers', data.activity?.clients]].map(([l, v]) => (
          <div key={l} className="card">
            <div style={{ fontSize: 24, fontWeight: 800 }}>{v ?? 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '12px 14px', fontWeight: 700, fontSize: 15 }}>👥 Staff ({data.staff?.length || 0})</div>
        {!data.staff?.length ? (
          <div style={{ padding: 20, color: 'var(--text3)' }}>No staff yet.</div>
        ) : (
          <table className="crm-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {data.staff.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-blue'}`}>{u.role}</span></td>
                  <td>{u.active ? '✅ Active' : '🚫 Disabled'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
