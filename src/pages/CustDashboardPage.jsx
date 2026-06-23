import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const S = {
  welcome: { en: 'Welcome', hi: 'स्वागत है', hinglish: 'Welcome', gu: 'સ્વાગત છે', mr: 'स्वागत आहे', mwr: 'पधारो' },
  subtitle: { en: 'Here’s a quick look at your orders and bills.', hi: 'यहां आपके ऑर्डर और बिल की एक झलक है।', hinglish: 'Yahan aapke orders aur bills ki ek jhalak hai.', gu: 'અહીં તમારા ઓર્ડર અને બિલની એક ઝલક છે.', mr: 'इथे तुमच्या ऑर्डर आणि बिलांची एक झलक आहे.', mwr: 'अठै थारा ऑर्डर अर बिल री एक झलक है।' },
  myJobs: { en: 'My jobs', hi: 'मेरे जॉब', hinglish: 'My jobs', gu: 'મારા જોબ', mr: 'माझे जॉब', mwr: 'म्हारा जॉब' },
  openInvoices: { en: 'Open invoices', hi: 'खुले इनवॉइस', hinglish: 'Open invoices', gu: 'ખુલ્લા ઇન્વોઇસ', mr: 'खुली इन्व्हॉइस', mwr: 'खुला इनवॉइस' },
  needHelp: { en: 'Need help?', hi: 'मदद चाहिए?', hinglish: 'Madad chahiye?', gu: 'મદદ જોઈએ?', mr: 'मदत हवी?', mwr: 'मदद चाहिजे?' },
  needHelpBody: { en: 'Reach out to our team for anything about your jobs or invoices. We’re happy to help.', hi: 'अपने जॉब या इनवॉइस से जुड़ी किसी भी बात के लिए हमारी टीम से संपर्क करें। हमें मदद करके खुशी होगी।', hinglish: 'Apne jobs ya invoices se judi kisi bhi baat ke liye hamari team se sampark karein. Humein madad karke khushi hogi.', gu: 'તમારા જોબ કે ઇન્વોઇસ વિશે કોઈપણ બાબત માટે અમારી ટીમનો સંપર્ક કરો. અમને મદદ કરવામાં આનંદ થશે.', mr: 'तुमच्या जॉब किंवा इन्व्हॉइसबद्दल कशासाठीही आमच्या टीमशी संपर्क साधा. आम्हाला मदत करण्यात आनंद होईल.', mwr: 'थारा जॉब या इनवॉइस सूं जुड़ी कोई बात खातर म्हारी टीम सूं संपर्क करो। म्हाने मदद करण में खुशी होसी।' },
};

export default function CustDashboardPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  const [invoices, setInvoices] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/invoices'), (snap) => setInvoices(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const jobList = useMemo(() => Object.values(jobs || {}), [jobs]);
  const invoiceList = useMemo(() => Object.values(invoices || {}), [invoices]);

  const myJobs = jobList.length;
  const openInvoices = useMemo(
    () => invoiceList.filter((inv) => inv && inv.status !== 'paid').length,
    [invoiceList]
  );

  const cards = [
    { label: t('myJobs'), icon: '🛠', value: myJobs },
    { label: t('openInvoices'), icon: '🧾', value: openInvoices },
  ];

  return (
    <div data-legacy-id="page-cust-dashboard">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        👋 {t('welcome')}{profile?.name ? `, ${profile.name}` : ''}
      </h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        {t('subtitle')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, background: 'var(--blue-light)', borderColor: 'var(--blue)' }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--blue-dark)' }}>{t('needHelp')}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('needHelpBody')}
        </div>
      </div>
    </div>
  );
}
