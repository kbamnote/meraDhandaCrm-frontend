/**
 * Platform super-admin → Send Notification. Compose an announcement and push it
 * to every company (or a selected subset). Lands in each recipient's 🔔 bell
 * (and as an Android push once that's live). Gated to platform admins.
 */
import { useEffect, useState } from 'react';
import { platformApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function PlatformBroadcastPage() {
  const { isPlatformAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tenants, setTenants] = useState([]);
  const [mode, setMode] = useState('all'); // 'all' | 'select'
  const [selected, setSelected] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { platformApi.tenants().then((t) => setTenants(Array.isArray(t) ? t : [])).catch(() => {}); }, []);

  if (!isPlatformAdmin) {
    return <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}><h3>Platform admins only</h3></div>;
  }

  const send = async () => {
    if (!title.trim() && !body.trim()) return showToast('Enter a title or message', 'error');
    const ids = mode === 'select' ? Object.keys(selected).filter((k) => selected[k]) : null;
    if (mode === 'select' && (!ids || !ids.length)) return showToast('Pick at least one company', 'error');
    setBusy(true);
    try {
      const r = await platformApi.broadcast({ title: title.trim(), body: body.trim(), ...(ids ? { tenantIds: ids } : {}) });
      showToast(`Sent to ${r.sent} ${r.sent === 1 ? 'company' : 'companies'}`, 'success');
      setTitle(''); setBody(''); setSelected({}); setMode('all');
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div data-legacy-id="page-platform-broadcast">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>📢 Send Notification</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Broadcast an announcement to companies on MeraDhanda CRM</div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance tonight" autoFocus />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to tell them?" />
        </div>
        <div className="form-group">
          <label>Send to</label>
          <div className="flex gap-2" style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> All companies ({tenants.length})</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="radio" checked={mode === 'select'} onChange={() => setMode('select')} /> Selected</label>
          </div>
          {mode === 'select' && (
            <div className="card" style={{ maxHeight: 220, overflow: 'auto', padding: 8 }}>
              {!tenants.length ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>No companies.</div> : tenants.map((tn) => (
                <label key={tn.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 14 }}>
                  <input type="checkbox" checked={!!selected[tn.id]} onChange={(e) => setSelected((s) => ({ ...s, [tn.id]: e.target.checked }))} />
                  {tn.name} <span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'capitalize' }}>({tn.plan})</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : '📢 Send notification'}</button>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Appears in every recipient&apos;s 🔔 bell (and as an Android push once push is live).
        </div>
      </div>
    </div>
  );
}
