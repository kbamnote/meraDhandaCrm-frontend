/**
 * Sales Admin dashboard — read-only.
 * Subscribes to mpw/sales + mpw/leads and shows summary cards (total sales ₹,
 * won/open/lost counts, leads by stage) plus a table of recent sales.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';

const S = {
  salesAdmin: { en: 'Sales Admin', hi: 'सेल्स एडमिन', hinglish: 'Sales Admin', gu: 'સેલ્સ એડમિન', mr: 'सेल्स अॅडमिन', mwr: 'सेल्स एडमिन' },
  saleOne: { en: 'sale', hi: 'सेल', hinglish: 'sale', gu: 'સેલ', mr: 'विक्री', mwr: 'सेल' },
  saleMany: { en: 'sales', hi: 'सेल', hinglish: 'sales', gu: 'સેલ', mr: 'विक्री', mwr: 'सेल' },
  leads: { en: 'leads', hi: 'लीड', hinglish: 'leads', gu: 'લીડ', mr: 'लीड', mwr: 'लीड' },
  totalSales: { en: 'Total Sales', hi: 'कुल सेल', hinglish: 'Total Sales', gu: 'કુલ સેલ', mr: 'एकूण विक्री', mwr: 'कुल सेल' },
  won: { en: 'Won', hi: 'जीती', hinglish: 'Won', gu: 'જીત્યું', mr: 'जिंकले', mwr: 'जीती' },
  open: { en: 'Open', hi: 'ओपन', hinglish: 'Open', gu: 'ઓપન', mr: 'सुरू', mwr: 'ओपन' },
  lost: { en: 'Lost', hi: 'हारी', hinglish: 'Lost', gu: 'ગુમાવ્યું', mr: 'गमावले', mwr: 'हारी' },
  leadsByStage: { en: 'Leads by stage', hi: 'स्टेज के अनुसार लीड', hinglish: 'Stage ke hisaab se leads', gu: 'સ્ટેજ પ્રમાણે લીડ', mr: 'टप्प्यानुसार लीड', mwr: 'स्टेज रे हिसाब सूं लीड' },
  noLeads: { en: 'No leads yet.', hi: 'अभी तक कोई लीड नहीं।', hinglish: 'Abhi tak koi lead nahi.', gu: 'હજુ સુધી કોઈ લીડ નથી.', mr: 'अद्याप कोणतीही लीड नाही.', mwr: 'अजे तांई कोई लीड कोनी।' },
  recentSales: { en: 'Recent sales', hi: 'हाल की सेल', hinglish: 'Recent sales', gu: 'તાજેતરની સેલ', mr: 'अलीकडील विक्री', mwr: 'हाल री सेल' },
  noSales: { en: 'No sales yet.', hi: 'अभी तक कोई सेल नहीं।', hinglish: 'Abhi tak koi sale nahi.', gu: 'હજુ સુધી કોઈ સેલ નથી.', mr: 'अद्याप कोणतीही विक्री नाही.', mwr: 'अजे तांई कोई सेल कोनी।' },
  client: { en: 'Client', hi: 'क्लाइंट', hinglish: 'Client', gu: 'ક્લાયન્ટ', mr: 'क्लायंट', mwr: 'क्लाइंट' },
  product: { en: 'Product', hi: 'प्रोडक्ट', hinglish: 'Product', gu: 'પ્રોડક્ટ', mr: 'प्रोडक्ट', mwr: 'प्रोडक्ट' },
  amount: { en: 'Amount', hi: 'राशि', hinglish: 'Amount', gu: 'રકમ', mr: 'रक्कम', mwr: 'रकम' },
  status: { en: 'Status', hi: 'स्टेटस', hinglish: 'Status', gu: 'સ્ટેટસ', mr: 'स्थिती', mwr: 'स्टेटस' },
};

function inr(n) {
  const num = Number(n) || 0;
  return '₹' + num.toLocaleString('en-IN');
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'won' || s === 'closed' || s === 'paid') return 'badge badge-green';
  if (s === 'lost' || s === 'cancelled' || s === 'canceled') return 'badge badge-red';
  if (s === 'open' || s === 'pending') return 'badge badge-amber';
  return 'badge badge-blue';
}

export default function SalesAdminPage() {
  const t = useT(S);
  const [sales, setSales] = useState({});
  const [leads, setLeads] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/sales'), (snap) => setSales(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/leads'), (snap) => setLeads(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const saleList = useMemo(
    () => Object.entries(sales).map(([id, s]) => ({ ...s, id })),
    [sales]
  );

  const leadList = useMemo(
    () => Object.entries(leads).map(([id, l]) => ({ ...l, id })),
    [leads]
  );

  const totalSales = useMemo(
    () => saleList.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [saleList]
  );

  const counts = useMemo(() => {
    const c = { won: 0, open: 0, lost: 0 };
    saleList.forEach((s) => {
      const st = String(s.status || '').toLowerCase();
      if (st === 'won' || st === 'closed' || st === 'paid') c.won += 1;
      else if (st === 'lost' || st === 'cancelled' || st === 'canceled') c.lost += 1;
      else c.open += 1;
    });
    return c;
  }, [saleList]);

  const leadsByStage = useMemo(() => {
    const map = {};
    leadList.forEach((l) => {
      const stage = l.stage || l.status || 'unknown';
      map[stage] = (map[stage] || 0) + 1;
    });
    return Object.entries(map).map(([stage, count]) => ({ stage, count }));
  }, [leadList]);

  const recent = useMemo(() => saleList.slice(-10).reverse(), [saleList]);

  const cards = [
    { label: t('totalSales'), value: inr(totalSales), icon: '💰' },
    { label: t('won'), value: counts.won, icon: '✅' },
    { label: t('open'), value: counts.open, icon: '⏳' },
    { label: t('lost'), value: counts.lost, icon: '❌' },
  ];

  return (
    <div data-legacy-id="page-sales-admin">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>📊 {t('salesAdmin')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {saleList.length} {saleList.length === 1 ? t('saleOne') : t('saleMany')} · {leadList.length} {t('leads')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{t('leadsByStage')}</div>
        {!leadsByStage.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('noLeads')}</div>
        ) : (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {leadsByStage.map((s) => (
              <span key={s.stage} className="badge badge-blue">
                {s.stage}: {s.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('recentSales')}</div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!recent.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noSales')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('client')}</th>
                <th>{t('product')}</th>
                <th>{t('amount')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.client || s.customer || '—'}</td>
                  <td>{s.product || s.item || '—'}</td>
                  <td>{inr(s.amount)}</td>
                  <td><span className={statusBadgeClass(s.status)}>{s.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
