/**
 * Profile — read-only self-service page.
 * Shows the caller's own profile from useAuth() and a sign-out button.
 */
import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { meApi, uploadApi } from '../services/api';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  changePhoto: { en: 'Change photo', hi: 'फोटो बदलें', hinglish: 'Photo badlein', gu: 'ફોટો બદલો', mr: 'फोटो बदला', mwr: 'फोटो बदलो' },
  removePhoto: { en: 'Remove', hi: 'हटाएं', hinglish: 'Remove', gu: 'કાઢો', mr: 'काढा', mwr: 'हटाओ' },
  uploading: { en: 'Uploading…', hi: 'अपलोड हो रहा है…', hinglish: 'Uploading…', gu: 'અપલોડ થઈ રહ્યું છે…', mr: 'अपलोड होत आहे…', mwr: 'अपलोड हो रयो है…' },
  photoSaved: { en: 'Photo updated', hi: 'फोटो अपडेट हुई', hinglish: 'Photo update ho gayi', gu: 'ફોટો અપડેટ થયો', mr: 'फोटो अपडेट झाला', mwr: 'फोटो अपडेट हुई' },
  photoFailed: { en: 'Could not update the photo', hi: 'फोटो अपडेट नहीं हुई', hinglish: 'Photo update nahi hui', gu: 'ફોટો અપડેટ ન થયો', mr: 'फोटो अपडेट झाला नाही', mwr: 'फोटो अपडेट कोनी हुई' },
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
  const { profile, signOut, setProfile } = useAuth();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const t = useT(S);
  const p = profile || {};
  const permissionKeys = Object.keys(p.permissions || {});

  /**
   * The photo goes to /api/upload like every other image and only the link
   * it returns is stored on the user — the same route attendance selfies and
   * shop-visit photos use, so one place decides how pictures are kept.
   */
  const pickPhoto = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';           // let the same file be picked again after a failure
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadApi.upload(file, 'selfie');
      const saved = await meApi.updateProfile({ avatar: up.url });
      setProfile(saved);
      showToast(t('photoSaved'), 'success');
    } catch (err) {
      showToast(err?.response?.data?.error || t('photoFailed'), 'error');
    } finally { setBusy(false); }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      setProfile(await meApi.updateProfile({ avatar: null }));
    } catch (err) {
      showToast(err?.response?.data?.error || t('photoFailed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div data-legacy-id="page-profile">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center" style={{ gap: 14 }}>
          {/* The photo IS the control: clicking it opens the picker, which is
              where everyone tries first. */}
          <button type="button" onClick={() => fileRef.current && fileRef.current.click()}
            disabled={busy} data-testid="avatar-pick" title={t('changePhoto')}
            style={{
              width: 72, height: 72, borderRadius: '50%', padding: 0, cursor: 'pointer',
              border: '2px solid var(--border)', overflow: 'hidden', background: 'var(--bg2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {p.avatar
              ? <img src={p.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text3)' }}>
                {(p.name || p.email || '?').trim().slice(0, 1).toUpperCase()}
              </span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            data-testid="avatar-input" onChange={pickPhoto} />
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('myProfile')}</h2>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{t('accountDetails')}</div>
            <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 10 }}>
              <button className="btn btn-xs btn-ghost" disabled={busy}
                onClick={() => fileRef.current && fileRef.current.click()}>
                {busy ? t('uploading') : t('changePhoto')}
              </button>
              {p.avatar && (
                <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }}
                  disabled={busy} onClick={removePhoto} data-testid="avatar-remove">
                  {t('removePhoto')}
                </button>
              )}
            </div>
          </div>
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
