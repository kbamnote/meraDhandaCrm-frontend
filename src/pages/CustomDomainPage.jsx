/**
 * CustomDomainPage — Super Admin. Lets a tenant claim a custom domain and verify
 * ownership via a DNS TXT record. On mount it loads the stored config
 * (domainApi.get). With none set, a form captures the domain and calls
 * domainApi.set, which returns the DNS instructions + a verify token. Those are
 * shown in a copyable block alongside a status badge (pending/verified), a Verify
 * button (domainApi.verify) and a Remove button (domainApi.remove).
 *
 * NOTE: this screen only verifies ownership + stores config. Routing live traffic
 * to the domain and issuing TLS still needs infra setup by the MeraDhanda team.
 */
import { useEffect, useState } from 'react';
import { domainApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:      { en: '🌐 Custom Domain', hi: '🌐 कस्टम डोमेन', hinglish: '🌐 Custom Domain', gu: '🌐 કસ્ટમ ડોમેન', mr: '🌐 कस्टम डोमेन', mwr: '🌐 कस्टम डोमेन' },
  subtitle:   { en: 'Use your own domain for your MeraDhanda workspace.', hi: 'अपने MeraDhanda वर्कस्पेस के लिए अपना डोमेन इस्तेमाल करें।', hinglish: 'Apne MeraDhanda workspace ke liye apna domain use karein.', gu: 'તમારા MeraDhanda વર્કસ્પેસ માટે તમારું પોતાનું ડોમેન વાપરો.', mr: 'तुमच्या MeraDhanda वर्कस्पेससाठी तुमचा स्वतःचा डोमेन वापरा.', mwr: 'आपणा MeraDhanda वर्कस्पेस खातर आपणो डोमेन काम मांय लो।' },
  domain:     { en: 'Domain', hi: 'डोमेन', hinglish: 'Domain', gu: 'ડોમેન', mr: 'डोमेन', mwr: 'डोमेन' },
  domainHint: { en: 'No https:// or path — just the domain, e.g. crm.yourbiz.com', hi: 'https:// या पाथ नहीं — सिर्फ़ डोमेन, जैसे crm.yourbiz.com', hinglish: 'https:// ya path nahi — sirf domain, jaise crm.yourbiz.com', gu: 'https:// કે path નહીં — ફક્ત ડોમેન, દા.ત. crm.yourbiz.com', mr: 'https:// किंवा path नको — फक्त डोमेन, उदा. crm.yourbiz.com', mwr: 'https:// या path कोनी — सिरफ डोमेन, जियां crm.yourbiz.com' },
  domainPh:   { en: 'crm.yourbusiness.com', hi: 'crm.yourbusiness.com', hinglish: 'crm.yourbusiness.com', gu: 'crm.yourbusiness.com', mr: 'crm.yourbusiness.com', mwr: 'crm.yourbusiness.com' },
  save:       { en: 'Save domain', hi: 'डोमेन सेव करें', hinglish: 'Domain save karein', gu: 'ડોમેન સેવ કરો', mr: 'डोमेन सेव करा', mwr: 'डोमेन सेव करो' },
  saving:     { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  saved:      { en: 'Domain saved', hi: 'डोमेन सेव हो गया', hinglish: 'Domain save ho gaya', gu: 'ડોમેન સેવ થયું', mr: 'डोमेन सेव झाले', mwr: 'डोमेन सेव हो ग्यो' },
  invalid:    { en: 'Enter a valid domain', hi: 'सही डोमेन डालें', hinglish: 'Sahi domain daalein', gu: 'માન્ય ડોમેન દાખલ કરો', mr: 'वैध डोमेन टाका', mwr: 'सही डोमेन घालो' },
  pending:    { en: 'Pending', hi: 'पेंडिंग', hinglish: 'Pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
  verified:   { en: 'Verified', hi: 'सत्यापित', hinglish: 'Verified', gu: 'ચકાસાયેલ', mr: 'सत्यापित', mwr: 'सत्यापित' },
  dnsTitle:   { en: 'Add this DNS record', hi: 'यह DNS रिकॉर्ड जोड़ें', hinglish: 'Yeh DNS record add karein', gu: 'આ DNS રેકોર્ડ ઉમેરો', mr: 'हा DNS रेकॉर्ड जोडा', mwr: 'यो DNS रिकॉर्ड जोड़ो' },
  dnsHint:    { en: 'At your domain registrar (GoDaddy, Cloudflare, etc.), add the TXT record below. DNS can take a few minutes to a few hours to propagate.', hi: 'अपने डोमेन रजिस्ट्रार (GoDaddy, Cloudflare आदि) पर नीचे दिया TXT रिकॉर्ड जोड़ें। DNS को प्रोपगेट होने में कुछ मिनट से घंटे लग सकते हैं।', hinglish: 'Apne domain registrar (GoDaddy, Cloudflare etc.) par neeche diya TXT record add karein. DNS ko propagate hone mein kuch minutes se ghante lag sakte hain.', gu: 'તમારા ડોમેન રજિસ્ટ્રાર (GoDaddy, Cloudflare વગેરે) પર નીચેનો TXT રેકોર્ડ ઉમેરો. DNS પ્રોપગેટ થવામાં થોડી મિનિટોથી કલાકો લાગી શકે.', mr: 'तुमच्या डोमेन रजिस्ट्रारवर (GoDaddy, Cloudflare इ.) खालील TXT रेकॉर्ड जोडा. DNS प्रोपगेट व्हायला काही मिनिटे ते तास लागू शकतात.', mwr: 'आपणा डोमेन रजिस्ट्रार (GoDaddy, Cloudflare आदि) पर नीचे रो TXT रिकॉर्ड जोड़ो। DNS नै फैलण मांय कीं मिनट सूं घंटा लाग सके।' },
  host:       { en: 'Host / Name', hi: 'होस्ट / नाम', hinglish: 'Host / Name', gu: 'હોસ્ટ / નામ', mr: 'होस्ट / नाव', mwr: 'होस्ट / नाम' },
  type:       { en: 'Type', hi: 'टाइप', hinglish: 'Type', gu: 'ટાઇપ', mr: 'टाइप', mwr: 'टाइप' },
  value:      { en: 'Value', hi: 'वैल्यू', hinglish: 'Value', gu: 'વેલ્યુ', mr: 'व्हॅल्यू', mwr: 'वैल्यू' },
  copy:       { en: 'Copy', hi: 'कॉपी', hinglish: 'Copy', gu: 'કૉપિ', mr: 'कॉपी', mwr: 'कॉपी' },
  copied:     { en: 'Copied', hi: 'कॉपी हो गया', hinglish: 'Copy ho gaya', gu: 'કૉપિ થયું', mr: 'कॉपी झाले', mwr: 'कॉपी हो ग्यो' },
  verify:     { en: 'Verify ownership', hi: 'ओनरशिप सत्यापित करें', hinglish: 'Ownership verify karein', gu: 'માલિકી ચકાસો', mr: 'मालकी सत्यापित करा', mwr: 'मालकी सत्यापित करो' },
  verifying:  { en: 'Verifying…', hi: 'सत्यापित हो रहा है…', hinglish: 'Verify ho raha hai…', gu: 'ચકાસાઈ રહ્યું છે…', mr: 'सत्यापित होत आहे…', mwr: 'सत्यापित हो रियो है…' },
  verifyOk:   { en: 'Domain ownership verified!', hi: 'डोमेन ओनरशिप सत्यापित हो गई!', hinglish: 'Domain ownership verify ho gayi!', gu: 'ડોમેન માલિકી ચકાસાઈ ગઈ!', mr: 'डोमेन मालकी सत्यापित झाली!', mwr: 'डोमेन मालकी सत्यापित हो गई!' },
  verifyFail: { en: 'TXT record not found yet. DNS can take time to propagate.', hi: 'TXT रिकॉर्ड अभी नहीं मिला। DNS को फैलने में समय लग सकता है।', hinglish: 'TXT record abhi nahi mila. DNS ko propagate hone mein time lag sakta hai.', gu: 'TXT રેકોર્ડ હજુ મળ્યો નથી. DNS પ્રોપગેટ થવામાં સમય લાગી શકે.', mr: 'TXT रेकॉर्ड अद्याप सापडला नाही. DNS प्रोपगेट व्हायला वेळ लागू शकतो.', mwr: 'TXT रिकॉर्ड अजे कोनी मिल्यो। DNS नै फैलण मांय टैम लाग सके।' },
  remove:     { en: 'Remove domain', hi: 'डोमेन हटाएं', hinglish: 'Domain hatayein', gu: 'ડોમેન દૂર કરો', mr: 'डोमेन काढा', mwr: 'डोमेन हटावो' },
  removing:   { en: 'Removing…', hi: 'हटाया जा रहा है…', hinglish: 'Remove ho raha hai…', gu: 'દૂર થઈ રહ્યું છે…', mr: 'काढले जात आहे…', mwr: 'हटायो जा रियो है…' },
  removed:    { en: 'Domain removed', hi: 'डोमेन हट गया', hinglish: 'Domain hat gaya', gu: 'ડોમેન દૂર થયું', mr: 'डोमेन काढले', mwr: 'डोमेन हट ग्यो' },
  confirmRemove: { en: 'Remove this custom domain configuration?', hi: 'यह कस्टम डोमेन कॉन्फ़िगरेशन हटाएं?', hinglish: 'Yeh custom domain configuration hata dein?', gu: 'આ કસ્ટમ ડોમેન કૉન્ફિગરેશન દૂર કરવું?', mr: 'हे कस्टम डोमेन कॉन्फिगरेशन काढायचे?', mwr: 'यो कस्टम डोमेन कॉन्फिगरेशन हटावां?' },
  infraTitle: { en: 'What this does — and what it doesn’t', hi: 'यह क्या करता है — और क्या नहीं', hinglish: 'Yeh kya karta hai — aur kya nahi', gu: 'આ શું કરે છે — અને શું નહીં', mr: 'हे काय करते — आणि काय नाही', mwr: 'यो कांई करै — अर कांई कोनी' },
  infraNote:  { en: 'This screen verifies that you own the domain and stores the configuration. Actually routing live traffic to your domain and issuing the TLS/SSL certificate needs infrastructure setup by the MeraDhanda team — they’ll reach out once ownership is verified.', hi: 'यह स्क्रीन सिर्फ़ यह सत्यापित करती है कि डोमेन आपका है और कॉन्फ़िगरेशन सेव करती है। डोमेन पर लाइव ट्रैफ़िक भेजना और TLS/SSL सर्टिफ़िकेट जारी करना MeraDhanda टीम के इन्फ्रा सेटअप से होगा — ओनरशिप सत्यापित होते ही वे संपर्क करेंगे।', hinglish: 'Yeh screen sirf verify karti hai ki domain aapka hai aur configuration save karti hai. Domain par live traffic bhejna aur TLS/SSL certificate issue karna MeraDhanda team ke infra setup se hoga — ownership verify hote hi wo contact karenge.', gu: 'આ સ્ક્રીન ફક્ત ચકાસે છે કે ડોમેન તમારું છે અને કૉન્ફિગરેશન સેવ કરે છે. ડોમેન પર લાઈવ ટ્રાફિક અને TLS/SSL સર્ટિફિકેટ માટે MeraDhanda ટીમના ઈન્ફ્રા સેટઅપની જરૂર છે — માલિકી ચકાસાયા પછી તેઓ સંપર્ક કરશે.', mr: 'ही स्क्रीन फक्त डोमेन तुमचा आहे हे सत्यापित करते व कॉन्फिगरेशन सेव करते. डोमेनवर लाइव्ह ट्रॅफिक व TLS/SSL प्रमाणपत्रासाठी MeraDhanda टीमचे इन्फ्रा सेटअप लागते — मालकी सत्यापित झाल्यावर ते संपर्क करतील.', mwr: 'यो स्क्रीन सिरफ सत्यापित करै कै डोमेन आपणो है अर कॉन्फिगरेशन सेव करै। डोमेन पर लाइव ट्रैफिक अर TLS/SSL सर्टिफिकेट खातर MeraDhanda टीम रो इन्फ्रा सेटअप जरूरी है — मालकी सत्यापित होतां ही वे संपर्क करसी।' },
  adminOnly:  { en: 'Only admins can manage the custom domain.', hi: 'सिर्फ़ एडमिन ही कस्टम डोमेन मैनेज कर सकते हैं।', hinglish: 'Sirf admin hi custom domain manage kar sakte hain.', gu: 'ફક્ત એડમિન જ કસ્ટમ ડોમેન મેનેજ કરી શકે છે.', mr: 'फक्त अॅडमिनच कस्टम डोमेन व्यवस्थापित करू शकतात.', mwr: 'सिरफ एडमिन ही कस्टम डोमेन मैनेज कर सके।' },
  failed:     { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

function Field({ label, value, t }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t('copied'), 'success');
    } catch {
      showToast(t('failed'), 'error');
    }
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div className="flex gap-2 items-center">
        <code style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: 13, wordBreak: 'break-all', color: 'var(--text)' }}>{value}</code>
        <button className="btn btn-ghost btn-xs" onClick={copy}>{t('copy')}</button>
      </div>
    </div>
  );
}

