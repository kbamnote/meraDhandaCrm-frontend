/**
 * Reports — the directory.
 *
 * Every report this CRM can produce, grouped the way an accountant asks for
 * them rather than the way they were built. Favourites float to their own
 * column at the top, because in practice a shop runs the same four reports
 * every week and hunts for the fifth.
 *
 * Reports that exist on another screen are linked, not rebuilt. A tile that is
 * not wired yet says so and is not clickable — a dead link in a list of
 * financial reports costs more trust than an honest "coming soon".
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { isSectionHidden } from '../../config/access';
import { loadFavourites, toggleFavourite } from '../../components/common/ReportShell';

const S = {
  title:    { en: 'Reports', hi: 'रिपोर्ट', hinglish: 'Reports', gu: 'રિપોર્ટ', mr: 'अहवाल', mwr: 'रिपोर्ट' },
  filterBy: { en: 'Filter By', hi: 'फ़िल्टर', hinglish: 'Filter By', gu: 'ફિલ્ટર', mr: 'फिल्टर', mwr: 'फ़िल्टर' },
  find:     { en: 'Find a report', hi: 'रिपोर्ट खोजें', hinglish: 'Report dhundein', gu: 'રિપોર્ટ શોધો', mr: 'अहवाल शोधा', mwr: 'रिपोर्ट ढूंढो' },
  favourite:{ en: 'Favourite', hi: 'पसंदीदा', hinglish: 'Favourite', gu: 'મનપસંદ', mr: 'आवडते', mwr: 'पसंदीदा' },
  none:     { en: 'No report matches that.', hi: 'कोई रिपोर्ट नहीं मिली।', hinglish: 'Koi report nahi mili.', gu: 'કોઈ રિપોર્ટ મળી નથી.', mr: 'अहवाल सापडला नाही.', mwr: 'कोई रिपोर्ट कोनी मिली।' },
  soon:     { en: 'Not built yet', hi: 'अभी नहीं बनी', hinglish: 'Abhi nahi bani', gu: 'હજી નથી', mr: 'अजून नाही', mwr: 'अबै कोनी बणी' },
  seeLess:  { en: 'See less', hi: 'कम दिखाएं', hinglish: 'See less', gu: 'ઓછું', mr: 'कमी', mwr: 'कम दिखाओ' },
  seeAll:   { en: 'See all', hi: 'सब देखें', hinglish: 'See all', gu: 'બધું', mr: 'सर्व', mwr: 'सब देखो' },
};

// The chips across the top. `tags` on a report decide which chips reveal it.
const FILTERS = [
  { key: 'party', label: 'Party' },
  { key: 'category', label: 'Category' },
  { key: 'payment', label: 'Payment Collection' },
  { key: 'item', label: 'Item' },
  { key: 'invoice', label: 'Invoice Details' },
  { key: 'summary', label: 'Summary' },
];

// `to` null = the report is not built. Shown greyed rather than hidden, so the
// list is an honest picture of what exists.
const GROUPS = [
  {
    key: 'gst', icon: '🧾', title: 'GST',
    reports: [
      { key: 'gstr2', name: 'GSTR-2 (Purchase)', to: '/reports/gstr2', tags: ['invoice', 'summary'] },
      { key: 'gstr3b', name: 'GSTR-3b', to: '/reports/gstr3b', tags: ['summary'] },
      { key: 'gst-purchase-hsn', name: 'GST Purchase (With HSN)', to: '/reports/gst-purchase-hsn', tags: ['item', 'invoice'] },
      { key: 'gst-sales-hsn', name: 'GST Sales (With HSN)', to: '/reports/gst-sales-hsn', tags: ['item', 'invoice'] },
      { key: 'gstr1', name: 'GSTR-1 (Sales)', to: '/reports/gstr1', tags: ['invoice', 'summary'] },
      { key: 'hsn-summary', name: 'HSN Wise Sales Summary', to: '/reports/hsn-sales-summary', tags: ['item', 'summary'] },
      // The older GST screen, kept: it carries the net-liability view (output
      // tax less input credit) that none of the registers above show.
      { key: 'gst-liability', name: 'GST Liability & Input Credit', to: '/accounting/gst', tags: ['summary'] },
    ],
  },
  {
    key: 'transaction', icon: '📄', title: 'Transaction',
    reports: [
      { key: 'daybook', name: 'Daybook', to: '/accounting/daybook', tags: ['invoice'] },
      { key: 'cashbank', name: 'Cash and Bank Report (All Payments)', to: '/accounting/cash', tags: ['payment'] },
      { key: 'expense-category', name: 'Expense Category Report', to: '/expenses', tags: ['category'] },
      { key: 'expense-txn', name: 'Expense Transaction Report', to: '/expenses', tags: ['invoice'] },
      { key: 'purchase-summary', name: 'Purchase Summary', to: '/accounting/purchases', tags: ['summary'] },
      { key: 'bill-profit', name: 'Bill Wise Profit', to: '/accounting/profit', tags: ['invoice', 'summary'] },
    ],
  },
  {
    key: 'item', icon: '📦', title: 'Item',
    reports: [
      { key: 'item-sales-purchase', name: 'Item Sales and Purchase Summary', to: '/accounting/items', tags: ['item', 'summary'] },
      { key: 'low-stock', name: 'Low Stock Summary', to: '/stock', tags: ['item'] },
      { key: 'stock-summary', name: 'Stock Summary', to: '/stock', tags: ['item', 'summary'] },
      { key: 'stock-detail', name: 'Stock Detail Report', to: '/accounting/inventory', tags: ['item'] },
      { key: 'rate-list', name: 'Rate List', to: '/accounting/items', tags: ['item'] },
      { key: 'item-by-party', name: 'Item Report By Party', to: null, tags: ['item', 'party'] },
    ],
  },
  {
    key: 'party', icon: '🤝', title: 'Party',
    reports: [
      { key: 'party-ledger', name: 'Party Statement (Ledger)', to: '/accounting/parties', tags: ['party'] },
      { key: 'party-outstanding', name: 'Party Wise Outstanding', to: '/accounting/parties', tags: ['party', 'payment'] },
      { key: 'receivable-ageing', name: 'Receivable Ageing Report', to: '/accounting/parties', tags: ['party', 'payment'] },
      { key: 'party-by-item', name: 'Party Report By Item', to: null, tags: ['party', 'item'] },
      { key: 'sales-by-category', name: 'Sales Summary - Category Wise', to: null, tags: ['category', 'summary'] },
    ],
  },
  {
    key: 'accounts', icon: '📊', title: 'Accounts',
    reports: [
      // The six ledger reports. Each opens its own tab rather than all four
      // landing on the same screen's default — the tile's name is a promise
      // about what you will be looking at.
      { key: 'pnl', name: 'Profit And Loss Report', to: '/accounting/reports?tab=pnl', tags: ['summary'] },
      { key: 'balance-sheet', name: 'Balance Sheet', to: '/accounting/reports?tab=balanceSheet', tags: ['summary'] },
      { key: 'trial-balance', name: 'Trial Balance', to: '/accounting/reports?tab=trialBalance', tags: ['summary'] },
      { key: 'cash-flow', name: 'Cash Flow', to: '/accounting/reports?tab=cashFlow', tags: ['payment', 'summary'] },
      { key: 'journal', name: 'Journal / Ledger', to: '/accounting/reports?tab=ledger', tags: ['summary'] },
      { key: 'outstanding', name: 'Outstanding (Receivable & Payable)', to: '/accounting/reports?tab=outstanding', tags: ['party', 'payment'] },
      { key: 'audit-trail', name: 'Audit Trail', to: '/audit-log', tags: [] },
      { key: 'job-profit', name: 'Job Profit', to: '/accounting/job-profit', tags: ['summary'] },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.reports.map((r) => ({ ...r, group: g.key })));
// Six is roughly a screenful; beyond that the page becomes a wall.
const COLLAPSED = 6;

export default function ReportsHubPage() {
  const t = useT(S);
  const { profile } = useAuth();
  const [favs, setFavs] = useState(loadFavourites);
  const [filters, setFilters] = useState([]);   // chip keys, empty = everything
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (r) => {
      // A report the reader cannot open is left out entirely rather than shown
      // greyed: "not built yet" and "not yours" are different answers, and the
      // second one is nobody's business.
      //
      // Match on the PATH only. PERM_OF is keyed by route, so a tile carrying
      // a ?tab= deep link would find no entry, and a route with no entry counts
      // as ungated — which would have shown every ledger report to everybody.
      if (r.to && isSectionHidden(r.to.split('?')[0], profile)) return false;
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      // Chips are OR'd: picking Party and Item asks for either, which is how
      // people read a filter bar.
      if (filters.length && !filters.some((f) => (r.tags || []).includes(f))) return false;
      return true;
    };
  }, [q, filters, profile]);

  const favouriteReports = ALL.filter((r) => favs.has(r.key)).filter(matches);
  const toggleChip = (k) => setFilters((f) => (f.includes(k) ? f.filter((x) => x !== k) : [...f, k]));

  const star = (r) => (
    <button className="btn btn-ghost btn-xs" style={{ padding: 0, width: 22 }}
      title={favs.has(r.key) ? 'Remove from Favourites' : 'Add to Favourites'}
      data-testid="report-star"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFavs(new Set(toggleFavourite(r.key))); }}>
      <span style={{ color: favs.has(r.key) ? 'var(--amber)' : 'var(--text3)' }}>
        {favs.has(r.key) ? '★' : '☆'}
      </span>
    </button>
  );

  const Row = ({ r }) => (
    <div className="flex items-center justify-between"
      style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', gap: 8 }}>
      {r.to ? (
        <Link to={r.to} style={{ fontSize: 13.5, flex: 1 }} data-testid="report-link">{r.name}</Link>
      ) : (
        <span style={{ fontSize: 13.5, flex: 1, color: 'var(--text3)' }} title={t('soon')}>
          {r.name} <span style={{ fontSize: 10.5 }}>· {t('soon')}</span>
        </span>
      )}
      {r.to ? star(r) : null}
    </div>
  );

  const Panel = ({ icon, title, reports, groupKey }) => {
    const shown = expanded[groupKey] ? reports : reports.slice(0, COLLAPSED);
    if (!reports.length) return null;
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', background: 'var(--surface2)', fontWeight: 600, fontSize: 13 }}>
          {icon} {title}
        </div>
        {shown.map((r) => <Row key={r.key} r={r} />)}
        {reports.length > COLLAPSED && (
          <button className="btn btn-ghost btn-xs" style={{ margin: 8 }}
            onClick={() => setExpanded((e) => ({ ...e, [groupKey]: !e[groupKey] }))}>
            {expanded[groupKey] ? `${t('seeLess')} ▲` : `${t('seeAll')} (${reports.length}) ▼`}
          </button>
        )}
      </div>
    );
  };

  const visibleGroups = GROUPS
    .map((g) => ({ ...g, reports: g.reports.filter(matches) }))
    .filter((g) => g.reports.length);
  const nothing = !visibleGroups.length && !favouriteReports.length;

  return (
    <div data-legacy-id="page-reports-hub">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('title')}</h2>

      <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('filterBy')}</span>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" data-testid="report-filter"
            className={`btn btn-sm ${filters.includes(f.key) ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 999 }}
            onClick={() => toggleChip(f.key)}>{f.label}</button>
        ))}
        <input className="input" style={{ maxWidth: 220, marginLeft: 'auto' }}
          placeholder={`🔍 ${t('find')}`} value={q} data-testid="report-search"
          onChange={(e) => setQ(e.target.value)} />
      </div>

      {nothing ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14, alignItems: 'start' }}>
          {/* Favourites first and always expanded — they are the short list by
              definition, so collapsing them would defeat the point. */}
          {favouriteReports.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', background: 'var(--surface2)', fontWeight: 600, fontSize: 13 }}>
                ✨ {t('favourite')}
              </div>
              {favouriteReports.map((r) => <Row key={r.key} r={r} />)}
            </div>
          )}
          {visibleGroups.map((g) => (
            <Panel key={g.key} groupKey={g.key} icon={g.icon} title={g.title} reports={g.reports} />
          ))}
        </div>
      )}
    </div>
  );
}
