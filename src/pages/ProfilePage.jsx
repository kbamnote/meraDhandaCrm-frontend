/**
 * Profile — read-only self-service page.
 * Shows the caller's own profile from useAuth() and a sign-out button.
 */
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const S = {
  myProfile: { en: '👤 My Profile', hi: '👤 मेरी प्रोफाइल', hinglish: '👤 Meri Profile', gu: '👤 મારી પ્રોફાઇલ', mr: '👤 माझी प्रोफाइल', mwr: '👤 म्हारी प्रोफाइल' },
  accountDetails: { en: 'Your account details', hi: 'आपके अकाउंट की जानकारी', hinglish: 'Aapke account ki details', gu: 'તમારા એકાઉન્ટની વિગતો', mr: 'तुमच्या खात्याचे तपशील', mwr: 'थांरे अकाउंट री जाणकारी' },
  signOut: { en: 'Sign out', hi: 'साइन आउट', hinglish: 'Sign out', gu: 'સાઇન આઉટ', mr: 'साइन आउट', mwr: 'साइन आउट' },
  details: { en: 'Details', hi: 'विवरण', hinglish: 'Details', gu: 'વિગતો', mr: 'तपशील', mwr: 'विवरण' },
  name: { en: 'Name', hi: 'नाम', hinglish: 'Naam', gu: 'નામ', mr: 'नाव', mwr: 'नाम' },
  email: { en: 'Email', hi: 'ईमेल', hinglish: 'Email', gu: 'ઈમેલ', mr: 'ईमेल', mwr: 'ईमेल' },
  role: { en: 'Role', hi: 'रोल', hinglish: 'Role', gu: 'રોલ', mr: 'भूमिका', mwr: 'रोल' },
  customRole: { en: 'Custom role', hi: 'कस्टम रोल', hinglish: 'Custom role', gu: 'કસ્ટમ રોલ', mr: 'कस्टम भूमिका', mwr: 'कस्टम रोल' },
  department: { en: 'Department', hi: 'विभाग', hinglish: 'Department', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  permissions: { en: 'Permissions', hi: 'परमिशन', hinglish: 'Permissions', gu: 'પરમિશન', mr: 'परवानग्या', mwr: 'परमिशन' },
  noPermissions: { en: 'No special permissions assigned.', hi: 'कोई खास परमिशन नहीं दी गई है।', hinglish: 'Koi special permission assign nahi hai.', gu: 'કોઈ ખાસ પરમિશન સોંપાયેલ નથી.', mr: 'कोणतीही विशेष परवानगी दिलेली नाही.', mwr: 'कोई खास परमिशन कोनी दी गी है।' },
};

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, signOut } = useAuth();
  const t = useT(S);
  const p = profile || {};
  const permissionKeys = Object.keys(p.permissions || {});

  return (
    <div data-legacy-id="page-profile">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('myProfile')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{t('accountDetails')}</div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={signOut}>{t('signOut')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            {t('details')}
          </div>
          <Row label={t('name')} value={p.name || '—'} />
          <Row label={t('email')} value={p.email || '—'} />
          <Row
            label={t('role')}
            value={p.role ? <span className="badge badge-blue">{p.role}</span> : '—'}
          />
          <Row
            label={t('customRole')}
            value={p.customRole ? <span className="badge badge-amber">{p.customRole}</span> : '—'}
          />
          <Row label={t('department')} value={p.department || '—'} />
        </div>

        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            {t('permissions')} ({permissionKeys.length})
          </div>
          {permissionKeys.length ? (
            <div className="flex" style={{ flexWrap: 'wrap', gap: 6 }}>
              {permissionKeys.map((k) => (
                <span key={k} className="badge badge-green">{k}</span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              {t('noPermissions')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
