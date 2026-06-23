/**
 * Onboarding wizard — dropdown questions that tailor which modules a company
 * sees. Fully translated. Stored values stay canonical (English/'Yes'/'No');
 * only the displayed labels are localized.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tenantApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { showToast } from '../components/common/toast';

const INDUSTRIES = [
  'Fabrication & Metalwork', 'Plastic & Moulding', 'Textile & Garments',
  'Engineering & Machining', 'Packaging', 'Food Processing',
  'Chemicals', 'Electronics', 'Other',
];
const TEAM_SIZES = ['1–10', '11–50', '51–200', '200+'];

const QUESTIONS = [
  { key: 'industry', kind: 'industry', options: INDUSTRIES, default: 'Fabrication & Metalwork' },
  { key: 'teamSize', kind: 'team', options: TEAM_SIZES, default: '1–10' },
  { key: 'designers', kind: 'yesno', default: 'No', module: true },
  { key: 'machines', kind: 'yesno', default: 'Yes', module: true },
  { key: 'qcDispatch', kind: 'yesno', default: 'Yes', module: true },
  { key: 'hr', kind: 'yesno', default: 'Yes', module: true },
  { key: 'bulk', kind: 'yesno', default: 'Yes', module: true },
];

const S = {
  title: { en: 'Set up your CRM', hi: 'अपना CRM सेट करें', hinglish: 'Apna CRM set karein', gu: 'તમારું CRM સેટ કરો', mr: 'तुमचे CRM सेट करा', mwr: 'थारो CRM सेट करो' },
  subtitle: { en: 'A few quick questions so we show you only what you need. You can change these any time in Settings.', hi: 'कुछ छोटे सवाल ताकि हम आपको सिर्फ़ ज़रूरी चीज़ें दिखाएं। आप इन्हें कभी भी Settings में बदल सकते हैं।', hinglish: 'Kuch chhote sawaal taki hum aapko sirf zaroori cheezein dikhayein. Inhe kabhi bhi Settings mein change kar sakte hain.', gu: 'થોડા ઝડપી પ્રશ્નો જેથી અમે તમને ફક્ત જરૂરી બતાવીએ. તમે આને કોઈપણ સમયે Settings માં બદલી શકો છો.', mr: 'काही झटपट प्रश्न जेणेकरून आम्ही तुम्हाला फक्त आवश्यक तेच दाखवू. हे तुम्ही कधीही Settings मध्ये बदलू शकता.', mwr: 'थोड़ा सवाल ताकि म्हे थाने सिर्फ़ जरूरी चीज़ां दिखावां। इन्ने कदी भी Settings में बदल सको।' },
  yes: { en: 'Yes', hi: 'हाँ', hinglish: 'Haan', gu: 'હા', mr: 'होय', mwr: 'हाँ' },
  no: { en: 'No', hi: 'नहीं', hinglish: 'Nahi', gu: 'ના', mr: 'नाही', mwr: 'कोनी' },
  finish: { en: 'Finish setup & open my CRM', hi: 'सेटअप पूरा करें और CRM खोलें', hinglish: 'Setup pura karein & CRM kholein', gu: 'સેટઅપ પૂર્ણ કરો અને CRM ખોલો', mr: 'सेटअप पूर्ण करा व CRM उघडा', mwr: 'सेटअप पूरो करो अर CRM खोलो' },
  saving: { en: 'Setting up…', hi: 'सेट हो रहा है…', hinglish: 'Set ho raha hai…', gu: 'સેટ થઈ રહ્યું છે…', mr: 'सेट होत आहे…', mwr: 'सेट हो रियो है…' },
  done: { en: 'All set! Your CRM is ready.', hi: 'हो गया! आपका CRM तैयार है।', hinglish: 'Ho gaya! Aapka CRM ready hai.', gu: 'થઈ ગયું! તમારું CRM તૈયાર છે.', mr: 'झाले! तुमचे CRM तयार आहे.', mwr: 'हो ग्यो! थारो CRM तैयार है.' },
  // question labels
  q_industry: { en: 'What do you manufacture?', hi: 'आप क्या बनाते हैं?', hinglish: 'Aap kya banate hain?', gu: 'તમે શું બનાવો છો?', mr: 'तुम्ही काय बनवता?', mwr: 'थे कांई बणावो?' },
  q_teamSize: { en: 'How big is your team?', hi: 'आपकी टीम कितनी बड़ी है?', hinglish: 'Aapki team kitni badi hai?', gu: 'તમારી ટીમ કેટલી મોટી છે?', mr: 'तुमची टीम किती मोठी आहे?', mwr: 'थारी टीम कितनी बड़ी है?' },
  q_designers: { en: 'Do you have an in-house design team?', hi: 'क्या आपके पास इन-हाउस डिज़ाइन टीम है?', hinglish: 'Kya aapke paas in-house design team hai?', gu: 'શું તમારી પાસે ઇન-હાઉસ ડિઝાઇન ટીમ છે?', mr: 'तुमच्याकडे इन-हाउस डिझाइन टीम आहे का?', mwr: 'थारे कने इन-हाउस डिज़ाइन टीम है कांई?' },
  q_machines: { en: 'Do you track machines & maintenance?', hi: 'क्या आप मशीन और मेंटेनेंस ट्रैक करते हैं?', hinglish: 'Kya aap machines & maintenance track karte hain?', gu: 'શું તમે મશીન અને જાળવણી ટ્રૅક કરો છો?', mr: 'तुम्ही मशीन व देखभाल ट्रॅक करता का?', mwr: 'थे मशीन अर मेंटेनेंस ट्रैक करो कांई?' },
  q_qcDispatch: { en: 'Do you do quality control & dispatch?', hi: 'क्या आप क्वालिटी कंट्रोल और डिस्पैच करते हैं?', hinglish: 'Kya aap quality control & dispatch karte hain?', gu: 'શું તમે ક્વોલિટી કંટ્રોલ અને ડિસ્પેચ કરો છો?', mr: 'तुम्ही क्वालिटी कंट्रोल व डिस्पॅच करता का?', mwr: 'थे क्वालिटी कंट्रोल अर डिस्पैच करो कांई?' },
  q_hr: { en: 'Do you manage HR (attendance, payroll)?', hi: 'क्या आप HR (अटेंडेंस, पेरोल) मैनेज करते हैं?', hinglish: 'Kya aap HR (attendance, payroll) manage karte hain?', gu: 'શું તમે HR (હાજરી, પગાર) મેનેજ કરો છો?', mr: 'तुम्ही HR (हजेरी, पगार) सांभाळता का?', mwr: 'थे HR (अटेंडेंस, पेरोल) मैनेज करो कांई?' },
  q_bulk: { en: 'Do you take bulk / B2B orders?', hi: 'क्या आप बल्क / B2B ऑर्डर लेते हैं?', hinglish: 'Kya aap bulk / B2B orders lete hain?', gu: 'શું તમે બલ્ક / B2B ઓર્ડર લો છો?', mr: 'तुम्ही बल्क / B2B ऑर्डर घेता का?', mwr: 'थे बल्क / B2B ऑर्डर लो कांई?' },
  // hints
  h_designers: { en: 'Shows Designers & Job Setter', hi: 'Designers और Job Setter दिखाता है', hinglish: 'Designers & Job Setter dikhata hai', gu: 'Designers અને Job Setter બતાવે', mr: 'Designers व Job Setter दाखवते', mwr: 'Designers अर Job Setter दिखावै' },
  h_machines: { en: 'Shows Machines & Machine History', hi: 'Machines और Machine History दिखाता है', hinglish: 'Machines & Machine History dikhata hai', gu: 'Machines અને Machine History બતાવે', mr: 'Machines व Machine History दाखवते', mwr: 'Machines अर Machine History दिखावै' },
  h_qcDispatch: { en: 'Shows QC & Dispatch', hi: 'QC और Dispatch दिखाता है', hinglish: 'QC & Dispatch dikhata hai', gu: 'QC અને Dispatch બતાવે', mr: 'QC व Dispatch दाखवते', mwr: 'QC अर Dispatch दिखावै' },
  h_hr: { en: 'Shows Attendance, Leaves, Payroll', hi: 'Attendance, Leaves, Payroll दिखाता है', hinglish: 'Attendance, Leaves, Payroll dikhata hai', gu: 'Attendance, Leaves, Payroll બતાવે', mr: 'Attendance, Leaves, Payroll दाखवते', mwr: 'Attendance, Leaves, Payroll दिखावै' },
  h_bulk: { en: 'Shows Bulk Orders, Enquiries, Samples', hi: 'Bulk Orders, Enquiries, Samples दिखाता है', hinglish: 'Bulk Orders, Enquiries, Samples dikhata hai', gu: 'Bulk Orders, Enquiries, Samples બતાવે', mr: 'Bulk Orders, Enquiries, Samples दाखवते', mwr: 'Bulk Orders, Enquiries, Samples दिखावै' },
  failed: { en: 'Could not save — try again', hi: 'सेव नहीं हुआ — फिर कोशिश करें', hinglish: 'Save nahi hua — phir try karein', gu: 'સેવ ન થયું — ફરી પ્રયાસ કરો', mr: 'सेव झाले नाही — पुन्हा प्रयत्न करा', mwr: 'सेव कोनी हुयो — फेर कोशिश करो' },
};

export default function OnboardingPage() {
  const { tenant, loading, refreshTenant } = useAuth();
  const t = useT(S);
  const nav = useNavigate();
  const [ans, setAns] = useState(() => {
    const init = {};
    QUESTIONS.forEach((q) => { init[q.key] = q.default; });
    return init;
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && tenant && (tenant.settings?.onboarded || tenant.plan === 'pro')) {
      nav('/admin', { replace: true });
    }
  }, [loading, tenant, nav]);

  const set = (k, v) => setAns((a) => ({ ...a, [k]: v }));
  const optionLabel = (o) => (o === 'Yes' ? t('yes') : o === 'No' ? t('no') : o);

  const finish = async () => {
    setBusy(true);
    try {
      const modules = {};
      QUESTIONS.filter((q) => q.module).forEach((q) => { modules[q.key] = ans[q.key] === 'Yes'; });
      const settings = {
        ...(tenant?.settings || {}),
        onboarded: true, industry: ans.industry, teamSize: ans.teamSize, modules,
      };
      await tenantApi.update({ settings });
      await refreshTenant();
      showToast(t('done'), 'success');
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)', padding: 16, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><LanguageSwitcher /></div>
      <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ marginBottom: 18 }}>
          <img src="/logo.png" alt="MeraDhanda" style={{ height: 38, marginBottom: 10, display: 'block' }} />
          <h2 style={{ marginTop: 6 }}>{t('title')}</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>{t('subtitle')}</p>
        </div>

        {QUESTIONS.map((q) => (
          <div className="form-group" key={q.key}>
            <label>{t('q_' + q.key)}</label>
            <select className="input" value={ans[q.key]} onChange={(e) => set(q.key, e.target.value)}>
              {q.options.map((o) => <option key={o} value={o}>{optionLabel(o)}</option>)}
            </select>
            {q.module && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('h_' + q.key)}</div>}
          </div>
        ))}

        <button className="btn btn-primary w-full mt-2" onClick={finish} disabled={busy}>
          {busy ? t('saving') : t('finish')}
        </button>
      </div>
    </div>
  );
}
