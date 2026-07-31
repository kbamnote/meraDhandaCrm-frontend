/**
 * ManageProductionTypesPage — admin management of the production-type tiles.
 *
 * Production types are the tiles in the "Select Production Type" grid (the
 * Assign-Production flow). Each type can be assigned to a staff member who
 * handles that production; the backend notifies/routes jobs to them.
 *
 * - Lists every type (emoji + name, assignee, enabled toggle, Edit / Delete).
 * - "+ Add Production Type" / Edit opens a form (Name, Emoji, Color, Assignee
 *   dropdown of tenant staff, Enabled). Save → POST/PATCH; Delete → confirm → DELETE.
 * - Live-refreshes on the socket 'productionTypes' change. Writes are admin-gated.
 */
import { useEffect, useMemo, useState } from 'react';
import { socket, ref, onValue, db } from '../services/realtime';
import { productionTypesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title: { en: '🏭 Manage Production Types', hi: '🏭 प्रोडक्शन टाइप प्रबंधन', hinglish: '🏭 Manage Production Types', gu: '🏭 પ્રોડક્શન ટાઈપ સંચાલન', mr: '🏭 प्रोडक्शन प्रकार व्यवस्थापन', mwr: '🏭 प्रोडक्शन टाइप प्रबंधन' },
  type: { en: 'type', hi: 'टाइप', hinglish: 'type', gu: 'ટાઈપ', mr: 'प्रकार', mwr: 'टाइप' },
  types: { en: 'types', hi: 'टाइप', hinglish: 'types', gu: 'ટાઈપ', mr: 'प्रकार', mwr: 'टाइप' },
  readOnly: { en: 'read-only', hi: 'सिर्फ़ देखने के लिए', hinglish: 'read-only', gu: 'ફક્ત વાંચવા માટે', mr: 'फक्त वाचनीय', mwr: 'सिरफ देखण खातर' },
  addType: { en: '+ Add Production Type', hi: '+ प्रोडक्शन टाइप जोड़ें', hinglish: '+ Production Type add karein', gu: '+ પ્રોડક્શન ટાઈપ ઉમેરો', mr: '+ प्रोडक्शन प्रकार जोडा', mwr: '+ प्रोडक्शन टाइप जोड़ो' },
  searchPlaceholder: { en: '🔍 Search by name…', hi: '🔍 नाम से खोजें…', hinglish: '🔍 Naam se search karein…', gu: '🔍 નામથી શોધો…', mr: '🔍 नावाने शोधा…', mwr: '🔍 नाम सूं ढूंढो…' },
  noTypes: { en: 'No production types yet. Click "+ Add Production Type" to create the first one.', hi: 'अभी तक कोई प्रोडक्शन टाइप नहीं। पहला बनाने के लिए "+ प्रोडक्शन टाइप जोड़ें" पर क्लिक करें।', hinglish: 'Abhi tak koi production type nahi. Pehla banane ke liye "+ Add Production Type" par click karein.', gu: 'હજુ સુધી કોઈ પ્રોડક્શન ટાઈપ નથી. પહેલો બનાવવા "+ પ્રોડક્શન ટાઈપ ઉમેરો" પર ક્લિક કરો.', mr: 'अद्याप कोणताही प्रोडक्शन प्रकार नाही. पहिला तयार करण्यासाठी "+ प्रोडक्शन प्रकार जोडा" वर क्लिक करा.', mwr: 'अजे तांई कोई प्रोडक्शन टाइप कोनी। पैलो बणावण खातर "+ प्रोडक्शन टाइप जोड़ो" पर क्लिक करो।' },
  thType: { en: 'Type', hi: 'टाइप', hinglish: 'Type', gu: 'ટાઈપ', mr: 'प्रकार', mwr: 'टाइप' },
  thAssignee: { en: 'Assigned to', hi: 'सौंपा गया', hinglish: 'Assigned to', gu: 'સોંપાયેલ', mr: 'नेमलेले', mwr: 'सौंप्यो' },
  thEnabled: { en: 'Enabled', hi: 'चालू', hinglish: 'Enabled', gu: 'ચાલુ', mr: 'चालू', mwr: 'चालू' },
  thActions: { en: 'Actions', hi: 'क्रियाएं', hinglish: 'Actions', gu: 'ક્રિયાઓ', mr: 'क्रिया', mwr: 'क्रियावां' },
  unassigned: { en: 'Unassigned', hi: 'अनसौंपा', hinglish: 'Unassigned', gu: 'અસોંપાયેલ', mr: 'नेमलेले नाही', mwr: 'अनसौंप्यो' },
  edit: { en: 'Edit', hi: 'एडिट', hinglish: 'Edit', gu: 'એડિટ', mr: 'एडिट', mwr: 'एडिट' },
  del: { en: 'Delete', hi: 'हटाएं', hinglish: 'Delete', gu: 'કાઢો', mr: 'हटवा', mwr: 'हटावो' },
  confirmDelete: { en: 'Delete this production type?', hi: 'यह प्रोडक्शन टाइप हटाएं?', hinglish: 'Yeh production type delete karein?', gu: 'આ પ્રોડક્શન ટાઈપ કાઢો?', mr: 'हा प्रोडक्शन प्रकार हटवायचा?', mwr: 'यो प्रोडक्शन टाइप हटावां?' },

  addTitle: { en: 'Add Production Type', hi: 'प्रोडक्शन टाइप जोड़ें', hinglish: 'Add Production Type', gu: 'પ્રોડક્શન ટાઈપ ઉમેરો', mr: 'प्रोडक्शन प्रकार जोडा', mwr: 'प्रोडक्शन टाइप जोड़ो' },
  editTitle: { en: 'Edit Production Type', hi: 'प्रोडक्शन टाइप एडिट करें', hinglish: 'Edit Production Type', gu: 'પ્રોડક્શન ટાઈપ એડિટ કરો', mr: 'प्रोडक्शन प्रकार एडिट करा', mwr: 'प्रोडक्शन टाइप एडिट करो' },
  nameLabel: { en: 'Name *', hi: 'नाम *', hinglish: 'Name *', gu: 'નામ *', mr: 'नाव *', mwr: 'नाम *' },
  emojiLabel: { en: 'Emoji', hi: 'इमोजी', hinglish: 'Emoji', gu: 'ઈમોજી', mr: 'इमोजी', mwr: 'इमोजी' },
  colorLabel: { en: 'Color (optional)', hi: 'रंग (वैकल्पिक)', hinglish: 'Color (optional)', gu: 'રંગ (વૈકલ્પિક)', mr: 'रंग (पर्यायी)', mwr: 'रंग (वैकल्पिक)' },
  assigneeLabel: { en: 'Assignee', hi: 'सौंपें', hinglish: 'Assignee', gu: 'સોંપો', mr: 'नेमा', mwr: 'सौंपो' },
  enabledLabel: { en: 'Enabled', hi: 'चालू', hinglish: 'Enabled', gu: 'ચાલુ', mr: 'चालू', mwr: 'चालू' },
  outsourceLabel: { en: 'Outsource', hi: 'आउटसोर्स', hinglish: 'Outsource', gu: 'આઉટસોર્સ', mr: 'आउटसोर्स', mwr: 'आउटसोर्स' },
  save: { en: 'Save', hi: 'सेव करें', hinglish: 'Save karein', gu: 'સેવ કરો', mr: 'सेव करा', mwr: 'सेव करो' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  nameRequired: { en: 'Name is required', hi: 'नाम ज़रूरी है', hinglish: 'Name zaroori hai', gu: 'નામ જરૂરી છે', mr: 'नाव आवश्यक आहे', mwr: 'नाम जरूरी है' },
  created: { en: 'Production type created', hi: 'प्रोडक्शन टाइप बन गया', hinglish: 'Production type ban gaya', gu: 'પ્રોડક્શન ટાઈપ બન્યો', mr: 'प्रोडक्शन प्रकार तयार झाला', mwr: 'प्रोडक्शन टाइप बण ग्यो' },
  updated: { en: 'Updated', hi: 'अपडेट हो गया', hinglish: 'Update ho gaya', gu: 'અપડેટ થયો', mr: 'अपडेट झाला', mwr: 'अपडेट हो ग्यो' },
  deleted: { en: 'Deleted', hi: 'हटा दिया', hinglish: 'Delete ho gaya', gu: 'કાઢ્યું', mr: 'हटवले', mwr: 'हटा दियो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  noStaff: { en: '— Unassigned —', hi: '— अनसौंपा —', hinglish: '— Unassigned —', gu: '— અસોંપાયેલ —', mr: '— नेमलेले नाही —', mwr: '— अनसौंप्यो —' },
};

export default function ManageProductionTypesPage() {
  const { hasRole } = useAuth();
  const t = useT(S);
  const [list, setList] = useState([]);
  const [users, setUsers] = useState({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null = closed; {} = new; object = edit

  const canEdit = hasRole('admin', 'superadmin', 'owner');

  // Fetch on mount + re-fetch on socket 'productionTypes' change (mirrors the
  // DesignerPanelPage socket pattern). Also reload on reconnect.
  useEffect(() => {
    const load = () => productionTypesApi.list()
      .then((rows) => setList(Array.isArray(rows) ? rows : []))
      .catch((e) => showToast(e.response?.data?.error || t('failed'), 'error'));
    load();
    const onChange = (msg) => {
      const base = String((msg && msg.path) || '').replace(/^mpw\//, '').split('/')[0];
      if (base === 'productionTypes') load();
    };
    socket.on('data:change', onChange);
    socket.on('connect', load);
    return () => { socket.off('data:change', onChange); socket.off('connect', load); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tenant staff (live) for the Assignee dropdown — same pattern as PermissionsPage.
  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  const staff = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ id, name: u.name || u.email || id })),
    [users]
  );

  const sorted = useMemo(
    () => [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [list]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) => (p.name || '').toLowerCase().includes(q));
  }, [sorted, search]);

  const toggleEnabled = async (p) => {
    try {
      await productionTypesApi.update(p.id, { enabled: !p.enabled });
      showToast(t('updated'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    }
  };

  const remove = async (p) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await productionTypesApi.remove(p.id);
      showToast(t('deleted'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    }
  };

  return (
    <div data-legacy-id="page-production-types">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? t('type') : t('types')}
            {!canEdit && ` · ${t('readOnly')}`}
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
            {t('addType')}
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder={t('searchPlaceholder')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noTypes')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('thType')}</th>
                <th>{t('thAssignee')}</th>
                <th>{t('thEnabled')}</th>
                {canEdit && <th style={{ minWidth: 150 }}>{t('thActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{p.emoji || '🏭'}</span>
                      <b style={{ color: 'var(--text)' }}>{p.name || '—'}</b>
                      {p.color && (
                        <span style={{ width: 12, height: 12, borderRadius: 3, background: p.color, border: '1px solid var(--border)', display: 'inline-block' }} />
                      )}
                      {p.outsource && <span className="badge badge-blue">{t('outsourceLabel')}</span>}
                    </span>
                  </td>
                  <td>
                    {p.assignedToName
                      ? p.assignedToName
                      : <span style={{ color: 'var(--text3)' }}>{t('unassigned')}</span>}
                  </td>
                  <td>
                    {canEdit ? (
                      <button
                        className="btn btn-xs"
                        onClick={() => toggleEnabled(p)}
                        style={{ background: p.enabled ? 'var(--green, #16A34A)' : 'var(--surface2)', color: p.enabled ? '#fff' : 'var(--text2)', border: 'none' }}
                      >
                        {p.enabled ? '✓ ON' : 'OFF'}
                      </button>
                    ) : (
                      <span className={`badge ${p.enabled ? 'badge-green' : 'badge-amber'}`}>
                        {p.enabled ? 'ON' : 'OFF'}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditing(p)}>{t('edit')}</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => remove(p)} style={{ color: 'var(--red, #DC2626)' }}>{t('del')}</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && canEdit && (
        <ProductionTypeModal
          existing={editing.id ? editing : null}
          staff={staff}
          t={t}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ProductionTypeModal({ existing, staff, t, onClose }) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    emoji: existing?.emoji || '🏭',
    color: existing?.color || '',
    assignedTo: existing?.assignedTo || '',
    enabled: existing ? existing.enabled !== false : true,
    outsource: existing?.outsource || false,
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return showToast(t('nameRequired'), 'error');
    setBusy(true);
    const assignee = staff.find((s) => s.id === form.assignedTo);
    const body = {
      name: form.name.trim(),
      emoji: form.emoji.trim() || '🏭',
      color: form.color.trim() || null,
      assignedTo: form.assignedTo || null,
      assignedToName: assignee ? assignee.name : null,
      enabled: !!form.enabled,
      outsource: !!form.outsource,
    };
    try {
      if (existing) {
        await productionTypesApi.update(existing.id, body);
        showToast(t('updated'), 'success');
      } else {
        await productionTypesApi.create(body);
        showToast(t('created'), 'success');
      }
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, width: '100%' }}>
        <h3 style={{ marginBottom: 14 }}>{existing ? t('editTitle') : t('addTitle')}</h3>

        <div className="form-group">
          <label>{t('nameLabel')}</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ width: 90 }}>
            <label>{t('emojiLabel')}</label>
            <input className="input" value={form.emoji} onChange={(e) => set('emoji', e.target.value)} maxLength={4} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('colorLabel')}</label>
            <input className="input" placeholder="#3B82F6" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>{t('assigneeLabel')}</label>
          <select className="input" value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
            <option value="">{t('noStaff')}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2 items-center" style={{ margin: '4px 0 8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} style={{ width: 16, height: 16 }} />
            {t('enabledLabel')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginLeft: 16 }}>
            <input type="checkbox" checked={form.outsource} onChange={(e) => set('outsource', e.target.checked)} style={{ width: 16, height: 16 }} />
            {t('outsourceLabel')}
          </label>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
