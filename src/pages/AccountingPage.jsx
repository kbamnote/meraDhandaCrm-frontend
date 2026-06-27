/**
 * Billing & Accounting — GST/proforma invoices, payments, party ledger, P&L and
 * GST report. Invoices are live (mpw/invoices); ledger/P&L/GST are computed
 * server-side (accountingApi) and fetched per tab.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { accountingApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => '₹' + (round2(n)).toLocaleString('en-IN');

const S = {
  title:    { en: '💰 Accounting', hi: '💰 अकाउंटिंग', hinglish: '💰 Accounting', gu: '💰 એકાઉન્ટિંગ', mr: '💰 अकाउंटिंग', mwr: '💰 अकाउंटिंग' },
  invoices: { en: 'Invoices', hi: 'इनवॉइस', hinglish: 'Invoices', gu: 'ઇન્વોઇસ', mr: 'इनव्हॉइस', mwr: 'इनवॉइस' },
  ledger:   { en: 'Ledger', hi: 'लेजर', hinglish: 'Ledger', gu: 'લેજર', mr: 'लेजर', mwr: 'लेजर' },
  pnl:      { en: 'P&L', hi: 'P&L', hinglish: 'P&L', gu: 'P&L', mr: 'P&L', mwr: 'P&L' },
  gst:      { en: 'GST', hi: 'GST', hinglish: 'GST', gu: 'GST', mr: 'GST', mwr: 'GST' },
  newInv:   { en: '+ New invoice', hi: '+ नया इनवॉइस', hinglish: '+ Naya invoice', gu: '+ નવો ઇન્વોઇસ', mr: '+ नवीन इनव्हॉइस', mwr: '+ नयो इनवॉइस' },
  none:     { en: 'No invoices yet.', hi: 'अभी कोई इनवॉइस नहीं।', hinglish: 'Abhi koi invoice nahi.', gu: 'હજુ કોઈ ઇન્વોઇસ નથી.', mr: 'अद्याप इनव्हॉइस नाही.', mwr: 'अजे कोई इनवॉइस कोनी।' },
  pay:      { en: 'Record payment', hi: 'पेमेंट दर्ज करें', hinglish: 'Payment record karein', gu: 'પેમેન્ટ નોંધો', mr: 'पेमेंट नोंदवा', mwr: 'पेमेंट दर्ज करो' },
  paid:     { en: 'Paid', hi: 'पेड', hinglish: 'Paid', gu: 'ચૂકવેલ', mr: 'भरले', mwr: 'पेड' },
  partial:  { en: 'Partial', hi: 'आंशिक', hinglish: 'Partial', gu: 'આંશિક', mr: 'अंशतः', mwr: 'आंशिक' },
  unpaid:   { en: 'Unpaid', hi: 'बकाया', hinglish: 'Unpaid', gu: 'બાકી', mr: 'थकीत', mwr: 'बकाया' },
  income:   { en: 'Income', hi: 'आय', hinglish: 'Income', gu: 'આવક', mr: 'उत्पन्न', mwr: 'आय' },
  expenses: { en: 'Expenses', hi: 'खर्च', hinglish: 'Expenses', gu: 'ખર્ચ', mr: 'खर्च', mwr: 'खर्च' },
  purchases:{ en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases', gu: 'ખરીદી', mr: 'खरेदी', mwr: 'खरीद' },
  profit:   { en: 'Profit', hi: 'लाभ', hinglish: 'Profit', gu: 'નફો', mr: 'नफा', mwr: 'लाभ' },
  taxable:  { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable', gu: 'કરપાત્ર', mr: 'करपात्र', mwr: 'कर योग्य' },
  invoiced: { en: 'Invoiced', hi: 'इनवॉइस्ड', hinglish: 'Invoiced', gu: 'ઇન્વોઇસ્ડ', mr: 'इनव्हॉइस्ड', mwr: 'इनवॉइस्ड' },
  outstanding:{ en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding', gu: 'બાકી', mr: 'थकबाकी', mwr: 'बकाया' },
  from:     { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  refresh:  { en: 'Refresh', hi: 'रिफ्रेश', hinglish: 'Refresh', gu: 'રિફ્રેશ', mr: 'रिफ्रेश', mwr: 'रिफ्रेश' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const STATUS_TONE = { paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red' };

export default function AccountingPage() {
  const t = useT(S);
  const [tab, setTab] = useState('invoices');
  const [invoices, setInvoices] = useState({});
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { const u = onValue(ref(db, 'mpw/invoices'), (s) => setInvoices(s.val() || {})); return () => u(); }, []);
  const invList = useMemo(() => Object.entries(invoices).map(([id, v]) => ({ ...v, id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [invoices]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        {tab === 'invoices' && <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newInv')}</button>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['invoices', 'ledger', 'pnl', 'gst'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
            style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
            {t(k)}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <>
          {!invList.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
          {invList.map((inv) => <InvoiceRow key={inv.id} inv={inv} t={t} />)}
        </>
      )}
      {tab === 'ledger' && <LedgerTab t={t} />}
      {tab === 'pnl' && <PnlTab t={t} />}
      {tab === 'gst' && <GstTab t={t} />}

      {showNew && <NewInvoiceModal onClose={() => setShowNew(false)} t={t} />}
    </div>
  );
}

function InvoiceRow({ inv, t }) {
  const [paying, setPaying] = useState(false);
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
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{inv.invoiceNo}</span>
          {inv.type === 'proforma' && <span className="badge badge-blue" style={{ marginLeft: 6 }}>PROFORMA</span>}
          <span className={`badge ${STATUS_TONE[inv.status] || ''}`} style={{ marginLeft: 6 }}>{t(inv.status || 'unpaid')}</span>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{inv.clientName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{inv.date}{inv.jobNo ? ` · ${inv.jobNo}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{inr(inv.total)}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('taxable')} {inr(inv.subtotal)} + {inr(inv.taxTotal)} GST</div>
          {inv.type !== 'proforma' && inv.status !== 'paid' && (
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={pay} disabled={paying}>{t('pay')}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerTab({ t }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { accountingApi.ledger().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>;
  return rows.map((r, i) => (
    <div key={i} className="card" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
      <div><div style={{ fontWeight: 600 }}>{r.clientName}</div><div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('invoiced')} {inr(r.invoiced)} · {t('paid')} {inr(r.paid)}</div></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: r.outstanding > 0 ? 'var(--red)' : 'var(--text2)' }}>{inr(r.outstanding)}</div>
    </div>
  ));
}

function DateRange({ from, to, setFrom, setTo, onRun, t }) {
  return (
    <div className="flex gap-2 mb-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ margin: 0 }}><label>{t('from')}</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0 }}><label>{t('to')}</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <button className="btn btn-primary btn-sm" onClick={onRun}>{t('refresh')}</button>
    </div>
  );
}

function PnlTab({ t }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const run = () => accountingApi.pnl({ from: from || undefined, to: to || undefined }).then(setData).catch(() => {});
  useEffect(() => { run(); }, []);
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} t={t} />
      {data && (
        <div className="card">
          <Row label={t('income')} value={inr(data.income)} />
          <Row label={t('expenses')} value={'− ' + inr(data.expenses)} />
          <Row label={t('purchases')} value={'− ' + inr(data.purchases)} />
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
            <Row label={t('profit')} value={inr(data.profit)} bold color={data.profit >= 0 ? 'var(--green)' : 'var(--red)'} />
          </div>
        </div>
      )}
    </div>
  );
}

function GstTab({ t }) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const run = () => accountingApi.gstReport({ from: from || undefined, to: to || undefined }).then(setData).catch(() => {});
  useEffect(() => { run(); }, []);
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} onRun={run} t={t} />
      {data && (
        <>
          <div className="card" style={{ marginBottom: 10 }}>
            <Row label={t('taxable')} value={inr(data.summary.taxable)} />
            <Row label="CGST" value={inr(data.summary.cgst)} />
            <Row label="SGST" value={inr(data.summary.sgst)} />
            <Row label="IGST" value={inr(data.summary.igst)} />
            <Row label="Total" value={inr(data.summary.total)} bold />
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{data.summary.count} invoices</div>
          </div>
          {data.rows.map((r, i) => (
            <div key={i} className="card" style={{ marginBottom: 6, fontSize: 12 }}>
              <b style={{ fontFamily: 'monospace' }}>{r.invoiceNo}</b> · {r.clientName} {r.gstNo ? `(${r.gstNo})` : ''}
              <div style={{ color: 'var(--text2)' }}>{r.date} · {t('taxable')} {inr(r.taxable)} · GST {inr((r.cgst || 0) + (r.sgst || 0) + (r.igst || 0))} · {inr(r.total)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

const blankItem = () => ({ name: '', hsn: '', qty: '1', rate: '', taxRate: '18' });

function NewInvoiceModal({ onClose, t }) {
  const { profile } = useAuth();
  const [type, setType] = useState('invoice');
  const [form, setForm] = useState({ clientName: '', gstNo: '', jobNo: '', date: new Date().toISOString().slice(0, 10), interState: false });
  const [items, setItems] = useState([blankItem()]);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { accountingApi.invoiceNumber(type).then((r) => setPreview(r.invoiceNo)).catch(() => {}); }, [type]);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const totals = useMemo(() => {
    let st = 0; let tax = 0;
    items.forEach((it) => { const a = (Number(it.qty) || 0) * (Number(it.rate) || 0); st += a; tax += (a * (Number(it.taxRate) || 0)) / 100; });
    return { subtotal: round2(st), tax: round2(tax), total: round2(st + tax) };
  }, [items]);

  const submit = async () => {
    if (!form.clientName.trim()) return showToast('Client name required', 'error');
    if (!items.some((it) => it.name.trim() && Number(it.rate) > 0)) return showToast('Add at least one item', 'error');
    setBusy(true);
    try {
      const inv = await accountingApi.createInvoice({
        type, ...form,
        items: items.filter((it) => it.name.trim()).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty), rate: Number(it.rate), taxRate: Number(it.taxRate) })),
      });
      showToast(`${inv.invoiceNo} created`, 'success');
      onClose();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <h3>{t('newInv')} <span style={{ fontFamily: 'monospace', color: 'var(--blue, #C05621)', fontSize: 14 }}>{preview}</span></h3>
          <select className="input" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="invoice">GST Invoice</option>
            <option value="proforma">Proforma</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 2 }}><label>Client name *</label><input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>GST No</label><input className="input" value={form.gstNo} onChange={(e) => set('gstNo', e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}><label>Date</label><input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>Job no (optional)</label><input className="input" value={form.jobNo} onChange={(e) => set('jobNo', e.target.value)} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingBottom: 14, fontSize: 13 }}>
            <input type="checkbox" checked={form.interState} onChange={(e) => set('interState', e.target.checked)} /> Inter-state (IGST)
          </label>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', margin: '8px 0 4px' }}>Items</div>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
            <input className="input" style={{ flex: 3 }} placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 50 }} placeholder="Qty" type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
            <input className="input" style={{ flex: 1.5, minWidth: 60 }} placeholder="Rate" type="number" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 50 }} placeholder="GST%" type="number" value={it.taxRate} onChange={(e) => setItem(i, 'taxRate', e.target.value)} />
            <button className="btn btn-ghost btn-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => [...a, blankItem()])}>+ Add item</button>

        <div className="card" style={{ background: 'var(--surface2)', marginTop: 10 }}>
          <Row label={t('taxable')} value={inr(totals.subtotal)} />
          <Row label="GST" value={inr(totals.tax)} />
          <Row label="Total" value={inr(totals.total)} bold />
        </div>

        <div className="flex gap-2 mt-2" style={{ marginTop: 12 }}>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? '…' : t('newInv')}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
