/**
 * CreateInvoiceFlow — reusable "create an invoice" experience shared by the
 * Accounting page (+ New invoice) and the Dispatch card (📝 Create Invoice).
 *
 * Flow: 3-card type picker (Proforma / GST Tax / Cash) → on pick, opens the
 * invoice form pre-set to that type. When a `job` is passed it prefills the
 * client, GST no, jobId/jobNo and a default line item from the job — so the
 * dispatcher creates the bill without re-typing. On the server, passing jobId
 * stamps job.billNumber = the new invoice number (live), which the Dispatch
 * read-only bill field then shows.
 *
 * Props:
 *   job?       — optional job to prefill from (clientName, gstNo, id, jobNo, work)
 *   onClose()  — close the whole flow (picker or form)
 *   onCreated(inv) — called with the created invoice before onClose()
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => '₹' + (round2(n)).toLocaleString('en-IN');

const S = {
  newInv:   { en: '+ New invoice', hi: '+ नया इनवॉइस', hinglish: '+ Naya invoice', gu: '+ નવો ઇન્વોઇસ', mr: '+ नवीन इनव्हॉइस', mwr: '+ नयो इनवॉइस' },
  taxable:  { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable', gu: 'કરપાત્ર', mr: 'करपात्र', mwr: 'कर योग्य' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  // Type-picker
  chooseType:  { en: 'Choose invoice type', hi: 'इनवॉइस प्रकार चुनें', hinglish: 'Invoice type chunein', gu: 'ઇન્વોઇસ પ્રકાર પસંદ કરો', mr: 'इनव्हॉइस प्रकार निवडा', mwr: 'इनवॉइस प्रकार चुणो' },
  proformaTitle: { en: 'Proforma Invoice', hi: 'प्रोफॉर्मा इनवॉइस', hinglish: 'Proforma Invoice', gu: 'પ્રોફોર્મા ઇન્વોઇસ', mr: 'प्रोफॉर्मा इनव्हॉइस', mwr: 'प्रोफॉर्मा इनवॉइस' },
  proformaDesc:  { en: 'Estimate / quotation — before final billing. No payment demand.', hi: 'अनुमान / कोटेशन — फाइनल बिलिंग से पहले। पेमेंट की मांग नहीं।', hinglish: 'Estimate / quotation — final billing se pehle. Payment demand nahi.', gu: 'અંદાજ / ક્વોટેશન — અંતિમ બિલિંગ પહેલાં. પેમેન્ટ માગણી નહીં.', mr: 'अंदाज / कोटेशन — अंतिम बिलिंगपूर्वी. पेमेंट मागणी नाही.', mwr: 'अंदाज / कोटेशन — फाइनल बिलिंग सूं पैली। पेमेंट री मांग कोनी।' },
  invoiceTitle:  { en: 'GST Tax Invoice', hi: 'GST टैक्स इनवॉइस', hinglish: 'GST Tax Invoice', gu: 'GST ટેક્સ ઇન્વોઇસ', mr: 'GST टॅक्स इनव्हॉइस', mwr: 'GST टैक्स इनवॉइस' },
  invoiceDesc:   { en: 'Legal GST invoice with tax breakup — B2B / registered customer (has GSTIN).', hi: 'टैक्स ब्रेकअप के साथ कानूनी GST इनवॉइस — B2B / रजिस्टर्ड ग्राहक (GSTIN है)।', hinglish: 'Tax breakup ke saath legal GST invoice — B2B / registered customer (GSTIN hai).', gu: 'ટેક્સ બ્રેકઅપ સાથે કાનૂની GST ઇન્વોઇસ — B2B / નોંધાયેલ ગ્રાહક (GSTIN છે).', mr: 'टॅक्स ब्रेकअपसह कायदेशीर GST इनव्हॉइस — B2B / नोंदणीकृत ग्राहक (GSTIN आहे).', mwr: 'टैक्स ब्रेकअप साथै कानूनी GST इनवॉइस — B2B / रजिस्टर्ड ग्राहक (GSTIN है)।' },
  cashTitle:     { en: 'Cash / Non-GST Bill', hi: 'कैश / नॉन-GST बिल', hinglish: 'Cash / Non-GST Bill', gu: 'કેશ / નોન-GST બિલ', mr: 'कॅश / नॉन-GST बिल', mwr: 'कैश / नॉन-GST बिल' },
  cashDesc:      { en: 'Regular retail bill, no GST — B2C / unregistered customer.', hi: 'सामान्य रिटेल बिल, GST नहीं — B2C / अनरजिस्टर्ड ग्राहक।', hinglish: 'Normal retail bill, GST nahi — B2C / unregistered customer.', gu: 'સામાન્ય રિટેલ બિલ, GST નહીં — B2C / અનનોંધાયેલ ગ્રાહક.', mr: 'सामान्य रिटेल बिल, GST नाही — B2C / नोंदणी नसलेला ग्राहक.', mwr: 'सामान्य रिटेल बिल, GST कोनी — B2C / अनरजिस्टर्ड ग्राहक।' },
  noGstNote:     { en: 'No GST — cash bill', hi: 'GST नहीं — कैश बिल', hinglish: 'No GST — cash bill', gu: 'GST નહીં — કેશ બિલ', mr: 'GST नाही — कॅश बिल', mwr: 'GST कोनी — कैश बिल' },
};

const TYPE_CARDS = [
  { type: 'proforma', icon: '📝', titleKey: 'proformaTitle', descKey: 'proformaDesc' },
  { type: 'invoice',  icon: '🧾', titleKey: 'invoiceTitle',  descKey: 'invoiceDesc' },
  { type: 'cash',     icon: '💵', titleKey: 'cashTitle',     descKey: 'cashDesc' },
];

const blankItem = () => ({ name: '', hsn: '', qty: '1', rate: '', taxRate: '18' });

export default function CreateInvoiceFlow({ job, onClose, onCreated }) {
  const t = useT(S);
  const [type, setType] = useState(null); // null = show picker; otherwise show form pre-set to type

  if (!type) {
    return <InvoiceTypePicker t={t} onCancel={onClose} onPick={setType} />;
  }
  return (
    <NewInvoiceModal
      t={t}
      initialType={type}
      job={job}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function InvoiceTypePicker({ onPick, onCancel, t }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h3>{t('chooseType')}</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TYPE_CARDS.map((c) => (
            <button
              key={c.type}
              className="card"
              onClick={() => onPick(c.type)}
              style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14 }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{c.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>{t(c.titleKey)}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text2)', marginTop: 3 }}>{t(c.descKey)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>{t('cancel')}</button>
        </div>
      </div>
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

function NewInvoiceModal({ onClose, onCreated, t, initialType = 'invoice', job }) {
  const [type, setType] = useState(initialType);
  const isCash = type === 'cash';
  const [form, setForm] = useState({
    clientName: job?.clientName || '',
    gstNo: job?.gstNo || '',
    jobNo: job?.jobNo || '',
    date: new Date().toISOString().slice(0, 10),
    interState: false,
  });
  const [items, setItems] = useState([
    job ? { name: job.work || '', hsn: '', qty: '1', rate: '', taxRate: '18' } : blankItem(),
  ]);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { accountingApi.invoiceNumber(type).then((r) => setPreview(r.invoiceNo)).catch(() => {}); }, [type]);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const totals = useMemo(() => {
    let st = 0; let tax = 0;
    items.forEach((it) => {
      const a = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      st += a;
      if (!isCash) tax += (a * (Number(it.taxRate) || 0)) / 100; // cash bill: no GST
    });
    return { subtotal: round2(st), tax: round2(tax), total: round2(st + tax) };
  }, [items, isCash]);

  const submit = async () => {
    if (!form.clientName.trim()) return showToast('Client name required', 'error');
    if (!items.some((it) => it.name.trim() && Number(it.rate) > 0)) return showToast('Add at least one item', 'error');
    setBusy(true);
    try {
      const inv = await accountingApi.createInvoice({
        type, ...form,
        jobId: job?.id, // server stamps job.billNumber when jobId is set
        interState: isCash ? false : form.interState, // cash bill is never inter-state (no GST)
        items: items.filter((it) => it.name.trim()).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty), rate: Number(it.rate), taxRate: isCash ? 0 : Number(it.taxRate) })),
      });
      showToast(`${inv.invoiceNo} created`, 'success');
      onCreated?.(inv);
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
            <option value="cash">Cash / Non-GST</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 2 }}><label>Client name *</label><input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>GST No</label><input className="input" value={form.gstNo} onChange={(e) => set('gstNo', e.target.value)} /></div>
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}><label>Date</label><input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>Job no (optional)</label><input className="input" value={form.jobNo} onChange={(e) => set('jobNo', e.target.value)} /></div>
          {isCash ? (
            <span className="badge badge-amber" style={{ alignSelf: 'flex-end', marginBottom: 14 }}>{t('noGstNote')}</span>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end', paddingBottom: 14, fontSize: 13 }}>
              <input type="checkbox" checked={form.interState} onChange={(e) => set('interState', e.target.checked)} /> Inter-state (IGST)
            </label>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', margin: '8px 0 4px' }}>Items</div>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
            <input className="input" style={{ flex: 3 }} placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 50 }} placeholder="Qty" type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
            <input className="input" style={{ flex: 1.5, minWidth: 60 }} placeholder="Rate" type="number" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
            {!isCash && <input className="input" style={{ flex: 1, minWidth: 50 }} placeholder="GST%" type="number" value={it.taxRate} onChange={(e) => setItem(i, 'taxRate', e.target.value)} />}
            <button className="btn btn-ghost btn-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</button>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => [...a, blankItem()])}>+ Add item</button>

        <div className="card" style={{ background: 'var(--surface2)', marginTop: 10 }}>
          <Row label={t('taxable')} value={inr(totals.subtotal)} />
          {!isCash && <Row label="GST" value={inr(totals.tax)} />}
          <Row label="Total" value={inr(isCash ? totals.subtotal : totals.total)} bold />
          {isCash && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('noGstNote')}</div>}
        </div>

        <div className="flex gap-2 mt-2" style={{ marginTop: 12 }}>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? '…' : t('newInv')}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
