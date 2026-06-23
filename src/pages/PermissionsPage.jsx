/**
 * PermissionsPage — admin user management.
 *
 * - "+ Add Teammate" creates a new user (email + password + role) via authApi.createUser.
 * - Real-time list of every user (onValue mpw/users) with an inline role editor
 *   (built-in role select + customRole) that calls authApi.setRole.
 * All write controls require admin / superadmin / owner.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  permissionsTeam: { en: '🔐 Permissions & Team', hi: '🔐 परमिशन और टीम', hinglish: '🔐 Permissions & Team', gu: '🔐 પરમિશન અને ટીમ', mr: '🔐 परवानग्या आणि टीम', mwr: '🔐 परमिशन अर टीम' },
  user: { en: 'user', hi: 'यूज़र', hinglish: 'user', gu: 'યૂઝર', mr: 'युझर', mwr: 'यूज़र' },
  users: { en: 'users', hi: 'यूज़र', hinglish: 'users', gu: 'યૂઝર', mr: 'युझर', mwr: 'यूज़र' },
  readOnly: { en: 'read-only', hi: 'सिर्फ़ देखने के लिए', hinglish: 'read-only', gu: 'ફક્ત વાંચવા માટે', mr: 'फक्त वाचनीय', mwr: 'सिरफ देखण खातर' },
  addTeammate: { en: '+ Add Teammate', hi: '+ टीममेट जोड़ें', hinglish: '+ Teammate add karein', gu: '+ ટીમમેટ ઉમેરો', mr: '+ टीममेट जोडा', mwr: '+ टीममेट जोड़ो' },
  searchPlaceholder: { en: '🔍 Search by name, email, role...', hi: '🔍 नाम, ईमेल, रोल से खोजें...', hinglish: '🔍 Naam, email, role se search karein...', gu: '🔍 નામ, ઈમેલ, રોલથી શોધો...', mr: '🔍 नाव, ईमेल, भूमिकेने शोधा...', mwr: '🔍 नाम, ईमेल, रोल सूं ढूंढो...' },
  noUsers: { en: 'No users yet. Click “+ Add Teammate” to create the first one.', hi: 'अभी तक कोई यूज़र नहीं। पहला बनाने के लिए “+ टीममेट जोड़ें” पर क्लिक करें।', hinglish: 'Abhi tak koi user nahi. Pehla banane ke liye “+ Add Teammate” par click karein.', gu: 'હજુ સુધી કોઈ યૂઝર નથી. પહેલો બનાવવા “+ ટીમમેટ ઉમેરો” પર ક્લિક કરો.', mr: 'अद्याप कोणताही युझर नाही. पहिला तयार करण्यासाठी “+ टीममेट जोडा” वर क्लिक करा.', mwr: 'अजे तांई कोई यूज़र कोनी। पैलो बणावण खातर “+ टीममेट जोड़ो” पर क्लिक करो।' },
  thName: { en: 'Name', hi: 'नाम', hinglish: 'Naam', gu: 'નામ', mr: 'नाव', mwr: 'नाम' },
  thEmail: { en: 'Email', hi: 'ईमेल', hinglish: 'Email', gu: 'ઈમેલ', mr: 'ईमेल', mwr: 'ईमेल' },
  thCurrentRole: { en: 'Current role', hi: 'मौजूदा रोल', hinglish: 'Current role', gu: 'વર્તમાન રોલ', mr: 'सध्याची भूमिका', mwr: 'मौजूदा रोल' },
  thCustomRole: { en: 'Custom role', hi: 'कस्टम रोल', hinglish: 'Custom role', gu: 'કસ્ટમ રોલ', mr: 'कस्टम भूमिका', mwr: 'कस्टम रोल' },
  thChangeRole: { en: 'Change role', hi: 'रोल बदलें', hinglish: 'Role change karein', gu: 'રોલ બદલો', mr: 'भूमिका बदला', mwr: 'रोल बदलो' },
  roleUpdated: { en: 'Role updated', hi: 'रोल अपडेट हो गया', hinglish: 'Role update ho gaya', gu: 'રોલ અપડેટ થયો', mr: 'भूमिका अपडेट झाली', mwr: 'रोल अपडेट हो ग्यो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  save: { en: 'Save', hi: 'सेव करें', hinglish: 'Save karein', gu: 'સેવ કરો', mr: 'सेव करा', mwr: 'सेव करो' },

  emailRequired: { en: 'Email is required', hi: 'ईमेल ज़रूरी है', hinglish: 'Email zaroori hai', gu: 'ઈમેલ જરૂરી છે', mr: 'ईमेल आवश्यक आहे', mwr: 'ईमेल जरूरी है' },
  passwordMin: { en: 'Password must be at least 6 characters', hi: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए', hinglish: 'Password kam se kam 6 characters ka hona chahiye', gu: 'પાસવર્ડ ઓછામાં ઓછા 6 અક્ષરનો હોવો જોઈએ', mr: 'पासवर्ड किमान 6 अक्षरांचा असावा', mwr: 'पासवर्ड कम सूं कम 6 अक्षर रो होणो चाइजे' },
  teammateCreatedPrefix: { en: 'Teammate', hi: 'टीममेट', hinglish: 'Teammate', gu: 'ટીમમેટ', mr: 'टीममेट', mwr: 'टीममेट' },
  teammateCreatedSuffix: { en: 'created', hi: 'बन गया', hinglish: 'create ho gaya', gu: 'બન્યો', mr: 'तयार झाला', mwr: 'बण ग्यो' },
  createFailed: { en: 'Failed to create teammate', hi: 'टीममेट नहीं बना', hinglish: 'Teammate nahi bana', gu: 'ટીમમેટ બનાવવામાં નિષ્ફળ', mr: 'टीममेट तयार करता आला नाही', mwr: 'टीममेट कोनी बण्यो' },
  fullName: { en: 'Full name', hi: 'पूरा नाम', hinglish: 'Full name', gu: 'પૂરું નામ', mr: 'पूर्ण नाव', mwr: 'पूरो नाम' },
  emailStar: { en: 'Email *', hi: 'ईमेल *', hinglish: 'Email *', gu: 'ઈમેલ *', mr: 'ईमेल *', mwr: 'ईमेल *' },
  emailPlaceholder: { en: 'teammate@company.com', hi: 'teammate@company.com', hinglish: 'teammate@company.com', gu: 'teammate@company.com', mr: 'teammate@company.com', mwr: 'teammate@company.com' },
  tempPassword: { en: 'Temporary password * (min 6 chars)', hi: 'अस्थायी पासवर्ड * (कम से कम 6 अक्षर)', hinglish: 'Temporary password * (min 6 chars)', gu: 'કામચલાઉ પાસવર્ડ * (ઓછામાં ઓછા 6 અક્ષર)', mr: 'तात्पुरता पासवर्ड * (किमान 6 अक्षरे)', mwr: 'अस्थायी पासवर्ड * (कम सूं कम 6 अक्षर)' },
  passwordPlaceholder: { en: 'they can change it later', hi: 'वे बाद में बदल सकते हैं', hinglish: 'wo baad mein change kar sakte hain', gu: 'તેઓ પછી બદલી શકે છે', mr: 'ते नंतर बदलू शकतात', mwr: 'वे पछै बदल सको है' },
  role: { en: 'Role', hi: 'रोल', hinglish: 'Role', gu: 'રોલ', mr: 'भूमिका', mwr: 'रोल' },
  department: { en: 'Department', hi: 'विभाग', hinglish: 'Department', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  creating: { en: 'Creating…', hi: 'बन रहा है…', hinglish: 'Create ho raha hai…', gu: 'બની રહ્યું છે…', mr: 'तयार होत आहे…', mwr: 'बण रियो है…' },
  createTeammate: { en: 'Create teammate', hi: 'टीममेट बनाएं', hinglish: 'Teammate banayein', gu: 'ટીમમેટ બનાવો', mr: 'टीममेट तयार करा', mwr: 'टीममेट बणावो' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  shareHint: { en: 'Share the email + password with them. They sign in at the login page.', hi: 'उन्हें ईमेल + पासवर्ड दें। वे लॉगिन पेज पर साइन इन करेंगे।', hinglish: 'Unhe email + password dein. Wo login page par sign in karenge.', gu: 'તેમને ઈમેલ + પાસવર્ડ આપો. તેઓ લોગિન પેજ પર સાઇન ઇન કરશે.', mr: 'त्यांना ईमेल + पासवर्ड द्या. ते लॉगिन पेजवर साइन इन करतील.', mwr: 'उणने ईमेल + पासवर्ड दो। वे लॉगिन पेज पर साइन इन करसी।' },
};

const BUILTIN_ROLES = [
  'pending', 'staff', 'designer', 'jobsetter', 'sales', 'hr',
  'manager', 'floor_manager', 'admin', 'superadmin', 'owner',
];

const ROLE_BADGE = {
  admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red',
  manager: 'badge-amber', floor_manager: 'badge-amber', hr: 'badge-amber',
  designer: 'badge-blue', jobsetter: 'badge-blue', sales: 'badge-blue',
  staff: 'badge-green', pending: 'badge-amber',
};

export default function PermissionsPage() {
  const { hasRole } = useAuth();
  const t = useT(S);
  const [users, setUsers] = useState({});
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const canEdit = hasRole('admin', 'superadmin', 'owner');

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  const rows = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id })),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.customRole || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div data-legacy-id="page-permissions">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('permissionsTeam')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? t('user') : t('users')}
            {!canEdit && ` · ${t('readOnly')}`}
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            {t('addTeammate')}
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
            {t('noUsers')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('thName')}</th>
                <th>{t('thEmail')}</th>
                <th>{t('thCurrentRole')}</th>
                <th>{t('thCustomRole')}</th>
                {canEdit && <th style={{ minWidth: 320 }}>{t('thChangeRole')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <RoleRow key={u.id} u={u} canEdit={canEdit} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AddTeammateModal onClose={() => setShowAdd(false)} t={t} />}
    </div>
  );
}

function RoleRow({ u, canEdit, t }) {
  const [role, setRole] = useState(u.role || 'pending');
  const [customRole, setCustomRole] = useState(u.customRole || '');
  const [busy, setBusy] = useState(false);

  const badgeClass = ROLE_BADGE[u.role] || 'badge-blue';

  const save = async () => {
    setBusy(true);
    try {
      await authApi.setRole(u.id, { role, customRole: customRole.trim() || null });
      showToast(t('roleUpdated'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td><b style={{ color: 'var(--text)' }}>{u.name || '—'}</b></td>
      <td>{u.email || '—'}</td>
      <td><span className={`badge ${badgeClass}`}>{u.role || 'pending'}</span></td>
      <td>{u.customRole || '—'}</td>
      {canEdit && (
        <td>
          <div className="flex gap-2 items-center">
            <select className="input" style={{ maxWidth: 150 }} value={role} onChange={(e) => setRole(e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="input" style={{ maxWidth: 130 }} placeholder="customRole" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddTeammateModal({ onClose, t }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', department: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return showToast(t('emailRequired'), 'error');
    if (form.password.length < 6) return showToast(t('passwordMin'), 'error');
    setBusy(true);
    try {
      await authApi.createUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        department: form.department.trim() || null,
      });
      showToast(`${t('teammateCreatedPrefix')} ${form.email.trim()} ${t('teammateCreatedSuffix')}`, 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('createFailed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, width: '100%' }}>
        <h3 style={{ marginBottom: 14 }}>{t('addTeammate')}</h3>

        <div className="form-group">
          <label>{t('fullName')}</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>{t('emailStar')}</label>
          <input className="input" type="email" placeholder={t('emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>{t('tempPassword')}</label>
          <input className="input" type="text" placeholder={t('passwordPlaceholder')} value={form.password} onChange={(e) => set('password', e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('role')}</label>
            <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('department')}</label>
            <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? t('creating') : t('createTeammate')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {t('shareHint')}
        </div>
      </form>
    </div>
  );
}
