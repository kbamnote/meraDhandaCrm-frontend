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
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const DEFAULT_WRITE_ROLES = ['admin', 'superadmin', 'owner'];

const S = {
  newPrefix: { en: '+ New', hi: '+ नया', hinglish: '+ Naya', gu: '+ નવું', mr: '+ नवीन', mwr: '+ नयो' },
  searchPrefix: { en: '🔍 Search', hi: '🔍 खोजें', hinglish: '🔍 Search karein', gu: '🔍 શોધો', mr: '🔍 शोधा', mwr: '🔍 ढूंढो' },
  noPrefix: { en: 'No', hi: 'कोई', hinglish: 'Koi', gu: 'કોઈ', mr: 'कोणतेही', mwr: 'कोई' },
  noSuffix: { en: 'yet.', hi: 'अभी तक नहीं।', hinglish: 'abhi tak nahi.', gu: 'હજુ સુધી નથી.', mr: 'अद्याप नाही.', mwr: 'अजे तांई कोनी।' },
  actions: { en: 'Actions', hi: 'कार्रवाई', hinglish: 'Actions', gu: 'ક્રિયાઓ', mr: 'क्रिया', mwr: 'काम' },
  edit: { en: 'Edit', hi: 'एडिट करें', hinglish: 'Edit karein', gu: 'એડિટ કરો', mr: 'एडिट करा', mwr: 'एडिट करो' },
  delete: { en: 'Delete', hi: 'डिलीट करें', hinglish: 'Delete karein', gu: 'ડિલીટ કરો', mr: 'डिलीट करा', mwr: 'डिलीट करो' },
  confirmDeletePrefix: { en: 'Delete this', hi: 'क्या यह', hinglish: 'Kya yeh', gu: 'આ', mr: 'हे', mwr: 'इण' },
  confirmDeleteSuffix: { en: '?', hi: 'डिलीट करें?', hinglish: 'delete karein?', gu: 'ડિલીટ કરવું?', mr: 'डिलीट करायचे?', mwr: 'डिलीट करां?' },
  deletedSuffix: { en: 'deleted', hi: 'डिलीट हो गया', hinglish: 'delete ho gaya', gu: 'ડિલીટ થયું', mr: 'डिलीट झाले', mwr: 'डिलीट हो ग्यो' },
  deleteFailed: { en: 'Delete failed', hi: 'डिलीट नहीं हुआ', hinglish: 'Delete nahi hua', gu: 'ડિલીટ નિષ્ફળ', mr: 'डिलीट अयशस्वी', mwr: 'डिलीट कोनी हुयो' },
  createdSuffix: { en: 'created', hi: 'बन गया', hinglish: 'ban gaya', gu: 'બન્યું', mr: 'तयार झाले', mwr: 'बण ग्यो' },
  updatedSuffix: { en: 'updated', hi: 'अपडेट हो गया', hinglish: 'update ho gaya', gu: 'અપડેટ થયું', mr: 'अपडेट झाले', mwr: 'अपडेट हो ग्यो' },
  requiredSuffix: { en: 'is required', hi: 'ज़रूरी है', hinglish: 'zaroori hai', gu: 'જરૂરી છે', mr: 'आवश्यक आहे', mwr: 'जरूरी है' },
  saveFailed: { en: 'Save failed', hi: 'सेव नहीं हुआ', hinglish: 'Save nahi hua', gu: 'સેવ નિષ્ફળ', mr: 'सेव अयशस्वी', mwr: 'सेव कोनी हुयो' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  saveChanges: { en: 'Save changes', hi: 'बदलाव सेव करें', hinglish: 'Changes save karein', gu: 'ફેરફાર સેવ કરો', mr: 'बदल सेव करा', mwr: 'बदलाव सेव करो' },
  createPrefix: { en: 'Create', hi: 'बनाएं', hinglish: 'Banayein', gu: 'બનાવો', mr: 'तयार करा', mwr: 'बणावो' },
  editPrefix: { en: 'Edit', hi: 'एडिट करें', hinglish: 'Edit karein', gu: 'એડિટ કરો', mr: 'एडिट करा', mwr: 'एडिट करो' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  recordSingular: { en: 'record', hi: 'रिकॉर्ड', hinglish: 'record', gu: 'રેકોર્ડ', mr: 'रेकॉर्ड', mwr: 'रिकॉर्ड' },
  recordPlural: { en: 'records', hi: 'रिकॉर्ड', hinglish: 'records', gu: 'રેકોર્ડ', mr: 'रेकॉर्ड', mwr: 'रिकॉर्ड' },
};

function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
  return String(value);
}

export default function ResourcePage({ config }) {
  const { collection, title, legacyId, singular, fields } = config;
  const { profile, hasRole } = useAuth();
  const t = useT(S);
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
    if (!confirm(`${t('confirmDeletePrefix')} ${singular || t('recordSingular')} ${t('confirmDeleteSuffix')}`)) return;
    try {
      await dbApi.remove(collection, rec.id);
      showToast(`${singular || 'Record'} ${t('deletedSuffix')}`, 'success');
    } catch (e) {
      showToast(e.response?.data?.error || t('deleteFailed'), 'error');
    }
  };

  return (
    <div data-legacy-id={legacyId}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? (singular || t('recordSingular')) : (config.plural || `${singular || t('recordSingular')}s`)}
          </div>
        </div>
        {canWrite && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            {t('newPrefix')} {singular || 'Record'}
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder={`${t('searchPrefix')} ${(config.plural || (singular || t('recordPlural'))).toLowerCase()}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noPrefix')} {(config.plural || t('recordPlural')).toLowerCase()} {t('noSuffix')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                {canWrite && <th style={{ width: 120 }}>{t('actions')}</th>}
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
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditing(rec)}>{t('edit')}</button>
                        <button className="btn btn-danger btn-xs" onClick={() => remove(rec)}>{t('delete')}</button>
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
  const t = useT(S);
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
        return showToast(`${f.label} ${t('requiredSuffix')}`, 'error');
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
        showToast(`${singular || 'Record'} ${t('updatedSuffix')}`, 'success');
      } else {
        await dbApi.create(collection, payload);
        showToast(`${singular || 'Record'} ${t('createdSuffix')}`, 'success');
      }
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>{isEdit ? `${t('editPrefix')} ${singular || 'Record'}` : `${t('newPrefix')} ${singular || 'Record'}`}</h3>

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
            {busy ? t('saving') : (isEdit ? t('saveChanges') : `${t('createPrefix')} ${singular || t('recordSingular')}`)}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
