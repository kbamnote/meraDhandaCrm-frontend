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
import { useT, useLang } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import { canViewModule } from '../config/access';

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

  thAccess: { en: 'Access', hi: 'एक्सेस', hinglish: 'Access', gu: 'એક્સેસ', mr: 'अॅक्सेस', mwr: 'एक्सेस' },
  manageAccess: { en: '🔧 Access', hi: '🔧 एक्सेस', hinglish: '🔧 Access', gu: '🔧 એક્સેસ', mr: '🔧 अॅक्सेस', mwr: '🔧 एक्सेस' },
  accessFor: { en: 'Module access', hi: 'मॉड्यूल एक्सेस', hinglish: 'Module access', gu: 'મોડ્યુલ એક્સેસ', mr: 'मॉड्यूल अॅक्सेस', mwr: 'मॉड्यूल एक्सेस' },
  canViewCol: { en: 'View', hi: 'देखें', hinglish: 'View', gu: 'જુઓ', mr: 'पाहा', mwr: 'देखो' },
  canEditCol: { en: 'Edit', hi: 'एडिट', hinglish: 'Edit', gu: 'એડિટ', mr: 'एडिट', mwr: 'एडिट' },
  accessSaved: { en: 'Access updated', hi: 'एक्सेस अपडेट हो गया', hinglish: 'Access update ho gaya', gu: 'એક્સેસ અપડેટ થયો', mr: 'अॅक्सेस अपडेट झाला', mwr: 'एक्सेस अपडेट हो ग्यो' },
  showAll: { en: 'Show all', hi: 'सब दिखाएं', hinglish: 'Sab dikhayein', gu: 'બધા બતાવો', mr: 'सर्व दाखवा', mwr: 'सगळा दिखावो' },
  hideAll: { en: 'Hide all', hi: 'सब छुपाएं', hinglish: 'Sab chhupayein', gu: 'બધા છુપાવો', mr: 'सर्व लपवा', mwr: 'सगळा छुपावो' },
  close: { en: 'Close', hi: 'बंद करें', hinglish: 'Close karein', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  accessHint: { en: 'Switch a section ON so this teammate can see it; Edit also lets them create/change records (needs View). New staff start with only the basics; job roles already see their own sections. Admins & owners always have full access.', hi: 'सेक्शन ON करें ताकि यह टीममेट उसे देख सके; एडिट से रिकॉर्ड बना/बदल भी सकता है (देखें ज़रूरी)। नया स्टाफ सिर्फ़ बेसिक से शुरू होता है; जॉब रोल अपने सेक्शन पहले से देखते हैं। एडमिन/ओनर के पास हमेशा पूरा एक्सेस।', hinglish: 'Section ON karein taaki teammate use dekh sake; Edit se record bana/badal bhi sakta hai (View zaroori). Naya staff sirf basics se start hota hai; job roles apne section pehle se dekhte hain. Admin/owner ke paas hamesha full access.', gu: 'સેક્શન ON કરો જેથી આ ટીમમેટ તે જુએ; એડિટથી રેકોર્ડ બનાવી/બદલી શકે (જુઓ જરૂરી). નવો સ્ટાફ ફક્ત બેઝિકથી શરૂ થાય; જોબ રોલ પોતાના સેક્શન પહેલેથી જુએ. એડમિન/ઓનર પાસે હંમેશા સંપૂર્ણ એક્સેસ.', mr: 'सेक्शन ON करा जेणेकरून हा टीममेट तो पाहू शकेल; एडिटने रेकॉर्ड तयार/बदलू शकतो (पाहा आवश्यक). नवीन स्टाफ फक्त बेसिकने सुरू होतो; जॉब रोल त्यांचे सेक्शन आधीच पाहतात. अॅडमिन/ओनरकडे नेहमी पूर्ण अॅक्सेस.', mwr: 'सेक्शन ON करो ताकि यो टीममेट उणनै देख सकै; एडिट सूं रिकॉर्ड बणा/बदल सकै (देखो जरूरी). नयो स्टाफ सिरफ बेसिक सूं चालू होवै; जॉब रोल आपरा सेक्शन पैलां सूं देखै. एडमिन/ओनर कनै हमेसा पूरो एक्सेस.' },
};

