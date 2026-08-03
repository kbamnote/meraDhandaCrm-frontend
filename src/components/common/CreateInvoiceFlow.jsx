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
import { accountingApi, ordersApi, uploadApi } from '../../services/api';
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

// No per-item taxRate — GST is now a single invoice-level rate (GST Rate
// dropdown on the right), so a line is just what's being billed and how much.
const blankItem = () => ({ name: '', hsn: '', qty: '1', rate: '' });

const DOC_TYPES = [
  { value: 'proforma', label: 'Proforma Invoice' },
  { value: 'invoice', label: 'Tax Invoice' },
  { value: 'cash', label: 'Cash / Non-GST Bill' },
];
const GST_RATES = ['0', '5', '12', '18', '28'];
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

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

  // Bill To — search-and-select (same pattern as the Job Cards client picker),
  // with the selected/typed party editable underneath.
  const [clientQ, setClientQ] = useState('');
  const [clientMatches, setClientMatches] = useState([]);
  const [party, setParty] = useState({
    clientId: null, clientName: job?.clientName || '', clientPhone: '', clientAddress: '', gstNo: job?.gstNo || '',
  });
  const setP = (k, v) => setParty((p) => ({ ...p, [k]: v }));

  const [form, setForm] = useState({
    jobNo: job?.jobNo || '',
    date: new Date().toISOString().slice(0, 10),
    ewayBillNo: '', vehicleNo: '', poNumber: '', approvedBy: '',
    eventType: '', salesPerson: '', deliveryType: '',
    invoicePrefix: '', invoiceNumber: '',
    paymentTermDays: '', dueDate: '',
    placeOfSupply: 'auto',
    gstRate: '18',
    discount: '0',
    markFullyPaid: false,
    amountReceived: '0',
    paymentMode: 'Cash',
    notes: '', showNotes: false,
    terms: '', editingTerms: false,
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [items, setItems] = useState([
    job ? { name: job.work || '', hsn: '', qty: '1', rate: '' } : blankItem(),
  ]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [defaults, setDefaults] = useState(null); // GET /invoice-defaults result
  const [busy, setBusy] = useState(false);

  // Company defaults (bank, terms, prefix, next number, GSTIN/state) — reload
  // whenever the document type changes, since each type has its own
  // prefix/number sequence and its own default Terms text.
  useEffect(() => {
    accountingApi.invoiceDefaults(type).then((d) => {
      setDefaults(d);
      setForm((f) => ({ ...f, invoicePrefix: d.invoicePrefix, invoiceNumber: d.invoiceNumber, terms: f.terms || d.terms }));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Debounced party search — identical pattern to the Job Cards client picker.
  useEffect(() => {
    const q = clientQ.trim();
    if (q.length < 2) { setClientMatches([]); return undefined; }
    const id = setTimeout(() => {
      ordersApi.searchClients(q).then((r) => setClientMatches(Array.isArray(r) ? r : [])).catch(() => setClientMatches([]));
    }, 250);
    return () => clearTimeout(id);
  }, [clientQ]);

  const pickClient = (c) => {
    setParty({ clientId: c.id, clientName: c.name || '', clientPhone: c.phone || '', clientAddress: c.address || '', gstNo: c.gstNo || '' });
    setClientQ('');
  };

  // Payment Terms (days) drives Due Date automatically; editing Due Date
  // directly is still allowed and simply stops following the days field.
  const setPaymentDays = (v) => {
    setF('paymentTermDays', v);
    const days = Number(v);
    if (Number.isFinite(days) && days >= 0) {
      const d = new Date(form.date || Date.now());
      d.setDate(d.getDate() + days);
      setF('dueDate', d.toISOString().slice(0, 10));
    }
  };

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  // Client-side preview of Place of Supply — the server recomputes
  // authoritatively at save time from the same GSTIN, this is display-only.
  const stateMap = useMemo(() => Object.fromEntries((defaults?.states || []).map((s) => [s.code, s.name])), [defaults]);
  const buyerStatePreview = stateMap[String(party.gstNo || '').slice(0, 2)] || null;
  const posPreview = form.placeOfSupply === 'auto' ? (buyerStatePreview || defaults?.companyState || '—') : form.placeOfSupply;
  const interStatePreview = !isCash && !!defaults?.companyState && !!posPreview && posPreview !== '—' && posPreview !== defaults.companyState;

  const totals = useMemo(() => {
    let st = 0;
    items.forEach((it) => { st += (Number(it.qty) || 0) * (Number(it.rate) || 0); });
    const subtotal = round2(st);
    const rate = isCash ? 0 : (Number(form.gstRate) || 0);
    const taxTotal = round2((subtotal * rate) / 100);
    const cgst = interStatePreview ? 0 : round2(taxTotal / 2);
    const sgst = interStatePreview ? 0 : round2(taxTotal / 2);
    const igst = interStatePreview ? taxTotal : 0;
    const discount = round2(Number(form.discount) || 0);
    const total = round2(Math.max(0, subtotal + taxTotal - discount));
    const received = form.markFullyPaid ? total : round2(Number(form.amountReceived) || 0);
    const balance = round2(Math.max(0, total - Math.min(received, total)));
    return { subtotal, taxTotal, cgst, sgst, igst, discount, total, received, balance };
  }, [items, form.gstRate, form.discount, form.markFullyPaid, form.amountReceived, isCash, interStatePreview]);

  const addAttachment = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setUploading(true);
    try {
      const r = await uploadApi.upload(f);
      setAttachments((a) => [...a, r.url]);
    } catch (err) { showToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!party.clientName.trim()) return showToast('Bill To — client name required', 'error');
    if (!items.some((it) => it.name.trim() && Number(it.rate) > 0)) return showToast('Add at least one item', 'error');
    setBusy(true);
    try {
      const inv = await accountingApi.createInvoice({
        type,
        clientId: party.clientId, clientName: party.clientName.trim(),
        clientPhone: party.clientPhone.trim(), clientAddress: party.clientAddress.trim(),
        gstNo: party.gstNo.trim(),
        jobId: job?.id, jobNo: form.jobNo, // server stamps job.billNumber when jobId is set
        date: form.date,
        ewayBillNo: form.ewayBillNo, vehicleNo: form.vehicleNo, poNumber: form.poNumber, approvedBy: form.approvedBy,
        eventType: form.eventType, salesPerson: form.salesPerson, deliveryType: form.deliveryType,
        invoicePrefix: form.invoicePrefix, invoiceNumber: form.invoiceNumber,
        paymentTermDays: form.paymentTermDays, dueDate: form.dueDate,
        placeOfSupply: form.placeOfSupply,
        gstRate: isCash ? 0 : Number(form.gstRate) || 0,
        discount: totals.discount,
        markFullyPaid: form.markFullyPaid,
        amountReceived: form.markFullyPaid ? undefined : Number(form.amountReceived) || 0,
        paymentMode: form.paymentMode,
        notes: form.notes, terms: form.terms, attachments,
        items: items.filter((it) => it.name.trim()).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty), rate: Number(it.rate) })),
      });
      showToast(`${inv.invoiceNo} created`, 'success');
      onCreated?.(inv);
      onClose();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 980, width: '100%', maxHeight: '94vh', overflow: 'auto', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Create Sales Invoice</h3>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? '…' : 'Save'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {/* ── LEFT COLUMN ── */}
          <div style={{ flex: '1 1 560px', minWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Bill To</div>
            {party.clientName ? (
              <div className="card" style={{ background: 'var(--surface2)', marginBottom: 8, padding: 12 }}>
                <div className="flex items-center justify-between">
                  <b>{party.clientName}</b>
                  <button className="btn btn-ghost btn-xs" onClick={() => setParty({ clientId: null, clientName: '', clientPhone: '', clientAddress: '', gstNo: '' })}>Change</button>
                </div>
                {party.clientPhone && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>📞 {party.clientPhone}</div>}
                {party.clientAddress && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>📍 {party.clientAddress}</div>}
                {party.gstNo && <div style={{ fontSize: 12, color: 'var(--text3)' }}>GSTIN: {party.gstNo}</div>}
              </div>
            ) : null}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input className="input" placeholder="Search party by name or number" value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
              {clientMatches.length > 0 && (
                <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 180, overflow: 'auto' }}>
                  {clientMatches.map((c) => (
                    <div key={c.id} onClick={() => pickClient(c)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13 }}><b>{c.name || '—'}</b> <span style={{ color: 'var(--text3)' }}>{c.phone || ''}</span></div>
                      {c.address && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.address}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!party.clientName && (
              <div className="flex gap-2" style={{ marginBottom: 10 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Or type a new party name" value={party.clientName} onChange={(e) => setP('clientName', e.target.value)} />
                <input className="input" style={{ flex: 1 }} placeholder="Mobile" value={party.clientPhone} onChange={(e) => setP('clientPhone', e.target.value)} />
              </div>
            )}

            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>E-way Bill No.</label><input className="input" value={form.ewayBillNo} onChange={(e) => setF('ewayBillNo', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Vehicle No.</label><input className="input" value={form.vehicleNo} onChange={(e) => setF('vehicleNo', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>PO Number</label><input className="input" value={form.poNumber} onChange={(e) => setF('poNumber', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Approved By</label><input className="input" value={form.approvedBy} onChange={(e) => setF('approvedBy', e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Event Type</label><input className="input" value={form.eventType} onChange={(e) => setF('eventType', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Sales Person</label><input className="input" value={form.salesPerson} onChange={(e) => setF('salesPerson', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Delivery Type</label><input className="input" value={form.deliveryType} onChange={(e) => setF('deliveryType', e.target.value)} /></div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', margin: '10px 0 6px' }}>Items / Services</div>
            <div style={{ display: 'flex', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', padding: '0 2px 4px' }}>
              <span style={{ width: 22 }}>No</span>
              <span style={{ flex: 3 }}>Item / Service</span>
              <span style={{ flex: 1.2 }}>HSN/SAC</span>
              <span style={{ width: 55 }}>Qty</span>
              <span style={{ flex: 1.2 }}>Price (₹)</span>
              <span style={{ flex: 1.2, textAlign: 'right' }}>Amount</span>
              <span style={{ width: 18 }} />
            </div>
            {items.map((it, i) => {
              const amount = round2((Number(it.qty) || 0) * (Number(it.rate) || 0));
              return (
                <div key={i} className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ width: 22, fontSize: 12, color: 'var(--text3)' }}>{i + 1}</span>
                  <input className="input" style={{ flex: 3 }} placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                  <input className="input" style={{ flex: 1.2, minWidth: 60 }} placeholder="HSN/SAC" value={it.hsn} onChange={(e) => setItem(i, 'hsn', e.target.value)} />
                  <input className="input" style={{ width: 55 }} placeholder="Qty" type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                  <input className="input" style={{ flex: 1.2, minWidth: 70 }} placeholder="Price" type="number" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
                  <span style={{ flex: 1.2, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{inr(amount)}</span>
                  <button className="btn btn-ghost btn-xs" style={{ width: 18 }} onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</button>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => [...a, blankItem()])}>+ Add Item</button>

            <div className="flex items-center justify-between" style={{ margin: '14px 0 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>📎 Attachments / Images</div>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                {uploading ? 'Uploading…' : '+ Add Image'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={addAttachment} disabled={uploading} />
              </label>
            </div>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {attachments.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                    <button onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--red, #DC2626)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {!form.showNotes ? (
              <button className="btn btn-ghost btn-xs" onClick={() => setF('showNotes', true)} style={{ padding: '4px 0' }}>+ Add Notes</button>
            ) : (
              <div className="form-group">
                <label>Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Terms and Conditions</div>
            {form.editingTerms ? (
              <textarea className="input" rows={5} value={form.terms} onChange={(e) => setF('terms', e.target.value)} onBlur={() => setF('editingTerms', false)} autoFocus />
            ) : (
              <div className="card" style={{ background: 'var(--surface2)', fontSize: 12.5, color: 'var(--text2)', whiteSpace: 'pre-line', maxHeight: 110, overflow: 'auto' }}>
                {form.terms || '—'}
              </div>
            )}
            <button className="btn btn-ghost btn-xs" onClick={() => setF('editingTerms', true)} style={{ padding: '4px 0' }}>✏️ Edit Terms</button>

            {defaults?.bank?.accountNumber && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Bank Details</div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
                  Account Number: {defaults.bank.accountNumber}<br />
                  IFSC Code: {defaults.bank.ifsc}<br />
                  Bank &amp; Branch: {defaults.bank.branch}<br />
                  Account Holder: {defaults.bank.holderName}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ flex: '1 1 300px', minWidth: 260 }}>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Invoice Prefix</label><input className="input" value={form.invoicePrefix} onChange={(e) => setF('invoicePrefix', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Invoice Number</label><input className="input" value={form.invoiceNumber} onChange={(e) => setF('invoiceNumber', e.target.value)} /></div>
            </div>
            <div className="form-group">
              <label>Sales Invoice Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setF('date', e.target.value)} />
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Payment Terms (days)</label><input className="input" type="number" min="0" value={form.paymentTermDays} onChange={(e) => setPaymentDays(e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Due Date</label><input className="input" type="date" value={form.dueDate} onChange={(e) => setF('dueDate', e.target.value)} /></div>
            </div>
            <div className="form-group">
              <label>Document Type</label>
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {!isCash && (
              <div className="form-group">
                <label>Place of Supply</label>
                <select className="input" value={form.placeOfSupply} onChange={(e) => setF('placeOfSupply', e.target.value)}>
                  <option value="auto">Auto (from GSTIN){buyerStatePreview ? ` — ${buyerStatePreview}` : ''}</option>
                  {(defaults?.states || []).map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Override if supply location is different from buyer state</div>
              </div>
            )}

            <div className="card" style={{ background: 'var(--surface2)', marginTop: 8 }}>
              <Row label="Subtotal" value={inr(totals.subtotal)} />
              {!isCash && (
                <>
                  <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
                    <span>GST Rate</span>
                    <select className="input" style={{ width: 90 }} value={form.gstRate} onChange={(e) => setF('gstRate', e.target.value)}>
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  {interStatePreview ? (
                    <Row label={`IGST @${form.gstRate}%`} value={inr(totals.igst)} />
                  ) : (
                    <>
                      <Row label={`CGST @${round2(Number(form.gstRate) / 2)}%`} value={inr(totals.cgst)} />
                      <Row label={`SGST @${round2(Number(form.gstRate) / 2)}%`} value={inr(totals.sgst)} />
                    </>
                  )}
                </>
              )}
              <div className="flex items-center justify-between" style={{ padding: '3px 0' }}>
                <span>Discount</span>
                <input className="input" type="number" style={{ width: 90, textAlign: 'right' }} value={form.discount} onChange={(e) => setF('discount', e.target.value)} />
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <Row label="Total Amount" value={inr(totals.total)} bold />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.markFullyPaid} onChange={(e) => setF('markFullyPaid', e.target.checked)} /> Mark as fully paid
            </label>
            {!form.markFullyPaid && (
              <div className="flex gap-2">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Amount Received</label>
                  <input className="input" type="number" value={form.amountReceived} onChange={(e) => setF('amountReceived', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Mode</label>
                  <select className="input" value={form.paymentMode} onChange={(e) => setF('paymentMode', e.target.value)}>
                    {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}
            <Row label="Balance Amount" value={inr(totals.balance)} bold color={totals.balance > 0 ? 'var(--red, #DC2626)' : 'var(--green, #16A34A)'} />

            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 14, textAlign: 'right' }}>
              Authorized signatory for<br /><b style={{ color: 'var(--text2)' }}>{defaults?.authorizedSignatory || ''}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
