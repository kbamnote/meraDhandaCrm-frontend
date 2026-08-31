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
import { accountingApi, ordersApi, uploadApi, describeError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';
import BranchSelect from './BranchSelect';
import { ref, onValue, db } from '../../services/realtime';

// Null-safe .trim() — building the request body must never throw on a field that
// happens to be absent, or the failure surfaces as an unexplained "Failed" with
// no request ever leaving the browser.
const trim = (v) => String(v ?? '').trim();

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

// Every Bill To / Ship To field the form owns, with a safe empty value. submit()
// calls .trim() on these, so the object must ALWAYS carry the full shape: a
// partial replacement (picking a client used to drop clientPan and the shipTo*
// fields) made submit throw a TypeError *before* any request was sent, which the
// catch then reported as a generic "Failed" — no network call, nothing in the
// server log. Reset and select through this constant so that can't recur.
const EMPTY_PARTY = {
  clientId: null, clientName: '', clientPhone: '', clientAddress: '', gstNo: '',
  clientPan: '',
  // Ship To defaults to the billing party; only sent when "different" is ticked.
  shipDifferent: false, shipToName: '', shipToAddress: '',
};

const TYPE_CARDS = [
  { type: 'proforma', icon: '📝', titleKey: 'proformaTitle', descKey: 'proformaDesc' },
  { type: 'invoice',  icon: '🧾', titleKey: 'invoiceTitle',  descKey: 'invoiceDesc' },
  { type: 'cash',     icon: '💵', titleKey: 'cashTitle',     descKey: 'cashDesc' },
];

// No per-item taxRate — GST is now a single invoice-level rate (GST Rate
// dropdown on the right), so a line is just what's being billed and how much.
// itemId links the line to the Items catalog (products); lines without an
// itemId (free-text or job work) invoice as-is and don't move stock.
const blankItem = () => ({ name: '', description: '', hsn: '', unit: '', qty: '1', rate: '', itemId: null });

const DOC_TYPES = [
  { value: 'proforma', label: 'Proforma Invoice' },
  { value: 'invoice', label: 'Tax Invoice' },
  { value: 'cash', label: 'Cash / Non-GST Bill' },
];
const GST_RATES = ['0', '5', '12', '18', '28'];
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

export default function CreateInvoiceFlow({ job, party: forParty, invoice, onClose, onCreated }) {
  const t = useT(S);
  // Editing an existing invoice: its type is already decided, so skip the picker.
  const [type, setType] = useState(invoice ? (invoice.type || 'invoice') : null);

  if (!type) {
    return <InvoiceTypePicker t={t} onCancel={onClose} onPick={setType} />;
  }
  return (
    <NewInvoiceModal
      t={t}
      initialType={type}
      job={job}
      party={forParty}
      invoice={invoice}
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

function NewInvoiceModal({ onClose, onCreated, t, initialType = 'invoice', job, party: forParty, invoice }) {
  const isEdit = !!invoice;
  const { tenant } = useAuth();
  // Snapshot the branding logo onto the invoice so a reprint keeps the mark the
  // document was issued under, even if branding changes later.
  const tenantLogo = tenant?.settings?.branding?.logo || '';
  const [type, setType] = useState(initialType);
  const isCash = type === 'cash';
  // Composition dealers cannot collect GST (CGST Act s.10); reverse charge moves
  // the liability to the recipient. Either way this invoice carries no tax.
  const isComposition = defaults?.gstScheme === 'composition';

  // Bill To — search-and-select (same pattern as the Job Cards client picker),
  // with the selected/typed party editable underneath.
  const [clientQ, setClientQ] = useState('');
  const [clientMatches, setClientMatches] = useState([]);
  // `party` prop = opened from a specific customer (Parties page), so Bill To is
  // already known; `job` = opened from Dispatch, prefilled from the job card.
  const [party, setParty] = useState(invoice ? {
    ...EMPTY_PARTY,
    clientId: invoice.clientId || null,
    clientName: invoice.clientName || '',
    clientPhone: invoice.clientPhone || '',
    clientAddress: invoice.clientAddress || '',
    gstNo: invoice.clientGstNo || '',
    clientPan: invoice.clientPan || '',
    // Only treat Ship To as separate when it genuinely differs from Bill To —
    // the server mirrors them when they match, so a blind copy would tick the
    // "different address" box on every edit.
    shipDifferent: !!invoice.shipToAddress && invoice.shipToAddress !== invoice.clientAddress,
    shipToName: invoice.shipToName || '',
    shipToAddress: invoice.shipToAddress || '',
  } : {
    ...EMPTY_PARTY,
    clientId: forParty?.id || null,
    clientName: forParty?.name || job?.clientName || '',
    clientPhone: forParty?.phone || '',
    clientAddress: forParty?.address || '',
    gstNo: forParty?.gstNo || job?.gstNo || '',
  });
  const setP = (k, v) => setParty((p) => ({ ...p, [k]: v }));

  const [form, setForm] = useState({
    jobNo: invoice?.jobNo || job?.jobNo || '',
    date: invoice?.date || new Date().toISOString().slice(0, 10),
    ewayBillNo: invoice?.ewayBillNo || '', vehicleNo: invoice?.vehicleNo || '',
    poNumber: invoice?.poNumber || '', approvedBy: invoice?.approvedBy || '',
    eventType: invoice?.eventType || '', salesPerson: invoice?.salesPerson || '',
    deliveryType: invoice?.deliveryType || '', branchId: invoice?.branchId || '',
    // The number is fixed on an edit — a GST document keeps its identity.
    invoicePrefix: invoice?.invoicePrefix || '', invoiceNumber: '',
    paymentTermDays: invoice?.paymentTermDays ?? '', dueDate: invoice?.dueDate || '',
    placeOfSupply: invoice?.placeOfSupply || 'auto',
    reverseCharge: !!invoice?.reverseCharge,
    gstRate: invoice?.gstRate != null ? String(invoice.gstRate) : '18',
    discount: invoice?.discount != null ? String(invoice.discount) : '0',
    // Payment capture belongs to creation only — the edit endpoint refuses any
    // invoice that already has a receipt against it.
    markFullyPaid: false,
    amountReceived: '0',
    paymentMode: 'Cash',
    sendPaymentLink: !invoice, // don't re-queue the WhatsApp link on an edit
    notes: invoice?.notes || '', showNotes: !!invoice?.notes,
    terms: invoice?.terms || '', editingTerms: false,
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [items, setItems] = useState(
    invoice && Array.isArray(invoice.items) && invoice.items.length
      ? invoice.items.map((it) => ({
        ...blankItem(),
        name: it.name || '', hsn: it.hsn || '',
        qty: it.qty != null ? String(it.qty) : '',
        rate: it.rate != null ? String(it.rate) : '',
        itemId: it.itemId || null,
      }))
      : [job ? { ...blankItem(), name: job.work || '' } : blankItem()]
  );
  const [attachments, setAttachments] = useState(invoice?.attachments || []);
  const [uploading, setUploading] = useState(false);
  const [defaults, setDefaults] = useState(null); // GET /invoice-defaults result
  const [busy, setBusy] = useState(false);
  // Set from the server's 409 when this invoice would breach the customer's
  // credit limit; holds { creditLimit, outstanding, invoiceTotal, projected }.
  const [creditWarning, setCreditWarning] = useState(null);

  // Items catalog (the `products` collection) for the line-item picker — live,
  // so stock hints and prices stay current after an invoice deducts stock.
  const [catalog, setCatalog] = useState([]);
  useEffect(() => {
    const unsub = onValue(ref(db, 'mpw/products'), (snap) => {
      const raw = snap.val() || {};
      setCatalog(Object.entries(raw).map(([id, rec]) => ({ ...rec, id })));
    });
    return () => unsub();
  }, []);

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
    // Merge onto the existing party so fields the picker doesn't supply
    // (clientPan, shipTo*) keep their values instead of vanishing.
    setParty((p) => ({
      ...p,
      clientId: c.id, clientName: c.name || '', clientPhone: c.phone || '',
      clientAddress: c.address || '', gstNo: c.gstNo || '',
    }));
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

  // Manually re-typing the name detaches the line from the catalog (free-text),
  // so stock won't be deducted for a name the user changed after picking.
  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v, ...(k === 'name' ? { itemId: null } : {}) } : it)));

  // Picking a catalog product fills Name / HSN / Selling Price and links itemId
  // so the backend deducts that product's stock when the invoice is saved.
  const pickCatalogItem = (i, p) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, itemId: p.id, name: p.name, hsn: p.hsn || '', rate: String(p.price ?? '') } : it)));

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
    const rate = (isCash || isComposition || form.reverseCharge) ? 0 : (Number(form.gstRate) || 0);
    const taxTotal = round2((subtotal * rate) / 100);
    const cgst = interStatePreview ? 0 : round2(taxTotal / 2);
    const sgst = interStatePreview ? 0 : round2(taxTotal / 2);
    const igst = interStatePreview ? taxTotal : 0;
    const discount = round2(Number(form.discount) || 0);
    const rawTotal = round2(Math.max(0, subtotal + taxTotal - discount));
    // Mirror the server's rounding so the figure on screen IS the figure that
    // gets saved. The server recomputes authoritatively; this is display only.
    const mode = defaults?.invoiceRounding || 'nearest';
    const total = round2(
      mode === 'nearest' ? Math.round(rawTotal)
        : mode === 'up' ? Math.ceil(rawTotal)
          : mode === 'down' ? Math.floor(rawTotal)
            : rawTotal
    );
    const roundOff = round2(total - rawTotal);
    const received = form.markFullyPaid ? total : round2(Number(form.amountReceived) || 0);
    const balance = round2(Math.max(0, total - Math.min(received, total)));
    return { subtotal, taxTotal, cgst, sgst, igst, discount, rawTotal, roundOff, total, received, balance };
  }, [items, form.gstRate, form.discount, form.markFullyPaid, form.amountReceived, isCash, isComposition, form.reverseCharge, interStatePreview, defaults]);

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

  const submit = async (overrideCreditLimit = false) => {
    if (!trim(party.clientName)) return showToast('Bill To — client name required', 'error');
    if (!items.some((it) => it.name.trim() && Number(it.rate) > 0)) return showToast('Add at least one item', 'error');
    setBusy(true);
    try {
      const body = {
        type,
        // Set only after the user confirms the credit-limit warning below.
        overrideCreditLimit: overrideCreditLimit || undefined,
        clientId: party.clientId, clientName: trim(party.clientName),
        clientPhone: trim(party.clientPhone), clientAddress: trim(party.clientAddress),
        gstNo: trim(party.gstNo), clientPan: trim(party.clientPan),
        // Omit when shipping to the billing address — the server then mirrors
        // Bill To into Ship To rather than storing a blank block.
        shipToName: party.shipDifferent ? trim(party.shipToName) : undefined,
        shipToAddress: party.shipDifferent ? trim(party.shipToAddress) : undefined,
        companyLogo: tenantLogo || undefined,
        jobId: job?.id, jobNo: form.jobNo, // server stamps job.billNumber when jobId is set
        date: form.date,
        ewayBillNo: form.ewayBillNo, vehicleNo: form.vehicleNo, poNumber: form.poNumber, approvedBy: form.approvedBy,
        eventType: form.eventType, salesPerson: form.salesPerson, deliveryType: form.deliveryType,
        branchId: form.branchId || undefined,
        invoicePrefix: form.invoicePrefix, invoiceNumber: form.invoiceNumber,
        paymentTermDays: form.paymentTermDays, dueDate: form.dueDate,
        placeOfSupply: form.placeOfSupply,
        gstRate: (isCash || isComposition || form.reverseCharge) ? 0 : Number(form.gstRate) || 0,
        reverseCharge: !!form.reverseCharge,
        discount: totals.discount,
        markFullyPaid: form.markFullyPaid,
        amountReceived: form.markFullyPaid ? undefined : Number(form.amountReceived) || 0,
        paymentMode: form.paymentMode,
        sendPaymentLink: form.sendPaymentLink,
        notes: form.notes, terms: form.terms, attachments,
        items: items.filter((it) => it.name.trim()).map((it) => ({ name: it.name, hsn: it.hsn, qty: Number(it.qty), rate: Number(it.rate), itemId: it.itemId || null })),
      };
      const inv = isEdit
        ? await accountingApi.updateInvoice(invoice.id, body)
        : await accountingApi.createInvoice(body);
      showToast(`${inv.invoiceNo} ${isEdit ? 'updated' : 'created'}`, 'success');
      onCreated?.(inv);
      onClose();
    } catch (e) {
      // The server refuses an invoice that would push the customer past their
      // credit limit. That's a business decision, not an error — surface the
      // numbers and let an authorised user proceed deliberately.
      if (e?.response?.status === 409 && e.response.data?.code === 'CREDIT_LIMIT_EXCEEDED') {
        setCreditWarning(e.response.data);
      } else {
        showToast(describeError(e, t('failed')), 'error');
      }
    }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 980, width: '100%', maxHeight: '94vh', overflow: 'auto', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>
            {isEdit ? `Edit Invoice ${invoice.invoiceNo || ''}` : 'Create Sales Invoice'}
          </h3>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('cancel')}</button>
            {/* Must be wrapped: passing `submit` directly hands the click event
                in as overrideCreditLimit, which is truthy. */}
            <button className="btn btn-primary" onClick={() => submit(false)} disabled={busy}>
              {busy ? '…' : (isEdit ? 'Save changes' : 'Save')}
            </button>
          </div>
        </div>

        {isEdit && (
          <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5 }}>
            ⚠️ Saving replaces this invoice's ledger entry and re-applies its stock
            deduction. The invoice number stays the same and the previous version is
            kept in its revision history.
            {Array.isArray(invoice.revisions) && invoice.revisions.length > 0
              && ` Edited ${invoice.revisions.length} time${invoice.revisions.length > 1 ? 's' : ''} already.`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {/* ── LEFT COLUMN ── */}
          <div style={{ flex: '1 1 560px', minWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>Bill To</div>
            {party.clientName ? (
              <div className="card" style={{ background: 'var(--surface2)', marginBottom: 8, padding: 12 }}>
                <div className="flex items-center justify-between">
                  <b>{party.clientName}</b>
                  <button className="btn btn-ghost btn-xs" onClick={() => setParty({ ...EMPTY_PARTY })}>Change</button>
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
              <div className="form-group" style={{ flex: 1 }}>
                <label>Client PAN</label>
                <input className="input" placeholder="AAACU8310N" value={party.clientPan} onChange={(e) => setP('clientPan', e.target.value.toUpperCase())} />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={party.shipDifferent} onChange={(e) => setP('shipDifferent', e.target.checked)} />
                  Ship to a different address
                </label>
                {!party.shipDifferent && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Ship To will match Bill To.</div>
                )}
              </div>
            </div>
            {party.shipDifferent && (
              <div className="flex gap-2">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Ship To — name</label>
                  <input className="input" value={party.shipToName} onChange={(e) => setP('shipToName', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Ship To — address</label>
                  <input className="input" value={party.shipToAddress} onChange={(e) => setP('shipToAddress', e.target.value)} />
                </div>
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
              <div className="form-group" style={{ flex: 1 }}><label>Branch</label><BranchSelect value={form.branchId} onChange={(v) => setF('branchId', v)} /></div>
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
              const q = (it.name || '').trim().toLowerCase();
              const exactMatch = catalog.some((c) => c.name === it.name);
              const itemMatches = (q.length < 1 || exactMatch)
                ? []
                : catalog.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)).slice(0, 8);
              const picked = it.itemId ? catalog.find((c) => c.id === it.itemId) : null;
              const trackable = picked && picked.trackStock !== 'no' && picked.type !== 'service';
              const overStock = trackable && picked.stock != null && (Number(it.qty) || 0) > Number(picked.stock);
              return (
                <div key={i}>
                <div className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ width: 22, fontSize: 12, color: 'var(--text3)' }}>{i + 1}</span>
                  <div style={{ position: 'relative', flex: 3 }}>
                    <input className="input" style={{ width: '100%' }} placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                    {itemMatches.length > 0 && (
                      <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 160, overflow: 'auto' }}>
                        {itemMatches.map((p) => (
                          <div key={p.id} onClick={() => pickCatalogItem(i, p)} style={{ padding: '7px 9px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                            <b>{p.name}</b>
                            {p.sku ? <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{p.sku}</span> : null}
                            <span style={{ float: 'right', color: 'var(--text2)' }}>
                              {p.trackStock !== 'no' && p.type !== 'service' && p.stock != null ? `stock ${Number(p.stock)}${p.unit ? ' ' + p.unit : ''}` : ''}
                              {p.price ? ` · ₹${Number(p.price).toLocaleString('en-IN')}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {picked && (
                      <div style={{ fontSize: 10.5, marginTop: 1, color: overStock ? 'var(--red, #DC2626)' : 'var(--text3)' }}>
                        {trackable ? `stock ${Number(picked.stock)}${picked.unit ? ' ' + picked.unit : ''}` : 'service / no stock tracking'}
                        {overStock ? ` — qty exceeds available stock` : ''}
                      </div>
                    )}
                  </div>
                  <input className="input" style={{ flex: 1.2, minWidth: 60 }} placeholder="HSN/SAC" value={it.hsn} onChange={(e) => setItem(i, 'hsn', e.target.value)} />
                  <input className="input" style={{ width: 50 }} placeholder="Qty" type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                  <input className="input" style={{ width: 52 }} placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} />
                  <input className="input" style={{ flex: 1.2, minWidth: 70 }} placeholder="Price" type="number" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
                  <span style={{ flex: 1.2, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{inr(amount)}</span>
                  <button className="btn btn-ghost btn-xs" style={{ width: 18 }} onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</button>
                </div>
                {/* Optional second line printed under the item name on the invoice. */}
                <div className="flex gap-2" style={{ marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ width: 22 }} />
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: 12 }}
                    placeholder="Description (optional) — printed under the item name"
                    value={it.description}
                    onChange={(e) => setItem(i, 'description', e.target.value)}
                  />
                  <span style={{ width: 18 }} />
                </div>
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
              {/* A composition dealer may not collect GST at all — the rate
                  picker is hidden rather than shown and ignored. */}
              {isComposition && (
                <div style={{ padding: '6px 0', fontSize: 11.5, color: 'var(--amber, #B45309)' }}>
                  Bill of Supply — composition scheme, no tax collected.
                </div>
              )}
              {!isCash && !isComposition && (
                <>
                  <label className="flex items-center" style={{ gap: 6, padding: '4px 0', fontSize: 12.5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!form.reverseCharge}
                      onChange={(e) => setF('reverseCharge', e.target.checked)} />
                    Reverse charge (recipient pays the GST)
                  </label>
                  {form.reverseCharge && (
                    <div style={{ padding: '2px 0 6px', fontSize: 11.5, color: 'var(--amber, #B45309)' }}>
                      No tax is charged on this invoice; it must state that tax is
                      payable under reverse charge.
                    </div>
                  )}
                </>
              )}
              {!isCash && !isComposition && !form.reverseCharge && (
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
              {totals.roundOff !== 0 && (
                <Row label="Round Off" value={`${totals.roundOff > 0 ? '+' : '−'} ${inr(Math.abs(totals.roundOff))}`} />
              )}
              <Row label="Total Amount" value={inr(totals.total)} bold />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.markFullyPaid} onChange={(e) => setF('markFullyPaid', e.target.checked)} /> Mark as fully paid
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" checked={form.sendPaymentLink} onChange={(e) => setF('sendPaymentLink', e.target.checked)} />
              Send payment link on WhatsApp
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

      {creditWarning && (
        <CreditLimitDialog
          info={creditWarning}
          busy={busy}
          onCancel={() => setCreditWarning(null)}
          onProceed={() => { setCreditWarning(null); submit(true); }}
        />
      )}
    </div>
  );
}

// Shown when the server rejects an invoice for breaching the customer's credit
// limit. Deliberately states the three numbers that led to the block, so the
// decision to proceed is an informed one — the override is recorded on the
// invoice and in the audit trail.
function CreditLimitDialog({ info, busy, onCancel, onProceed }) {
  const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN');
  const Row = ({ label, value, strong }) => (
    <div className="flex items-center justify-between" style={{ padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>⚠️ Credit limit exceeded</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 12px' }}>
          Saving this invoice would take the customer past their approved credit limit.
        </p>
        <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '4px 0', margin: '4px 0 14px' }}>
          <Row label="Already outstanding" value={money(info.outstanding)} />
          <Row label="This invoice (unpaid part)" value={money(info.projected - info.outstanding)} />
          <Row label="Exposure after saving" value={money(info.projected)} strong />
          <Row label="Approved credit limit" value={money(info.creditLimit)} />
          <div className="flex items-center justify-between" style={{ padding: '6px 0', fontSize: 13, color: 'var(--red, #DC2626)' }}>
            <span>Over limit by</span>
            <span style={{ fontWeight: 800 }}>{money(info.projected - info.creditLimit)}</span>
          </div>
        </div>
        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-sm" onClick={onProceed} disabled={busy}
            style={{ background: 'var(--red, #DC2626)', color: '#fff', border: 'none' }}>
            {busy ? '…' : 'Save anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
