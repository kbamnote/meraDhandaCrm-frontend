import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const S = {
  analytics: { en: 'Analytics', hi: 'एनालिटिक्स', hinglish: 'Analytics', gu: 'એનાલિટિક્સ', mr: 'अॅनालिटिक्स', mwr: 'एनालिटिक्स' },
  subtitle: { en: 'Business at a glance', hi: 'बिज़नेस एक नज़र में', hinglish: 'Business ek nazar mein', gu: 'બિઝનેસ એક નજરમાં', mr: 'व्यवसाय एका दृष्टीक्षेपात', mwr: 'बिज़नेस एक नज़र में' },
  leads: { en: 'Leads', hi: 'लीड्स', hinglish: 'Leads', gu: 'લીડ્સ', mr: 'लीड्स', mwr: 'लीड्स' },
  invoices: { en: 'Invoices', hi: 'इनवॉइस', hinglish: 'Invoices', gu: 'ઇન્વોઇસ', mr: 'इन्व्हॉइस', mwr: 'इनवॉइस' },
  jobs: { en: 'Jobs', hi: 'जॉब', hinglish: 'Jobs', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  products: { en: 'Products', hi: 'प्रोडक्ट्स', hinglish: 'Products', gu: 'પ્રોડક્ટ્સ', mr: 'प्रोडक्ट्स', mwr: 'प्रोडक्ट्स' },
  invoicedTotal: { en: 'Invoiced total', hi: 'कुल इनवॉइस राशि', hinglish: 'Invoiced total', gu: 'કુલ ઇન્વોઇસ રકમ', mr: 'एकूण इन्व्हॉइस रक्कम', mwr: 'कुल इनवॉइस रकम' },
  acrossOne: { en: 'across {n} invoice', hi: '{n} इनवॉइस में', hinglish: '{n} invoice mein', gu: '{n} ઇન્વોઇસમાં', mr: '{n} इन्व्हॉइसमध्ये', mwr: '{n} इनवॉइस में' },
  acrossMany: { en: 'across {n} invoices', hi: '{n} इनवॉइस में', hinglish: '{n} invoices mein', gu: '{n} ઇન્વોઇસમાં', mr: '{n} इन्व्हॉइसमध्ये', mwr: '{n} इनवॉइस में' },
  unpaidInvoices: { en: 'Unpaid invoices', hi: 'बकाया इनवॉइस', hinglish: 'Unpaid invoices', gu: 'બાકી ઇન્વોઇસ', mr: 'न भरलेली इन्व्हॉइस', mwr: 'बकाया इनवॉइस' },
  statusNotPaid: { en: 'status not “paid”', hi: 'स्टेटस “paid” नहीं', hinglish: 'status “paid” nahi', gu: 'સ્ટેટસ “paid” નથી', mr: 'स्टेटस “paid” नाही', mwr: 'स्टेटस “paid” कोनी' },
  leadsByStage: { en: 'Leads by stage', hi: 'स्टेज के अनुसार लीड्स', hinglish: 'Stage ke hisaab se Leads', gu: 'સ્ટેજ પ્રમાણે લીડ્સ', mr: 'टप्प्यानुसार लीड्स', mwr: 'स्टेज रे हिसाब सूं लीड्स' },
  noLeads: { en: 'No leads yet.', hi: 'अभी तक कोई लीड नहीं।', hinglish: 'Abhi tak koi lead nahi.', gu: 'હજુ સુધી કોઈ લીડ નથી.', mr: 'अद्याप कोणतीही लीड नाही.', mwr: 'अजे तांई कोई लीड कोनी।' },
  unspecified: { en: 'unspecified', hi: 'अनिर्दिष्ट', hinglish: 'unspecified', gu: 'અનિર્દિષ્ટ', mr: 'अनिर्दिष्ट', mwr: 'अनिर्दिष्ट' },
};

const UNSPECIFIED = '__unspecified__';

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [leads, setLeads] = useState({});
  const [invoices, setInvoices] = useState({});
  const [jobs, setJobs] = useState({});
  const [products, setProducts] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/leads'), (snap) => setLeads(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/invoices'), (snap) => setInvoices(snap.val() || {}));
    const u3 = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    const u4 = onValue(ref(db, 'mpw/products'), (snap) => setProducts(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const leadList = useMemo(() => Object.values(leads || {}), [leads]);
  const invoiceList = useMemo(() => Object.values(invoices || {}), [invoices]);

  const leadCount = leadList.length;
  const invoiceCount = invoiceList.length;
  const jobCount = Object.keys(jobs || {}).length;
  const productCount = Object.keys(products || {}).length;

  const stageGroups = useMemo(() => {
    const map = {};
    leadList.forEach((l) => {
      const stage = (l && l.stage) || UNSPECIFIED;
      map[stage] = (map[stage] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leadList]);

  const totalAmount = useMemo(
    () => invoiceList.reduce((sum, inv) => sum + (Number(inv && inv.amount) || 0), 0),
    [invoiceList]
  );

  const unpaidCount = useMemo(
    () => invoiceList.filter((inv) => inv && inv.status !== 'paid').length,
    [invoiceList]
  );

  const cards = [
    { label: t('leads'), icon: '📞', value: leadCount },
    { label: t('invoices'), icon: '🧾', value: invoiceCount },
    { label: t('jobs'), icon: '🛠', value: jobCount },
    { label: t('products'), icon: '🛍', value: productCount },
  ];

  return (
    <div data-legacy-id="page-analytics">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>📊 {t('analytics')}</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        {t('subtitle')}{profile?.name ? ` · ${profile.name}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginTop: 16 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('invoicedTotal')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
            ₹{(totalAmount || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            {(invoiceCount === 1 ? t('acrossOne') : t('acrossMany')).replace('{n}', invoiceCount)}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('unpaidInvoices')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2, color: unpaidCount ? 'var(--red)' : 'inherit' }}>
            {unpaidCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            {t('statusNotPaid')}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{t('leadsByStage')}</div>
        {!stageGroups.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('noLeads')}</div>
        ) : (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {stageGroups.map(([stage, count]) => (
              <span key={stage} className="badge badge-blue">
                {stage === UNSPECIFIED ? t('unspecified') : stage}: <b>{count}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