export default function CustomDomainPage() {
  const { hasRole } = useAuth();
  const t = useT(S);
  const canManage = hasRole('admin', 'superadmin', 'owner');

  const [config, setConfig] = useState(null);   // null = loading or none
  const [loaded, setLoaded] = useState(false);
  const [domain, setDomain] = useState('');
  const [dns, setDns] = useState(null);         // returned only right after .set()
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = () => {
    domainApi.get()
      .then((c) => { setConfig(c || null); setLoaded(true); })
      .catch(() => { setConfig(null); setLoaded(true); });
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e?.preventDefault();
    const d = domain.trim().toLowerCase();
    if (!DOMAIN_RE.test(d)) return showToast(t('invalid'), 'error');
    setSaving(true);
    try {
      const r = await domainApi.set({ domain: d });
      setConfig({ domain: r.domain, verifyToken: r.verifyToken, status: r.status || 'pending', createdAt: r.createdAt });
      setDns(r.dns || { host: '_meradhanda.' + r.domain, type: 'TXT', value: r.verifyToken });
      setDomain('');
      showToast(t('saved'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setSaving(false); }
  };

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await domainApi.verify();
      setConfig((c) => ({ ...c, ...r, status: r.status || 'verified' }));
      showToast(t('verifyOk'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('verifyFail'), 'error');
    } finally { setVerifying(false); }
  };

  const remove = async () => {
    if (!window.confirm(t('confirmRemove'))) return;
    setRemoving(true);
    try {
      await domainApi.remove();
      setConfig(null);
      setDns(null);
      showToast(t('removed'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setRemoving(false); }
  };

  // DNS instructions come from the .set() response, or are derived from the stored config.
  const dnsRecord = dns || (config ? { host: '_meradhanda.' + config.domain, type: 'TXT', value: config.verifyToken } : null);
  const verified = config?.status === 'verified';

  return (
    <div>
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{t('subtitle')}</div>
      </div>

      {!canManage && (
        <div className="card" style={{ color: 'var(--amber)', background: 'var(--surface2)', marginBottom: 16, fontSize: 13 }}>
          {t('adminOnly')}
        </div>
      )}

      {!loaded ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
      ) : !config ? (
        <form className="card" onSubmit={save} style={{ maxWidth: 520 }}>
          <div className="form-group">
            <label>{t('domain')}</label>
            <input
              className="input"
              placeholder={t('domainPh')}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={!canManage}
              autoFocus
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('domainHint')}</div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !canManage}>
            {saving ? t('saving') : t('save')}
          </button>
        </form>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }} data-tf-animated>
                {config.domain}{' '}
                <span className={`badge ${verified ? 'badge-green' : 'badge-amber'}`}>
                  {verified ? `✓ ${t('verified')}` : t('pending')}
                </span>
              </div>
              <div className="flex gap-2">
                {!verified && (
                  <button className="btn btn-primary btn-sm" onClick={verify} disabled={verifying || !canManage}>
                    {verifying ? t('verifying') : t('verify')}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={remove} disabled={removing || !canManage} style={{ color: 'var(--red)' }}>
                  {removing ? t('removing') : t('remove')}
                </button>
              </div>
            </div>

            {!verified && dnsRecord && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t('dnsTitle')}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{t('dnsHint')}</div>
                <Field label={t('host')} value={dnsRecord.host} t={t} />
                <Field label={t('type')} value={dnsRecord.type} t={t} />
                <Field label={t('value')} value={dnsRecord.value} t={t} />
              </div>
            )}
          </div>

          <div className="card" style={{ fontSize: 12, color: 'var(--text2)' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>ℹ️ {t('infraTitle')}</div>
            {t('infraNote')}
          </div>
        </>
      )}
    </div>
  );
}
