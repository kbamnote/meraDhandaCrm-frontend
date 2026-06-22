/**
 * ResourcePage — a data-driven CRUD page used to port the legacy collection
 * pages (vendors, products, clients, leads, machines, ...) to real React.
 *
 * It follows the exact pattern from TasksPage.jsx:
 *   - real-time list via onValue(ref(db, 'mpw/<collection>'))
 *   - writes via dbApi.create / update / remove  (server enforces role checks)
 *   - role-gated create/edit/delete via useAuth
 *
 * Configure one per collection in src/config/resources.js — no bespoke file per
 * page. Pages that need custom UI (Tasks, dashboards) stay hand-written.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { dbApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from './toast';

const DEFAULT_WRITE_ROLES = ['admin', 'superadmin', 'owner'];

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
  return String(value);
}

export default function ResourcePage({ config }) {
  const { collection, title, legacyId, singular, fields } = config;
  const { profile, hasRole } = useAuth();
  const [records, setRecords] = useState({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | record (edit)

  const writeRoles = config.writeRoles || DEFAULT_WRITE_ROLES;
  const canWrite =
    !config.readOnly &&
    (hasRole(...writeRoles) || !!profile?.permissions?.[`${collection}.write`]);

  // Columns shown in the table (fields flagged `table`, else first 3).
  const columns = useMemo(() => {
    const flagged = fields.filter((f) => f.table);
    return flagged.length ? flagged : fields.slice(0, 3);
  }, [fields]);

  useEffect(() => {
    const r = ref(db, `mpw/${collection}`);
    const unsub = onValue(r, (snap) => setRecords(snap.val() || {}));
    return () => unsub();
  }, [collection]);

  const rows = useMemo(
    () => Object.entries(records).map(([id, rec]) => ({ ...rec, id })),
    [records]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((rec) =>
      fields.some((f) => cellText(rec[f.key]).toLowerCase().includes(q))
    );
  }, [rows, search, fields]);

  const remove = async (rec) => {
    if (!confirm(`Delete this ${singular || 'record'}?`)) return;
    try {
      await dbApi.remove(collection, rec.id);
      showToast(`${singular || 'Record'} deleted`, 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Delete failed', 'error');
    }
  };

  return (
    <div data-legacy-id={legacyId}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? (singular || 'record') : (config.plural || `${singular || 'record'}s`)}
          </div>
        </div>
        {canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            + New {singular || 'Record'}
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder={`🔍 Search ${(config.plural || (singular || 'records')).toLowerCase()}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No {(config.plural || 'records').toLowerCase()} yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                {canWrite && <th style={{ width: 120 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => (
                <tr key={rec.id}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.type === 'select' && rec[c.key]
                        ? <span className="badge badge-blue">{cellText(rec[c.key])}</span>
                        : cellText(rec[c.key])}
                    </td>
                  ))}
                  {canWrite && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditing(rec)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => remove(rec)}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <RecordModal
          config={config}
          record={editing.id ? editing : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RecordModal({ config, record, onClose }) {
  const { collection, fields, singular } = config;
  const isEdit = !!record;
  const [form, setForm] = useState(() => {
    const init = {};
    fields.forEach((f) => { init[f.key] = record?.[f.key] ?? (f.default ?? ''); });
    return init;
  });
  const [busy, setBusy] = useState(false);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) {
        return showToast(`${f.label} is required`, 'error');
      }
    }
    // Coerce number fields.
    const payload = {};
    fields.forEach((f) => {
      let v = form[f.key];
      if (f.type === 'number' && v !== '' && v != null) v = Number(v);
      if (v !== '' && v != null) payload[f.key] = v;
    });

    setBusy(true);
    try {
      if (isEdit) {
        await dbApi.update(collection, record.id, payload);
        showToast(`${singular || 'Record'} updated`, 'success');
      } else {
        await dbApi.create(collection, payload);
        showToast(`${singular || 'Record'} created`, 'success');
      }
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>{isEdit ? `Edit ${singular || 'Record'}` : `+ New ${singular || 'Record'}`}</h3>

        {fields.map((f) => (
          <div className="form-group" key={f.key}>
            <label>{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'textarea' ? (
              <textarea className="input" rows={2} value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)} />
            ) : f.type === 'select' ? (
              <select className="input" value={form[f.key] ?? ''} onChange={(e) => setField(f.key, e.target.value)}>
                <option value="">-- choose --</option>
                {(f.options || []).map((o) => {
                  const value = typeof o === 'string' ? o : o.value;
                  const label = typeof o === 'string' ? o : o.label;
                  return <option key={value} value={value}>{label}</option>;
                })}
              </select>
            ) : (
              <input
                className="input"
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'}
                value={form[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            )}
          </div>
        ))}

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Saving…' : (isEdit ? 'Save changes' : `Create ${singular || 'record'}`)}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