// Friendly module labels mapped to the enforced "<collection>.write" capability
// keys. Sensitive collections (users, payroll, companySettings…) are intentionally
// NOT here — they stay admin/owner-only and the backend rejects granting them.
const MODULES = [
  { key: 'jobs', label: { en: 'Job cards', hi: 'जॉब कार्ड', hinglish: 'Job cards' } },
  { key: 'production', label: { en: 'Production', hi: 'प्रोडक्शन', hinglish: 'Production' } },
  { key: 'qc', label: { en: 'Quality check', hi: 'QC', hinglish: 'Quality check' } },
  { key: 'dispatch', label: { en: 'Dispatch', hi: 'डिस्पैच', hinglish: 'Dispatch' } },
  { key: 'designers', label: { en: 'Designer panel', hi: 'डिज़ाइनर', hinglish: 'Designer panel' } },
  { key: 'clients', label: { en: 'Customers', hi: 'ग्राहक', hinglish: 'Customers' } },
  { key: 'leads', label: { en: 'Leads / Sales', hi: 'लीड्स / सेल्स', hinglish: 'Leads / Sales' } },
  { key: 'invoices', label: { en: 'Invoices & Accounting', hi: 'इनवॉइस', hinglish: 'Invoices' } },
  { key: 'expenses', label: { en: 'Expenses', hi: 'खर्चे', hinglish: 'Expenses' } },
  { key: 'stock', label: { en: 'Stock', hi: 'स्टॉक', hinglish: 'Stock' } },
  { key: 'products', label: { en: 'Products', hi: 'प्रोडक्ट्स', hinglish: 'Products' } },
  { key: 'vendors', label: { en: 'Vendors', hi: 'वेंडर', hinglish: 'Vendors' } },
  { key: 'machines', label: { en: 'Machines', hi: 'मशीनें', hinglish: 'Machines' } },
  { key: 'tasks', label: { en: 'Tasks', hi: 'टास्क', hinglish: 'Tasks' } },
  { key: 'attendance', label: { en: 'Attendance', hi: 'अटेंडेंस', hinglish: 'Attendance' } },
];

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
                {canEdit && <th>{t('thAccess')}</th>}
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
  const [showAccess, setShowAccess] = useState(false);

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
      {canEdit && (
        <td>
          <button className="btn btn-ghost btn-xs" onClick={() => setShowAccess(true)}>
            {t('manageAccess')}
          </button>
          {showAccess && <PermissionsModal u={u} t={t} onClose={() => setShowAccess(false)} />}
        </td>
      )}
    </tr>
  );
}

function PermissionsModal({ u, t, onClose }) {
  const { lang } = useLang();
  const [perms, setPerms] = useState(() => {
    const p = u.permissions || {};
    const init = {};
    for (const m of MODULES) {
      init[m.key] = {
        view: canViewModule(u.role, m.key, p), // allow-list: role default or explicit grant
        edit: p[`${m.key}.write`] === true,
      };
    }
    return init;
  });
  const [busy, setBusy] = useState(false);

  const adminLike = ['admin', 'superadmin', 'owner'].includes(u.role);

  const toggleView = (k) => setPerms((p) => {
    const view = !p[k].view;
    return { ...p, [k]: { view, edit: view ? p[k].edit : false } }; // can't edit what you can't view
  });
  const toggleEdit = (k) => setPerms((p) => (p[k].view ? { ...p, [k]: { ...p[k], edit: !p[k].edit } } : p));
  const setAllView = (view) => setPerms(Object.fromEntries(MODULES.map((m) => [m.key, { view, edit: view ? perms[m.key].edit : false }])));

  const save = async () => {
    setBusy(true);
    try {
      const permissions = {};
      for (const m of MODULES) {
        permissions[`${m.key}.read`] = !!perms[m.key].view;
        permissions[`${m.key}.write`] = !!(perms[m.key].view && perms[m.key].edit);
      }
      await authApi.setRole(u.id, { permissions });
      showToast(t('accessSaved'), 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: 4 }}>{t('accessFor')}</h3>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          {u.name || u.email} · <span className="badge badge-blue">{u.role || 'pending'}</span>
        </div>

        {adminLike && (
          <div style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--surface2)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            {u.role} already has full access — these toggles only matter for non-admin roles.
          </div>
        )}

        <div className="flex gap-2 mb-2 items-center">
          <button className="btn btn-ghost btn-xs" onClick={() => setAllView(true)}>{t('showAll')}</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setAllView(false)}>{t('hideAll')}</button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 18, fontSize: 11, color: 'var(--text3)', paddingRight: 4 }}>
            <span>{t('canViewCol')}</span><span>{t('canEditCol')}</span>
          </span>
        </div>

        <div style={{ overflow: 'auto', flex: 1, border: '1px solid var(--border)', borderRadius: 8 }}>
          {MODULES.map((m, i) => (
            <div
              key={m.key}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: i ? '1px solid var(--border)' : 'none' }}
            >
              <span style={{ color: 'var(--text)' }}>{m.label[lang] ?? m.label.en}</span>
              <span style={{ display: 'flex', gap: 22, alignItems: 'center', paddingRight: 6 }}>
                <input type="checkbox" title={t('canViewCol')} checked={perms[m.key].view} onChange={() => toggleView(m.key)} style={{ width: 18, height: 18 }} />
                <input type="checkbox" title={t('canEditCol')} checked={perms[m.key].edit} disabled={!perms[m.key].view} onChange={() => toggleEdit(m.key)} style={{ width: 18, height: 18 }} />
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', margin: '10px 0' }}>{t('accessHint')}</div>

        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={save} disabled={busy}>
            {busy ? t('saving') : t('save')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
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
