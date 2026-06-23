import { useEffect, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const STAT_PATHS = [
  { path: 'mpw/tasks',    labelKey: 'tasks',    icon: '✅' },
  { path: 'mpw/users',    labelKey: 'staff',    icon: '👥' },
  { path: 'mpw/leads',    labelKey: 'leads',    icon: '📞' },
  { path: 'mpw/products', labelKey: 'products', icon: '🛍' },
  { path: 'mpw/vendors',  labelKey: 'vendors',  icon: '🏪' },
  { path: 'mpw/machines', labelKey: 'machines', icon: '⚙️' },
];

const S = {
  welcome: { en: 'Welcome', hi: 'स्वागत है', hinglish: 'Welcome', gu: 'સ્વાગત છે', mr: 'स्वागत आहे', mwr: 'पधारो' },
  glance: { en: 'Workflow at a glance', hi: 'वर्कफ़्लो एक नज़र में', hinglish: 'Workflow ek nazar mein', gu: 'વર્કફ્લો એક નજરમાં', mr: 'वर्कफ्लो एका दृष्टीक्षेपात', mwr: 'वर्कफ़्लो एक नज़र में' },
  role: { en: 'role', hi: 'रोल', hinglish: 'role', gu: 'રોલ', mr: 'भूमिका', mwr: 'रोल' },
  custom: { en: 'custom', hi: 'कस्टम', hinglish: 'custom', gu: 'કસ્ટમ', mr: 'कस्टम', mwr: 'कस्टम' },
  tasks: { en: 'Tasks', hi: 'टास्क', hinglish: 'Tasks', gu: 'ટાસ્ક', mr: 'टास्क', mwr: 'टास्क' },
  staff: { en: 'Staff', hi: 'स्टाफ', hinglish: 'Staff', gu: 'સ્ટાફ', mr: 'कर्मचारी', mwr: 'स्टाफ' },
  leads: { en: 'Leads', hi: 'लीड्स', hinglish: 'Leads', gu: 'લીડ્સ', mr: 'लीड्स', mwr: 'लीड्स' },
  products: { en: 'Products', hi: 'प्रोडक्ट्स', hinglish: 'Products', gu: 'પ્રોડક્ટ્સ', mr: 'प्रोडक्ट्स', mwr: 'प्रोडक्ट्स' },
  vendors: { en: 'Vendors', hi: 'वेंडर्स', hinglish: 'Vendors', gu: 'વેન્ડર્સ', mr: 'विक्रेते', mwr: 'वेंडर्स' },
  machines: { en: 'Machines', hi: 'मशीनें', hinglish: 'Machines', gu: 'મશીનો', mr: 'मशीन', mwr: 'मशीनां' },
  devNotes: { en: '👨‍💻 Developer notes', hi: '👨‍💻 डेवलपर नोट्स', hinglish: '👨‍💻 Developer notes', gu: '👨‍💻 ડેવલપર નોટ્સ', mr: '👨‍💻 डेव्हलपर नोट्स', mwr: '👨‍💻 डेवलपर नोट्स' },
  devNotesBody: { en: 'The Tasks page is fully ported as a reference. Use that pattern to port the remaining stub pages. See', hi: 'टास्क पेज पूरी तरह रेफरेंस के तौर पर पोर्ट किया गया है। बाकी स्टब पेजों को पोर्ट करने के लिए वही पैटर्न इस्तेमाल करें। देखें', hinglish: 'Tasks page poori tarah reference ke taur par port kiya gaya hai. Baaki stub pages port karne ke liye wahi pattern use karein. Dekhein', gu: 'ટાસ્ક પેજ સંપૂર્ણપણે રેફરન્સ તરીકે પોર્ટ થયું છે. બાકીના સ્ટબ પેજ પોર્ટ કરવા માટે એ જ પેટર્ન વાપરો. જુઓ', mr: 'टास्क पेज संदर्भ म्हणून पूर्णपणे पोर्ट केले आहे. उरलेली स्टब पेज पोर्ट करण्यासाठी तोच पॅटर्न वापरा. पहा', mwr: 'टास्क पेज पूरी तरां रेफरेंस रूप में पोर्ट कर्यो गयो है। बाकी स्टब पेज पोर्ट करण खातर वोही पैटर्न काम में ल्यो। देखो' },
  forPlan: { en: 'for the full plan.', hi: 'पूरी योजना के लिए।', hinglish: 'poore plan ke liye.', gu: 'સંપૂર્ણ યોજના માટે.', mr: 'संपूर्ण योजनेसाठी.', mwr: 'पूरी योजना खातर।' },
};

export default function AdminPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const unsubs = STAT_PATHS.map(({ path }) => {
      const r = ref(db, path);
      return onValue(r, (snap) => {
        const v = snap.val();
        setCounts(prev => ({ ...prev, [path]: v ? Object.keys(v).length : 0 }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div data-legacy-id="page-admin">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        🏠 {t('welcome')}{profile?.name ? `, ${profile.name}` : ''}
      </h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        {t('glance')} · {t('role')}: <b>{profile?.role || '—'}</b>
        {profile?.customRole && <> · {t('custom')}: <b>{profile.customRole}</b></>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {STAT_PATHS.map(s => (
          <div key={s.path} className="card">
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{t(s.labelKey)}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
              {counts[s.path] ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, background: 'var(--blue-light)', borderColor: 'var(--blue)' }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--blue-dark)' }}>{t('devNotes')}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('devNotesBody')} <code>docs/MIGRATION_GUIDE.md</code> {t('forPlan')}
        </div>
      </div>
    </div>
  );
}
