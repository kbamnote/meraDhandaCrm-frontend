/**
 * Global Search — /accounting/search. One box across clients, vendors,
 * invoices, jobs, stock/products and purchase orders. Results are grouped and
 * deep-link to the relevant section. Uses the tenant-scoped backend route so it
 * never ships the whole database to the browser.
 */
import { useEffect, useRef, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';

const S = {
  title:     { en: 'Search', hinglish: 'Search' },
  placeholder: { en: 'Search clients, invoices, jobs, products…', hinglish: 'Clients, invoices, jobs, products search karo…' },
  hint:      { en: 'Type at least 2 characters.', hinglish: '2 letters type karo.' },
  noResults: { en: 'No matches found.', hinglish: 'Kuch nahi mila.' },
  groups: {
    clients:        { en: 'Clients',        hinglish: 'Clients' },
    vendors:        { en: 'Vendors',        hinglish: 'Vendors' },
    invoices:       { en: 'Invoices',       hinglish: 'Invoices' },
    jobs:           { en: 'Jobs',           hinglish: 'Jobs' },
    products:       { en: 'Stock / Products', hinglish: 'Stock / Products' },
    purchaseOrders: { en: 'Purchase Orders', hinglish: 'Purchase Orders' },
  },
  viewAll:   { en: 'View all →', hinglish: 'View all →' },
  outstanding: { en: 'Outstanding', hinglish: 'Outstanding' },
  inStock:   { en: 'in stock', hinglish: 'in stock' },
};

// Which route each group type deep-links to.
const GROUP_ROUTE = {
  clients: '/accounting/parties',
  vendors: '/accounting/parties',
  invoices: '/accounting/sales',
  jobs: '/job-cards',
  products: '/stock',
  purchaseOrders: '/purchase-orders',
};

const fmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function InvoiceRow({ it }) {
  return (
    <span>
      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{it.invoiceNo}</span>
      {' · '}{it.clientName || '—'}
      {it.type && <span style={{ fontSize: 11, color: 'var(--text3)' }}> ({it.type})</span>}
      {' · '}₹{fmt(it.total)}
      {it.outstanding > 0 && (
        <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 6 }}>due ₹{fmt(it.outstanding)}</span>
      )}
    </span>
  );
}

export default function SearchPage() {
  const t = useT(S);
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search — fires ~350ms after typing stops.
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setGroups([]); setDone(false); return; }
    setLoading(true);
    const id = setTimeout(() => {
      accountingApi.search(s)
        .then((r) => { setGroups(r.groups || []); setDone(true); })
        .catch(() => { setGroups([]); setDone(true); })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  const subFor = (g) => {
    if (g.type === 'invoices') {
      const t = g.items.reduce((s, i) => s + (Number(i.total) || 0), 0);
      return `${t('outstanding')} ₹${fmt(t)}`;
    }
    if (g.type === 'products') {
      const s = g.items.reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
      return `${s} ${t('inStock')}`;
    }
    return `${g.items.length} results`;
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>🔍 {t('title')}</h2>

      <input
        ref={inputRef}
        type="text"
        placeholder={t('placeholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 520, padding: '11px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 15, marginBottom: 18, boxSizing: 'border-box', outline: 'none' }}
      />

      {loading && <div style={{ color: 'var(--text3)', fontSize: 13 }}>…</div>}
      {!loading && q.trim().length >= 2 && done && groups.length === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '16px 0' }}>{t('noResults')}</div>
      )}
      {q.trim().length < 2 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('hint')}</div>
      )}

      {groups.map((g) => (
        <div key={g.type} className="card" style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{t(`groups.${g.type}`)}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{subFor(g)}</span>
          </div>
          <div style={{ padding: '4px 0' }}>
            {g.items.map((it) => (
              <a key={it.id} href={GROUP_ROUTE[g.type]}
                style={{ display: 'block', padding: '8px 16px', fontSize: 13, color: 'var(--text)', textDecoration: 'none', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                {g.type === 'invoices' ? <InvoiceRow it={it} /> : (
                  <>
                    <span style={{ fontWeight: 600 }}>{it.name || it.invoiceNo || it.jobNo || it.poNo || it.clientName}</span>
                    {g.type === 'clients' && it.company && <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.company}</span>}
                    {g.type === 'jobs' && it.work && <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.work}</span>}
                    {g.type === 'products' && it.sku && <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.sku}</span>}
                    {g.type === 'purchaseOrders' && it.vendorName && <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.vendorName}</span>}
                    {it.phone && <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.phone}</span>}
                    {(g.type === 'jobs' || g.type === 'purchaseOrders') && it.total != null && (
                      <span style={{ color: 'var(--green)', fontSize: 12 }}> · ₹{fmt(it.total)}</span>
                    )}
                    {g.type === 'products' && it.stock != null && (
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}> · {it.stock} {t('inStock')}</span>
                    )}
                  </>
                )}
              </a>
            ))}
          </div>
          <a href={GROUP_ROUTE[g.type]} style={{ display: 'block', padding: '8px 16px', fontSize: 12, color: 'var(--blue)', textDecoration: 'none' }}>
            {t('viewAll')}
          </a>
        </div>
      ))}
    </div>
  );
}
