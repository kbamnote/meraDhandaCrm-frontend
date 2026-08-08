/**
 * Sales Invoices — the /accounting/sales page. The GST/proforma invoice list that
 * used to live on the legacy Accounting page, plus payments, credit notes, and void.
 * Invoices are live (mpw/invoices); every create/pay/void also posts to the
 * double-entry ledger server-side.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import CreateInvoiceFlow from '../../components/common/CreateInvoiceFlow';
import CreditNoteModal from '../../components/common/CreditNoteModal';
import DebitNoteModal from '../../components/common/DebitNoteModal';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Sales Invoices', hi: 'सेल्स इनवॉइस', hinglish: 'Sales Invoices' },
  newInv:   { en: '+ New invoice', hi: '+ नया इनवॉइस', hinglish: '+ Naya invoice' },
  all:      { en: 'All', hi: 'सभी', hinglish: 'All' },
  unpaid:   { en: 'Unpaid', hi: 'बकाया', hinglish: 'Unpaid' },
  partial:  { en: 'Partial', hi: 'आंशिक', hinglish: 'Partial' },
  paid:     { en: 'Paid', hi: 'पेड', hinglish: 'Paid' },
  proforma: { en: 'Proforma', hi: 'प्रोफॉर्मा', hinglish: 'Proforma' },
  void:     { en: 'Void', hi: 'रद्द', hinglish: 'Void' },
  none:     { en: 'No invoices yet.', hi: 'अभी कोई इनवॉइस नहीं।', hinglish: 'Abhi koi invoice nahi.' },
  pay:      { en: 'Record payment', hi: 'पेमेंट दर्ज करें', hinglish: 'Payment record karein' },
  outstanding: { en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding' },
  sales:    { en: 'Sales', hi: 'सेल्स', hinglish: 'Sales' },
  overdues: { en: 'Overdue', hi: 'अतिदेय', hinglish: 'Overdue' },
  taxable:  { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable' },
  voidInv:  { en: 'Void invoice', hi: 'इनवॉइस रद्द करें', hinglish: 'Invoice void karein' },
  voidConfirm: { en: 'Void this invoice? It will be kept for history and removed from the ledger.', hi: 'इनवॉइस रद्द करें?', hinglish: 'Invoice void karein?' },
  view:     { en: 'View', hi: 'देखें', hinglish: 'View' },
  search:   { en: 'Search invoice no / client…', hi: 'खोजें…', hinglish: 'Search invoice…' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  creditNotes: { en: 'Credit Notes', hi: 'क्रेडिट नोट्स', hinglish: 'Credit Notes' },
  creditNote:  { en: 'Credit Note', hi: 'क्रेडिट नोट', hinglish: 'Credit Note' },
  debitNote:   { en: 'Debit Note', hi: 'डेबिट नोट', hinglish: 'Debit Note' },
  crnNone:  { en: 'No credit notes yet.', hi: 'अभी कोई क्रेडिट नोट नहीं।', hinglish: 'Abhi koi credit note nahi.' },
  against:  { en: 'Against', hi: 'विरुद्ध', hinglish: 'Against' },
};

const STATUS_TONE = { paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red', void: 'badge-amber' };

export default function SalesInvoicesPage() {
  const t = useT(S);
  const [invoices, setInvoices] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [pageView, setPageView] = useState('invoices'); // 'invoices' | 'creditNotes'
  const [creditNotes, setCreditNotes] = useState([]);
  const [crnLoading, setCrnLoading] = useState(false);

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

  const filtered = useMemo(() => invList.filter((i) => {
    if (filter !== 'all' && i.type !== filter && (i.status || 'unpaid') !== filter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!String(i.invoiceNo || '').toLowerCase().includes(s) && !String(i.clientName || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [invList, filter, q]);

  const salesInvoices = invList.filter((i) => i.type !== 'proforma' && i.status !== 'void');
  const sales = round2(salesInvoices.reduce((s2, i) => s2 + (i.total || 0), 0));
  const outstanding = round2(salesInvoices.reduce((s2, i) => s2 + ((i.total || 0) - (i.paidAmount || 0)), 0));
  const totalCredits = round2(creditNotes.reduce((s, c) => s + (c.total || 0), 0));
  const today = new Date().toISOString().slice(0, 10);
  const overdues = salesInvoices.filter((i) => i.status !== 'paid' && i.dueDate && i.dueDate < today).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>{t('newInv')}</button>
      </div>

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
            <Kpi label={t('paid')} value={salesInvoices.filter((i) => i.status === 'paid').length} icon="✅" color="var(--text)" />
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

function InvoiceRow({ inv, t }) {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showCrn, setShowCrn] = useState(false);
  const [showDbn, setShowDbn] = useState(false);
  const due = round2((inv.total || 0) - (inv.paidAmount || 0));

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
    try { await accountingApi.voidInvoice(inv.id); showToast(t('void'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setVoiding(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{inv.invoiceNo}</span>
          {inv.type === 'proforma' && <span className="badge badge-blue" style={{ marginLeft: 6 }}>{t('proforma')}</span>}
          <span className={`badge ${STATUS_TONE[inv.status] || ''}`} style={{ marginLeft: 6 }}>{t(inv.status || 'unpaid')}</span>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{inv.clientName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{inv.date}{inv.jobNo ? ` · ${inv.jobNo}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{inr(inv.total)}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('taxable')} {inr(inv.subtotal)} + {inr(inv.taxTotal)} GST</div>
          <div className="flex" style={{ gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/invoice-view?id=${inv.id}`)}>{t('view')}</button>
            {inv.type !== 'proforma' && inv.status !== 'paid' && inv.status !== 'void' && (
              <button className="btn btn-sm btn-ghost" onClick={pay} disabled={paying}>{t('pay')}</button>
            )}
            {inv.type !== 'proforma' && inv.status !== 'void' && due > 0 && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--blue, #C05621)' }} onClick={() => setShowCrn(true)}>{t('creditNote')}</button>
            )}
            {inv.type !== 'proforma' && inv.status !== 'void' && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--amber)' }} onClick={() => setShowDbn(true)}>{t('debitNote')}</button>
            )}
            {inv.status !== 'void' && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={doVoid} disabled={voiding}>{t('voidInv')}</button>
            )}
          </div>
        </div>
      </div>
      {showCrn && <CreditNoteModal invoice={inv} onClose={() => setShowCrn(false)} />}
      {showDbn && <DebitNoteModal invoice={inv} onClose={() => setShowDbn(false)} />}
    </div>
  );
}
