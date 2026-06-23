/**
 * Billing & company — the tenant's own plan / trial status, plus company name
 * editing for owners/admins. Upgrade is a placeholder CTA for now (Razorpay
 * subscription automation is the next iteration).
 */
import { useState } from 'react';
import { tenantApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  modDesigners: { en: 'Design team (Designers, Job Setter)', hi: 'डिज़ाइन टीम (डिज़ाइनर, जॉब सेटर)', hinglish: 'Design team (Designers, Job Setter)', gu: 'ડિઝાઇન ટીમ (ડિઝાઇનર, જોબ સેટર)', mr: 'डिझाइन टीम (डिझाइनर, जॉब सेटर)', mwr: 'डिज़ाइन टीम (डिज़ाइनर, जॉब सेटर)' },
  modMachines: { en: 'Machines & maintenance', hi: 'मशीनें और रखरखाव', hinglish: 'Machines & maintenance', gu: 'મશીનો અને જાળવણી', mr: 'मशीन आणि देखभाल', mwr: 'मशीनां अर रखरखाव' },
  modQcDispatch: { en: 'Quality control & dispatch', hi: 'क्वालिटी कंट्रोल और डिस्पैच', hinglish: 'Quality control & dispatch', gu: 'ક્વોલિટી કંટ્રોલ અને ડિસ્પેચ', mr: 'क्वालिटी कंट्रोल आणि डिस्पॅच', mwr: 'क्वालिटी कंट्रोल अर डिस्पैच' },
  modHr: { en: 'HR (attendance, leaves, payroll)', hi: 'HR (हाज़िरी, छुट्टियाँ, पेरोल)', hinglish: 'HR (attendance, leaves, payroll)', gu: 'HR (હાજરી, રજાઓ, પેરોલ)', mr: 'HR (हजेरी, रजा, पेरोल)', mwr: 'HR (हाजरी, छुट्टियां, पेरोल)' },
  modBulk: { en: 'Bulk / B2B orders (Enquiries, Samples)', hi: 'बल्क / B2B ऑर्डर (पूछताछ, सैंपल)', hinglish: 'Bulk / B2B orders (Enquiries, Samples)', gu: 'બલ્ક / B2B ઓર્ડર (પૂછપરછ, સેમ્પલ)', mr: 'बल्क / B2B ऑर्डर (चौकशी, सॅम्पल)', mwr: 'बल्क / B2B ऑर्डर (पूछताछ, सैंपल)' },

  billingPlan: { en: '💳 Billing & Plan', hi: '💳 बिलिंग और प्लान', hinglish: '💳 Billing & Plan', gu: '💳 બિલિંગ અને પ્લાન', mr: '💳 बिलिंग आणि प्लान', mwr: '💳 बिलिंग अर प्लान' },
  subAndCompany: { en: 'Your subscription and company details', hi: 'आपकी सब्सक्रिप्शन और कंपनी की जानकारी', hinglish: 'Aapki subscription aur company details', gu: 'તમારી સબ્સ્ક્રિપ્શન અને કંપની વિગતો', mr: 'तुमची सबस्क्रिप्शन आणि कंपनी तपशील', mwr: 'थांरी सब्सक्रिप्शन अर कंपनी री जाणकारी' },
  plan: { en: 'Plan', hi: 'प्लान', hinglish: 'Plan', gu: 'પ્લાન', mr: 'प्लान', mwr: 'प्लान' },
  company: { en: 'Company', hi: 'कंपनी', hinglish: 'Company', gu: 'કંપની', mr: 'कंपनी', mwr: 'कंपनी' },
  tenantId: { en: 'Tenant ID:', hi: 'टेनेंट ID:', hinglish: 'Tenant ID:', gu: 'ટેનન્ટ ID:', mr: 'टेनंट ID:', mwr: 'टेनेंट ID:' },

  trialEnded: { en: 'Trial ended', hi: 'ट्रायल खत्म', hinglish: 'Trial khatam', gu: 'ટ્રાયલ સમાપ્ત', mr: 'ट्रायल संपले', mwr: 'ट्रायल खतम' },
  suspended: { en: 'Suspended', hi: 'सस्पेंड', hinglish: 'Suspended', gu: 'સસ્પેન્ડ', mr: 'निलंबित', mwr: 'सस्पेंड' },
  trialPrefix: { en: 'Trial', hi: 'ट्रायल', hinglish: 'Trial', gu: 'ટ્રાયલ', mr: 'ट्रायल', mwr: 'ट्रायल' },
  daysLeft: { en: 'days left', hi: 'दिन बाकी', hinglish: 'din baaki', gu: 'દિવસ બાકી', mr: 'दिवस उरले', mwr: 'दिन बाकी' },
  active: { en: 'active', hi: 'एक्टिव', hinglish: 'active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },

  trialEndedBanner: { en: '⛔ Your free trial has ended', hi: '⛔ आपका फ्री ट्रायल खत्म हो गया है', hinglish: '⛔ Aapka free trial khatam ho gaya hai', gu: '⛔ તમારો ફ્રી ટ્રાયલ સમાપ્ત થઈ ગયો છે', mr: '⛔ तुमचा फ्री ट्रायल संपला आहे', mwr: '⛔ थांरो फ्री ट्रायल खतम हो ग्यो है' },
  trialDaysBannerPrefix: { en: '⏳', hi: '⏳', hinglish: '⏳', gu: '⏳', mr: '⏳', mwr: '⏳' },
  trialDaysBannerSuffix: { en: 'days left in your free trial', hi: 'दिन फ्री ट्रायल में बाकी', hinglish: 'din free trial mein baaki', gu: 'દિવસ તમારા ફ્રી ટ્રાયલમાં બાકી', mr: 'दिवस तुमच्या फ्री ट्रायलमध्ये उरले', mwr: 'दिन थांरे फ्री ट्रायल में बाकी' },
  upgradeExpiredHint: { en: 'Upgrade to a paid plan to keep adding and editing data. Your data is safe and still viewable.', hi: 'डेटा जोड़ते और एडिट करते रहने के लिए पेड प्लान लें। आपका डेटा सुरक्षित है और अभी भी देखा जा सकता है।', hinglish: 'Data add aur edit karte rehne ke liye paid plan lein. Aapka data safe hai aur abhi bhi dekha ja sakta hai.', gu: 'ડેટા ઉમેરવા અને એડિટ કરવાનું ચાલુ રાખવા પેઇડ પ્લાન લો. તમારો ડેટા સુરક્ષિત છે અને હજુ પણ જોઈ શકાય છે.', mr: 'डेटा जोडत आणि एडिट करत राहण्यासाठी पेड प्लान घ्या. तुमचा डेटा सुरक्षित आहे आणि अजूनही पाहता येतो.', mwr: 'डेटा जोड़तो अर एडिट करतो रैवण खातर पेड प्लान लो। थांरो डेटा सुरक्षित है अर अबे ई देख सको हो।' },
  upgradeTrialHint: { en: 'Upgrade any time to keep full access after your trial.', hi: 'ट्रायल के बाद पूरा एक्सेस बनाए रखने के लिए कभी भी अपग्रेड करें।', hinglish: 'Trial ke baad full access banaye rakhne ke liye kabhi bhi upgrade karein.', gu: 'ટ્રાયલ પછી પૂરી એક્સેસ જાળવવા ગમે ત્યારે અપગ્રેડ કરો.', mr: 'ट्रायलनंतर पूर्ण अॅक्सेस ठेवण्यासाठी कधीही अपग्रेड करा.', mwr: 'ट्रायल पछै पूरो एक्सेस राखण खातर कद ई अपग्रेड करो।' },
  upgradeToast: { en: 'To upgrade, contact MeraDhanda support — online payment is coming soon.', hi: 'अपग्रेड करने के लिए MeraDhanda सपोर्ट से संपर्क करें — ऑनलाइन पेमेंट जल्द आ रहा है।', hinglish: 'Upgrade karne ke liye MeraDhanda support se contact karein — online payment jald aa raha hai.', gu: 'અપગ્રેડ કરવા MeraDhanda સપોર્ટનો સંપર્ક કરો — ઓનલાઇન પેમેન્ટ ટૂંક સમયમાં આવી રહ્યું છે.', mr: 'अपग्रेड करण्यासाठी MeraDhanda सपोर्टशी संपर्क साधा — ऑनलाइन पेमेंट लवकरच येत आहे.', mwr: 'अपग्रेड करण खातर MeraDhanda सपोर्ट सूं संपर्क करो — ऑनलाइन पेमेंट जल्दी आय रियो है।' },
  upgradePlan: { en: 'Upgrade plan', hi: 'प्लान अपग्रेड करें', hinglish: 'Plan upgrade karein', gu: 'પ્લાન અપગ્રેડ કરો', mr: 'प्लान अपग्रेड करा', mwr: 'प्लान अपग्रेड करो' },

  companySettings: { en: 'Company settings', hi: 'कंपनी सेटिंग्स', hinglish: 'Company settings', gu: 'કંપની સેટિંગ્સ', mr: 'कंपनी सेटिंग्ज', mwr: 'कंपनी सेटिंग्स' },
  companyName: { en: 'Company name', hi: 'कंपनी का नाम', hinglish: 'Company ka naam', gu: 'કંપનીનું નામ', mr: 'कंपनीचे नाव', mwr: 'कंपनी रो नाम' },
  companyNameRequired: { en: 'Company name required', hi: 'कंपनी का नाम ज़रूरी है', hinglish: 'Company ka naam zaroori hai', gu: 'કંપનીનું નામ જરૂરી છે', mr: 'कंपनीचे नाव आवश्यक आहे', mwr: 'कंपनी रो नाम जरूरी है' },
  companyNameUpdated: { en: 'Company name updated', hi: 'कंपनी का नाम अपडेट हो गया', hinglish: 'Company ka naam update ho gaya', gu: 'કંપનીનું નામ અપડેટ થયું', mr: 'कंपनीचे नाव अपडेट झाले', mwr: 'कंपनी रो नाम अपडेट हो ग्यो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  save: { en: 'Save', hi: 'सेव करें', hinglish: 'Save karein', gu: 'સેવ કરો', mr: 'सेव करा', mwr: 'सेव करो' },

  modules: { en: 'Modules', hi: 'मॉड्यूल', hinglish: 'Modules', gu: 'મોડ્યૂલ', mr: 'मॉड्यूल', mwr: 'मॉड्यूल' },
  modulesHint: { en: 'Turn parts of the CRM on or off. Disabled modules are hidden from the sidebar.', hi: 'CRM के हिस्सों को चालू या बंद करें। बंद मॉड्यूल साइडबार से छिप जाते हैं।', hinglish: 'CRM ke parts ko on ya off karein. Disabled modules sidebar se hide ho jate hain.', gu: 'CRM ના ભાગો ચાલુ કે બંધ કરો. બંધ મોડ્યૂલ સાઇડબારથી છુપાય છે.', mr: 'CRM चे भाग चालू किंवा बंद करा. बंद मॉड्यूल साइडबारमधून लपवले जातात.', mwr: 'CRM रा हिस्सा चालू या बंद करो। बंद मॉड्यूल साइडबार सूं छिप जावै है।' },
  modulesUpdated: { en: 'Modules updated', hi: 'मॉड्यूल अपडेट हो गए', hinglish: 'Modules update ho gaye', gu: 'મોડ્યૂલ અપડેટ થયા', mr: 'मॉड्यूल अपडेट झाले', mwr: 'मॉड्यूल अपडेट हो ग्या' },
  saveModules: { en: 'Save modules', hi: 'मॉड्यूल सेव करें', hinglish: 'Modules save karein', gu: 'મોડ્યૂલ સેવ કરો', mr: 'मॉड्यूल सेव करा', mwr: 'मॉड्यूल सेव करो' },
};

export default function BillingPage() {
  const { tenant, hasRole, refreshTenant, setTenant } = useAuth();
  const tt = useT(S);
  const t = tenant || {};
  const MODULE_LABELS = {
    designers: tt('modDesigners'),
    machines: tt('modMachines'),
    qcDispatch: tt('modQcDispatch'),
    hr: tt('modHr'),
    bulk: tt('modBulk'),
  };
  const canManage = hasRole('owner', 'admin', 'superadmin');
  const [name, setName] = useState(t.name || '');
  const [busy, setBusy] = useState(false);
  const [modules, setModules] = useState(() => ({ ...(t.settings && t.settings.modules) }));
  const [modBusy, setModBusy] = useState(false);

  const saveModules = async () => {
    setModBusy(true);
    try {
      const res = await tenantApi.update({ settings: { ...(t.settings || {}), modules } });
      setTenant({ ...t, ...res.tenant });
      refreshTenant();
      showToast(tt('modulesUpdated'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || tt('failed'), 'error');
    } finally { setModBusy(false); }
  };

  const onTrial = t.plan === 'trial';
  const expired = t.expired;
  const statusBadge = expired ? 'badge-red' : t.status === 'suspended' ? 'badge-red'
    : onTrial ? 'badge-amber' : 'badge-green';
  const statusText = expired ? tt('trialEnded') : t.status === 'suspended' ? tt('suspended')
    : onTrial ? `${tt('trialPrefix')} · ${t.trialDaysLeft ?? '—'} ${tt('daysLeft')}` : (t.plan || tt('active'));

  const saveName = async () => {
    if (!name.trim()) return showToast(tt('companyNameRequired'), 'error');
    setBusy(true);
    try {
      const res = await tenantApi.update({ name: name.trim() });
      setTenant({ ...t, ...res.tenant });
      showToast(tt('companyNameUpdated'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || tt('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div data-legacy-id="page-billing">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{tt('billingPlan')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{tt('subAndCompany')}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{tt('plan')}</div>
          <div style={{ fontSize: 22, fontWeight: 700, textTransform: 'capitalize' }}>{t.plan || '—'}</div>
          <div style={{ marginTop: 8 }}><span className={`badge ${statusBadge}`}>{statusText}</span></div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{tt('company')}</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{t.name || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{tt('tenantId')} {t.id || '—'}</div>
        </div>
      </div>

      {(onTrial || expired) && (
        <div className="card" style={{ marginTop: 16, background: expired ? 'var(--red-light)' : 'var(--amber-light)', borderColor: expired ? 'var(--red)' : 'var(--amber)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: expired ? 'var(--red)' : 'var(--amber)' }}>
            {expired ? tt('trialEndedBanner') : `${tt('trialDaysBannerPrefix')} ${t.trialDaysLeft ?? 0} ${tt('trialDaysBannerSuffix')}`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
            {expired
              ? tt('upgradeExpiredHint')
              : tt('upgradeTrialHint')}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => showToast(tt('upgradeToast'), 'success')}>
            {tt('upgradePlan')}
          </button>
        </div>
      )}

      {canManage && (
        <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            {tt('companySettings')}
          </div>
          <div className="form-group">
            <label>{tt('companyName')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveName} disabled={busy}>
            {busy ? tt('saving') : tt('save')}
          </button>
        </div>
      )}

      {canManage && (
        <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            {tt('modules')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
            {tt('modulesHint')}
          </div>
          {Object.keys(MODULE_LABELS).map((key) => (
            <label key={key} className="flex items-center gap-2" style={{ padding: '6px 0', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={modules[key] !== false}
                onChange={(e) => setModules((m) => ({ ...m, [key]: e.target.checked }))}
              />
              <span style={{ fontSize: 13 }}>{MODULE_LABELS[key]}</span>
            </label>
          ))}
          <button className="btn btn-primary btn-sm mt-2" onClick={saveModules} disabled={modBusy}>
            {modBusy ? tt('saving') : tt('saveModules')}
          </button>
        </div>
      )}
    </div>
  );
}
