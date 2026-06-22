/**
 * Company Settings — admin/superadmin/owner editable company profile.
 *
 * Loads the singleton companySettings/main document (catches 404/403 and
 * starts from an empty form), lets privileged roles edit + save via
 * dbApi.set('companySettings', 'main', {...}). Read-only roles see a notice.
 */
import { useEffect, useState } from 'react';
import { dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const EMPTY = { name: '', tagline: '', phone: '', email: '', address: '', gstNo: '', website: '' };

export default function CompanySettingsPage() {
  const { hasRole } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canEdit = hasRole('admin', 'superadmin', 'owner');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const doc = await dbApi.get('companySettings', 'main');
        if (active && doc) setForm({ ...EMPTY, ...doc });
      } catch (err) {
        // 404 (not created yet) or 403 (no access) → start from empty.
        if (err.response?.status && err.response.status !== 404 && err.response.status !== 403) {
          showToast(err.response?.data?.error || 'Failed to load settings', 'error');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    try {
      await dbApi.set('companySettings', 'main', { ...form });
      showToast('Company settings saved', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="center-screen" data-legacy-id="page-company-settings">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-company-settings">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏢 Company Settings</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Your business profile used across invoices, quotes and documents.
        </div>
      </div>

      {!canEdit && (
        <div
          className="card mb-4"
          style={{ background: 'var(--amber-light)', borderColor: 'var(--amber)' }}
        >
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            🔒 You have read-only access. Only admins can change company settings.
          </div>
        </div>
      )}

      <form className="card" onSubmit={save} style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label>Company name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="form-group">
          <label>Tagline</label>
          <input
            className="input"
            value={form.tagline}
            onChange={(e) => setField('tagline', e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Phone</label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Address</label>
          <textarea
            className="input"
            rows={3}
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>GST No.</label>
            <input
              className="input"
              value={form.gstNo}
              onChange={(e) => setField('gstNo', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Website</label>
            <input
              className="input"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        {canEdit && (
          <div className="flex gap-2 mt-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
