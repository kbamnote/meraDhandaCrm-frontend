/**
 * Sales Invoices — the /accounting/sales page. The GST/proforma invoice list that
 * used to live on the legacy Accounting page, plus payments, credit notes, and void.
 * Invoices are live (mpw/invoices); every create/pay/void also posts to the
 * double-entry ledger server-side.
 */
import { useEffect, useMemo, useState } from 'react';
// The same period presets the Reports screens use, so 'This Financial
// Year' means one thing across the app.
import { PERIODS } from '../../components/common/ReportShell';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import CreateInvoiceFlow from '../../components/common/CreateInvoiceFlow';
import TransactionBulkUpload from '../../components/common/TransactionBulkUpload';
import CreditNoteModal from '../../components/common/CreditNoteModal';
import DebitNoteModal from '../../components/common/DebitNoteModal';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import { downloadExcel } from '../../components/common/reportExport';
import { salesInvoiceGrid, exportFileName } from '../../utils/invoiceExport';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Sales Invoices', hi: 'सेल्स इनवॉइस', hinglish: 'Sales Invoices' },
  newInv:   { en: '+ New invoice', hi: '+ नया इनवॉइस', hinglish: '+ Naya invoice' },
  all:      { en: 'All', hi: 'सभी', hinglish: 'All' },
  unpaid:   { en: 'Unpaid', hi: 'बकाया', hinglish: 'Unpaid' },
  partial:  { en: 'Partial', hi: 'आंशिक', hinglish: 'Partial' },
  paid:     { en: 'Paid', hi: 'पेड', hinglish: 'Paid' },
  proforma: { en: 'Proforma', hi: 'प्रोफॉर्मा', hinglish: 'Proforma' },
  void:     { en: 'Cancelled', hi: 'रद्द', hinglish: 'Cancelled' },
  none:     { en: 'No invoices yet.', hi: 'अभी कोई इनवॉइस नहीं।', hinglish: 'Abhi koi invoice nahi.' },
  pay:      { en: 'Record payment', hi: 'पेमेंट दर्ज करें', hinglish: 'Payment record karein' },
  outstanding: { en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding' },
  sales:    { en: 'Sales', hi: 'सेल्स', hinglish: 'Sales' },
  overdues: { en: 'Overdue', hi: 'अतिदेय', hinglish: 'Overdue' },
  taxable:  { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable' },
  voidInv:  { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel' },
  voidConfirm: {
    en: 'Cancel this invoice? It stays in the list with its number but its amount becomes ₹0, and its stock is returned.',
    hi: 'यह इनवॉइस रद्द करें? यह सूची में रहेगा पर राशि ₹0 हो जाएगी और स्टॉक वापस आ जाएगा।',
    hinglish: 'Invoice cancel karein? List mein rahega par amount ₹0 ho jayega aur stock wapas aa jayega.',
  },
  del:      { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  delConfirm: {
    en: 'Delete this invoice permanently? It will be removed from the list, the ledger and GST reports, and its stock returned. Use Cancel instead to keep it on record.',
    hi: 'यह इनवॉइस हमेशा के लिए हटाएँ? यह सूची, लेजर और GST रिपोर्ट से हट जाएगा।',
    hinglish: 'Invoice hamesha ke liye delete karein? List, ledger aur GST reports se hat jayega.',
  },
  payments: { en: 'Payments', hi: 'भुगतान', hinglish: 'Payments', gu: 'ચુકવણી', mr: 'पेमेंट', mwr: 'भुगतान' },
  undo:     { en: 'Undo', hi: 'वापस लें', hinglish: 'Undo', gu: 'પાછું', mr: 'मागे घ्या', mwr: 'वापस लो' },
  undoAsk:  {
    en: 'Undo this receipt? The money comes off this invoice and out of your books.',
    hi: 'यह रसीद वापस लें? राशि इनवॉइस और बही से हट जाएगी।',
    hinglish: 'Yeh receipt undo karein? Amount invoice aur books se hat jayega.',
    gu: 'આ રસીદ પાછી લો? રકમ ઇન્વોઇસ અને ચોપડામાંથી નીકળી જશે.',
    mr: 'ही पावती मागे घ्यायची? रक्कम इनव्हॉइस व खात्यातून जाईल.',
    mwr: 'यो रसीद वापस लो? रकम इनवॉइस अर बही सूं हट जासी।',
  },
  undone:   { en: 'Receipt undone', hi: 'रसीद वापस ली', hinglish: 'Receipt undo ho gayi', gu: 'રસીદ પાછી લીધી', mr: 'पावती मागे घेतली', mwr: 'रसीद वापस ली' },
  whyNoDel: {
    en: 'received — undo the payment to edit, cancel or delete this bill',
    hi: 'मिले — बिल बदलने/रद्द/हटाने के लिए भुगतान वापस लें',
    hinglish: 'mile — bill edit/cancel/delete karne ke liye payment undo karein',
    gu: 'મળ્યા — બિલ બદલવા કે રદ કરવા પેમેન્ટ પાછું લો',
    mr: 'मिळाले — बिल बदलण्यासाठी पेमेंट मागे घ्या',
    mwr: 'मिल्या — बिल बदलण खातर भुगतान वापस लो',
  },
  noPayments: { en: 'No receipts against this invoice.', hi: 'इस इनवॉइस पर कोई रसीद नहीं।', hinglish: 'Is invoice par koi receipt nahi.', gu: 'આ ઇન્વોઇસ પર કોઈ રસીદ નથી.', mr: 'या इनव्हॉइसवर पावती नाही.', mwr: 'इण इनवॉइस पर कोई रसीद कोनी।' },
  deleted:  { en: 'Invoice deleted', hi: 'इनवॉइस हटाया गया', hinglish: 'Invoice delete ho gaya' },
  cancelled: { en: 'Invoice cancelled', hi: 'इनवॉइस रद्द', hinglish: 'Invoice cancel ho gaya' },
  edit:     { en: 'Edit', hi: 'बदलें', hinglish: 'Edit' },
  view:     { en: 'View', hi: 'देखें', hinglish: 'View' },
  search:   { en: 'Search invoice no / client…', hi: 'खोजें…', hinglish: 'Search invoice…' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  creditNotes: { en: 'Credit Notes', hi: 'क्रेडिट नोट्स', hinglish: 'Credit Notes' },
  creditNote:  { en: 'Credit Note', hi: 'क्रेडिट नोट', hinglish: 'Credit Note' },
  debitNote:   { en: 'Debit Note', hi: 'डेबिट नोट', hinglish: 'Debit Note' },
  crnNone:  { en: 'No credit notes yet.', hi: 'अभी कोई क्रेडिट नोट नहीं।', hinglish: 'Abhi koi credit note nahi.' },
  against:  { en: 'Against', hi: 'विरुद्ध', hinglish: 'Against' },
};

const STATUS_TONE = { paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red', void: '' };

export default function SalesInvoicesPage() {
  const t = useT(S);
  const [invoices, setInvoices] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [pageView, setPageView] = useState('invoices'); // 'invoices' | 'creditNotes'
  const [creditNotes, setCreditNotes] = useState([]);
  const [crnLoading, setCrnLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Period, amount band and overdue-only. Separate from the status chips
  // above them: a chip answers 'which state', these answer 'which ones'.
  const [period, setPeriod] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  useEffect(() => { const u = onValue(ref(db, 'mpw/invoices'), (s) => setInvoices(s.val() || {})); return () => u(); }, []);

  // Load credit notes when switching to that tab
  useEffect(() => {
    if (pageView !== 'creditNotes') return;
    setCrnLoading(true);
    accountingApi.creditNotes()
      .then((list) => setCreditNotes(list || []))
      .catch(() => setCreditNotes([]))
      .finally(() => setCrnLoading(false));
  }, [pageView]);

  const invList = useMemo(() => Object.entries(invoices).map(([id, v]) => ({ ...v, id }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [invoices]);

  const today = new Date().toISOString().slice(0, 10);

  // The dates the chosen period covers. 'all' means no bounds at all, which
  // is the only sensible default for a list you came here to browse.
  const range = useMemo(() => {
    if (period === 'custom') return custom;
    if (period === 'all') return {};
    const p = PERIODS.find((x) => x.key === period);
    return p && p.range ? p.range() : {};
  }, [period, custom]);

  /**
   * Everything except the status chips.
   *
   * Kept apart so the four cards above can summarise the period you picked
   * while still breaking it down by status — clicking 'Paid' should not
   * collapse the Paid card to match itself.
   */
  const inScope = useMemo(() => invList.filter((i) => {
    const d = i.date || '';
    if (range.from && d < range.from) return false;
    if (range.to && d > range.to) return false;
    const total = Number(i.total) || 0;
    if (minAmt !== '' && total < Number(minAmt)) return false;
    if (maxAmt !== '' && total > Number(maxAmt)) return false;
    // Overdue means money still owed past its due date — a paid bill that
    // went past its date is not overdue, it is history.
    if (overdueOnly && !(i.status !== 'paid' && i.dueDate && i.dueDate < today)) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!String(i.invoiceNo || '').toLowerCase().includes(s)
        && !String(i.clientName || '').toLowerCase().includes(s)) return false;
    }
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [invList, range.from, range.to, minAmt, maxAmt, overdueOnly, q, today]);

  const filtered = useMemo(() => inScope.filter((i) => (
    filter === 'all' || i.type === filter || (i.status || 'unpaid') === filter
  )), [inScope, filter]);

  const anyFilter = period !== 'all' || minAmt !== '' || maxAmt !== '' || overdueOnly || !!q;
  const clearFilters = () => {
    setPeriod('all'); setCustom({ from: '', to: '' });
    setMinAmt(''); setMaxAmt(''); setOverdueOnly(false); setQ('');
  };

  // The cards follow the filters: picking October and still being shown the
  // year's total is the kind of number someone reads out in a meeting.
  const { sales, outstanding, overdues, paidCount } = useMemo(() => {
    let s = 0;
    let out = 0;
    let od = 0;
    let paid = 0;
    for (let idx = 0; idx < inScope.length; idx++) {
      const i = inScope[idx];
      if (i.type === 'proforma' || i.status === 'void') continue;
      s += (i.total || 0);
      out += ((i.total || 0) - (i.paidAmount || 0));
      if (i.status === 'paid') paid += 1;
      else if (i.dueDate && i.dueDate < today) od += 1;
    }
    return { sales: round2(s), outstanding: round2(out), overdues: od, paidCount: paid };
  }, [inScope, today]);

  const totalCredits = useMemo(() => round2(creditNotes.reduce((s, c) => s + (c.total || 0), 0)), [creditNotes]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex" style={{ gap: 6 }}>
          {/* Exports what the list below shows — the chip, period, amount and
              search filters all apply. */}
          {pageView === 'invoices' && (
            <button className="btn btn-ghost btn-sm" data-testid="export-excel" disabled={!filtered.length}
              title={`Download these ${filtered.length} invoices as an Excel file`}
              onClick={() => downloadExcel(exportFileName('sales-invoices'), salesInvoiceGrid(filtered))}>
              ⬇️ Export Excel
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport((v) => !v)}>⬆️ Import history</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{t('newInv')}</button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Import historical invoices</h3>
            <button className="btn btn-xs btn-ghost" onClick={() => setShowImport(false)}>✕</button>
          </div>
          <TransactionBulkUpload onImported={() => setShowImport(false)} />
        </div>
      )}

      {/* Sub-tabs: Invoices | Credit Notes */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {[
          { key: 'invoices', label: `📄 ${t('title')}` },
          { key: 'creditNotes', label: `↩️ ${t('creditNotes')}` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPageView(tab.key)}
            style={{
              padding: '8px 16px', cursor: 'pointer', border: 'none', background: 'none',
              fontWeight: pageView === tab.key ? 600 : 400, fontSize: 13,
              color: pageView === tab.key ? 'var(--blue)' : 'var(--text2)',
              borderBottom: pageView === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Invoices tab ─── */}
      {pageView === 'invoices' && (
        <>
          <KpiGrid>
            <Kpi label={t('sales')} value={inr(sales)} icon="📈" color="var(--green)" />
            <Kpi label={t('outstanding')} value={inr(outstanding)} icon="🤝" color="var(--amber)" />
            <Kpi label={t('overdues')} value={overdues} icon="⏰" color="var(--red)" />
            <Kpi label={t('paid')} value={paidCount} icon="✅" color="var(--text)" />
          </KpiGrid>

          <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', 'unpaid', 'partial', 'paid', 'proforma', 'void'].map((k) => (
              <button key={k} className="btn btn-xs" onClick={() => setFilter(k)}
                style={{ background: filter === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: filter === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
                {t(k)}
              </button>
            ))}
            <input className="input" style={{ marginLeft: 'auto', maxWidth: 240 }} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="card" style={{ padding: '10px 12px', marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" style={{ width: 'auto', minWidth: 160 }} value={period}
              data-testid="invoice-period" onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">📅 All Time</option>
              {PERIODS.filter((p) => p.key !== 'custom').map((p) => (
                <option key={p.key} value={p.key}>📅 {p.label}</option>
              ))}
              <option value="custom">📅 Custom…</option>
            </select>

            {period === 'custom' && (
              <>
                <input className="input" type="date" style={{ width: 150 }} value={custom.from}
                  data-testid="invoice-from" max={custom.to || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
                <span style={{ color: 'var(--text3)' }}>→</span>
                <input className="input" type="date" style={{ width: 150 }} value={custom.to}
                  data-testid="invoice-to" min={custom.from || undefined}
                  onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </>
            )}

            <input className="input" type="number" min="0" style={{ width: 120 }} placeholder="Min ₹"
              data-testid="invoice-min" value={minAmt} onChange={(e) => setMinAmt(e.target.value)} />
            <input className="input" type="number" min="0" style={{ width: 120 }} placeholder="Max ₹"
              data-testid="invoice-max" value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} />

            <button type="button" className="btn btn-xs" data-testid="invoice-overdue"
              onClick={() => setOverdueOnly((v) => !v)}
              style={{ background: overdueOnly ? 'var(--red, #DC2626)' : 'var(--surface2)', color: overdueOnly ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
              ⏰ Overdue only
            </button>

            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text3)' }}>
              {filtered.length === invList.length
                ? `${invList.length} invoices`
                : `${filtered.length} of ${invList.length}`}
            </span>
            {anyFilter && (
              <button type="button" className="btn btn-xs btn-ghost" data-testid="invoice-clear"
                onClick={clearFilters}>Clear</button>
            )}
          </div>

          {!filtered.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
          {filtered.map((inv) => <InvoiceRow key={inv.id} inv={inv} t={t} />)}
        </>
      )}

      {/* ─── Credit Notes tab ─── */}
      {pageView === 'creditNotes' && (
        <>
          <KpiGrid>
            <Kpi label={t('creditNotes')} value={creditNotes.length} icon="↩️" color="var(--blue)" />
            <Kpi label={t('outstanding')} value={inr(totalCredits)} icon="💸" color="var(--amber)" />
          </KpiGrid>

          {crnLoading && <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Loading…</div>}
          {!crnLoading && creditNotes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('crnNone')}</div>
          )}
          {!crnLoading && creditNotes.map((cn) => (
            <div key={cn.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--red)' }}>{cn.creditNo}</span>
                  <span className="badge badge-red" style={{ marginLeft: 6 }}>CREDIT</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{cn.clientName || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {cn.date}{cn.invoiceNo ? ` · ${t('against')} ${cn.invoiceNo}` : ''}
                  </div>
                  {cn.reason && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, fontStyle: 'italic' }}>"{cn.reason}"</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>−{inr(cn.total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Taxable {inr(cn.subtotal)} + {inr((cn.cgst || 0) + (cn.sgst || 0) + (cn.igst || 0))} GST</div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {showCreate && <CreateInvoiceFlow onClose={() => setShowCreate(false)} onCreated={() => {}} />}
    </div>
  );
}

export function InvoiceRow({ inv, t }) {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showCrn, setShowCrn] = useState(false);
  const [showDbn, setShowDbn] = useState(false);
  const [editing, setEditing] = useState(false);
  const due = round2((inv.total || 0) - (inv.paidAmount || 0));
  const cancelled = inv.status === 'void';
  const hasPayment = round2(inv.paidAmount || 0) > 0;

  const pay = async () => {
    const v = window.prompt(`${t('pay')} (${t('outstanding')}: ${inr(due)})`, String(due));
    if (v === null) return;
    const amount = Number(v);
    if (!amount || amount <= 0) return;
    setPaying(true);
    try { await accountingApi.recordPayment(inv.id, { amount }); showToast(t('paid'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setPaying(false); }
  };

  const doVoid = async () => {
    if (!window.confirm(t('voidConfirm'))) return;
    setVoiding(true);
    try { await accountingApi.voidInvoice(inv.id); showToast(t('cancelled'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setVoiding(false); }
  };

  const doDelete = async () => {
    if (!window.confirm(t('delConfirm'))) return;
    setDeleting(true);
    try { await accountingApi.deleteInvoice(inv.id); showToast(t('deleted'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); setDeleting(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 8, opacity: cancelled ? 0.75 : 1 }} data-testid="invoice-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, textDecoration: cancelled ? 'line-through' : 'none' }}>{inv.invoiceNo}</span>
          {inv.type === 'proforma' && <span className="badge badge-blue" style={{ marginLeft: 6 }}>{t('proforma')}</span>}
          <span className={`badge ${STATUS_TONE[inv.status] || ''}`} style={{ marginLeft: 6 }}>{t(inv.status || 'unpaid')}</span>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{inv.clientName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{inv.date}{inv.jobNo ? ` · ${inv.jobNo}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {/* A cancelled bill charges nothing: ₹0, with what it was for kept
              underneath so the list still explains itself. */}
          <div style={{ fontSize: 18, fontWeight: 700 }} data-testid="invoice-amount">{inr(cancelled ? 0 : inv.total)}</div>
          {cancelled
            ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>was <s>{inr(inv.total)}</s>{inv.voidedAt ? ` · cancelled ${inv.voidedAt}` : ''}</div>
            : <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('taxable')} {inr(inv.subtotal)} + {inr(inv.taxTotal)} GST</div>}
          <div className="flex" style={{ gap: 6, marginTop: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/invoice-view?id=${inv.id}`)}>{t('view')}</button>
            {/* Editable only while nothing has been received against it. Once a
                receipt exists the server refuses the edit — a payment is
                allocated to the old total — so the button is hidden rather than
                offered and then rejected. */}
            {inv.status !== 'void' && round2(inv.paidAmount || 0) === 0 && (
              <button className="btn btn-sm btn-ghost" onClick={() => setEditing(true)}>{t('edit')}</button>
            )}
            {inv.type !== 'proforma' && inv.status !== 'paid' && inv.status !== 'void' && (
              <button className="btn btn-sm btn-ghost" onClick={pay} disabled={paying}>{t('pay')}</button>
            )}
            {inv.type !== 'proforma' && inv.status !== 'void' && due > 0 && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--blue, #C05621)' }} onClick={() => setShowCrn(true)}>{t('creditNote')}</button>
            )}
            {inv.type !== 'proforma' && inv.status !== 'void' && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--amber)' }} onClick={() => setShowDbn(true)}>{t('debitNote')}</button>
            )}
            {/* A receipt is what blocks editing, cancelling and deleting, so
                the way to UNDO one has to be reachable from here — otherwise a
                wrongly-ticked "fully paid" leaves a bill nobody can correct. */}
            {hasPayment && (
              <button className="btn btn-sm btn-ghost" data-testid="payments-btn" onClick={() => setShowPayments(true)}>
                {t('payments')}
              </button>
            )}
            {/* Cancel and Delete both unwind the bill, which the server refuses
                once money has been received against it — hidden, not offered
                and then rejected. */}
            {!cancelled && !hasPayment && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--amber)' }} onClick={doVoid} disabled={voiding}>{t('voidInv')}</button>
            )}
            {!hasPayment && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={doDelete} disabled={deleting}>{t('del')}</button>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <CreateInvoiceFlow
          invoice={inv}
          onClose={() => setEditing(false)}
          onCreated={() => setEditing(false)}
        />
      )}
      {hasPayment && (
        <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 4 }} data-testid="why-no-delete">
          {inr(inv.paidAmount)} {t('whyNoDel')}
        </div>
      )}
      {showPayments && <PaymentsModal invoice={inv} t={t} onClose={() => setShowPayments(false)} />}
      {showCrn && <CreditNoteModal invoice={inv} onClose={() => setShowCrn(false)} />}
      {showDbn && <DebitNoteModal invoice={inv} onClose={() => setShowDbn(false)} />}
    </div>
  );
}

// The receipts against one invoice, with a way to undo one. This is the only
// route back from a payment recorded by mistake: until it is undone the bill
// cannot be edited, cancelled or deleted, which is exactly the state a stray
// "mark fully paid" leaves behind.
function PaymentsModal({ invoice, t, onClose }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => accountingApi.invoicePayments(invoice.id)
    .then((r) => setRows(Array.isArray(r) ? r : []))
    .catch((e) => { showToast(e.response?.data?.error || t('failed'), 'error'); setRows([]); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const undo = async (p) => {
    if (!window.confirm(t('undoAsk'))) return;
    setBusy(p.id);
    try {
      await accountingApi.undoPayment(p.id);
      showToast(t('undone'), 'success');
      load();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(null); }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 18 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700 }}>{t('payments')}</h3>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
          {invoice.invoiceNo} · {inr(invoice.paidAmount)} of {inr(invoice.total)}
        </div>

        {rows === null && <div style={{ color: 'var(--text3)', fontSize: 13 }}>…</div>}
        {rows && !rows.length && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('noPayments')}</div>}
        {(rows || []).map((p) => (
          <div key={p.id} data-testid="payment-row" className="flex items-center justify-between"
            style={{ gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{inr(p.amount)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{p.date}{p.mode ? ` · ${p.mode}` : ''}</div>
            </div>
            <button className="btn btn-sm btn-ghost" data-testid="undo-payment" style={{ color: 'var(--red)' }}
              disabled={busy === p.id} onClick={() => undo(p)}>
              {t('undo')}
            </button>
          </div>
        ))}

        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
