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
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const EMPTY = { name: '', tagline: '', phone: '', email: '', address: '', gstNo: '', website: '' };

const S = {
  title: { en: '🏢 Company Settings', hi: '🏢 कंपनी सेटिंग्स', hinglish: '🏢 Company Settings', gu: '🏢 કંપની સેટિંગ્સ', mr: '🏢 कंपनी सेटिंग्ज', mwr: '🏢 कंपनी सेटिंग्स' },
  subtitle: { en: 'Your business profile used across invoices, quotes and documents.', hi: 'आपका बिज़नेस प्रोफाइल जो इनवॉइस, कोटेशन और डॉक्युमेंट में इस्तेमाल होता है।', hinglish: 'Aapka business profile jo invoices, quotes aur documents mein use hota hai.', gu: 'તમારી બિઝનેસ પ્રોફાઇલ જે ઇન્વોઇસ, ક્વોટ્સ અને દસ્તાવેજોમાં વપરાય છે.', mr: 'तुमची व्यवसाय प्रोफाइल जी इनव्हॉइस, कोट्स आणि कागदपत्रांत वापरली जाते.', mwr: 'थांरो बिज़नेस प्रोफाइल जको इनवॉइस, कोटेशन अर डॉक्युमेंट में काम आवै।' },
  readOnly: { en: '🔒 You have read-only access. Only admins can change company settings.', hi: '🔒 आपके पास सिर्फ़ देखने का एक्सेस है। सिर्फ़ एडमिन कंपनी सेटिंग्स बदल सकते हैं।', hinglish: '🔒 Aapke paas sirf read-only access hai. Sirf admins company settings change kar sakte hain.', gu: '🔒 તમારી પાસે ફક્ત વાંચવાનો એક્સેસ છે. ફક્ત એડમિન કંપની સેટિંગ્સ બદલી શકે છે.', mr: '🔒 तुमच्याकडे फक्त वाचण्याचा अॅक्सेस आहे. फक्त अॅडमिन कंपनी सेटिंग्ज बदलू शकतात.', mwr: '🔒 थांरे कने सिरफ देखण रो एक्सेस है। सिरफ एडमिन कंपनी सेटिंग्स बदल सको।' },
  name: { en: 'Company name', hi: 'कंपनी का नाम', hinglish: 'Company ka naam', gu: 'કંપનીનું નામ', mr: 'कंपनीचे नाव', mwr: 'कंपनी रो नाम' },
  tagline: { en: 'Tagline', hi: 'टैगलाइन', hinglish: 'Tagline', gu: 'ટેગલાઇન', mr: 'टॅगलाइन', mwr: 'टैगलाइन' },
  phone: { en: 'Phone', hi: 'फ़ोन', hinglish: 'Phone', gu: 'ફોન', mr: 'फोन', mwr: 'फोन' },
  email: { en: 'Email', hi: 'ईमेल', hinglish: 'Email', gu: 'ઈમેલ', mr: 'ईमेल', mwr: 'ईमेल' },
  address: { en: 'Address', hi: 'पता', hinglish: 'Address', gu: 'સરનામું', mr: 'पत्ता', mwr: 'पतो' },
  gstNo: { en: 'GST No.', hi: 'GST नंबर', hinglish: 'GST No.', gu: 'GST નંબર', mr: 'GST क्र.', mwr: 'GST नंबर' },
  website: { en: 'Website', hi: 'वेबसाइट', hinglish: 'Website', gu: 'વેબસાઇટ', mr: 'वेबसाइट', mwr: 'वेबसाइट' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  save: { en: 'Save settings', hi: 'सेटिंग्स सेव करें', hinglish: 'Settings save karein', gu: 'સેટિંગ્સ સેવ કરો', mr: 'सेटिंग्ज सेव करा', mwr: 'सेटिंग्स सेव करो' },
  saved: { en: 'Company settings saved', hi: 'कंपनी सेटिंग्स सेव हो गईं', hinglish: 'Company settings save ho gayi', gu: 'કંપની સેટિંગ્સ સેવ થઈ', mr: 'कंपनी सेटिंग्ज सेव झाली', mwr: 'कंपनी सेटिंग्स सेव हो गी' },
  saveFailed: { en: 'Failed to save', hi: 'सेव नहीं हुआ', hinglish: 'Save nahi hua', gu: 'સેવ નિષ્ફળ', mr: 'सेव अयशस्वी', mwr: 'सेव कोनी हुयो' },
  loadFailed: { en: 'Failed to load settings', hi: 'सेटिंग्स लोड नहीं हुईं', hinglish: 'Settings load nahi hui', gu: 'સેટિંગ્સ લોડ નિષ્ફળ', mr: 'सेटिंग्ज लोड अयशस्वी', mwr: 'सेटिंग्स लोड कोनी हुई' },
};

export default function CompanySettingsPage() {
  const { hasRole } = useAuth();
  const t = useT(S);
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
          showToast(err.response?.data?.error || t('loadFailed'), 'error');
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
      showToast(t('saved'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('saveFailed'), 'error');
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
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('subtitle')}
        </div>
      </div>

      {!canEdit && (
        <div
          className="card mb-4"
          style={{ background: 'var(--amber-light)', borderColor: 'var(--amber)' }}
        >
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {t('readOnly')}
          </div>
        </div>
      )}

      <form className="card" onSubmit={save} style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label>{t('name')}</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="form-group">
          <label>{t('tagline')}</label>
          <input
            className="input"
            value={form.tagline}
            onChange={(e) => setField('tagline', e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('phone')}</label>
            <input
              className="input"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('email')}</label>
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
          <label>{t('address')}</label>
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
            <label>{t('gstNo')}</label>
            <input
              className="input"
              value={form.gstNo}
              onChange={(e) => setField('gstNo', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('website')}</label>
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
              {busy ? t('saving') : t('save')}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
