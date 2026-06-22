/**
 * My Leaves — personal self-service page.
 * Lists the caller's own leave requests via meApi.leaves() and lets them
 * file a new request via meApi.requestLeave().
 */
import { useEffect, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';

const STATUS_BADGE = {
  pending: 'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export default function MyLeavesPage() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    try {
      const data = await meApi.leaves();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load leaves', 'error');
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div data-legacy-id="page-my-leaves" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-leaves">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🌴 My Leaves</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {leaves.length} {leaves.length === 1 ? 'request' : 'requests'}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
          + Request Leave
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!leaves.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No leave requests yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l, i) => (
                <tr key={l.id || `${l.fromDate || ''}-${i}`}>
                  <td style={{ textTransform: 'capitalize' }}>{l.type || '—'}</td>
                  <td>{l.fromDate || '—'}</td>
                  <td>{l.toDate || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[l.status] || 'badge-amber'}`}>
                      {l.status || 'pending'}
                    </span>
                  </td>
                  <td>{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <RequestLeaveModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

function RequestLeaveModal({ onClose, onSaved }) {
  const [type, setType] = useState('casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!fromDate) return showToast('From date is required', 'error');
    if (!toDate) return showToast('To date is required', 'error');

    setBusy(true);
    try {
      await meApi.requestLeave({
        type,
        fromDate,
        toDate,
        reason: reason.trim(),
      });
      showToast('Leave request submitted', 'success');
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit leave', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>+ Request Leave</h3>

        <div className="form-group">
          <label>Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="casual">Casual</option>
            <option value="sick">Sick</option>
            <option value="earned">Earned</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>From date *</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>To date *</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
          </div>
        </div>

        <div className="form-group">
          <label>Reason</label>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit request'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
