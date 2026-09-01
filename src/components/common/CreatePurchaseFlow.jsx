/**
 * CreatePurchaseFlow — recording a supplier's bill.
 *
 * The mirror image of CreateInvoiceFlow: there we ISSUE the document and own its
 * number, here the supplier issues it and we transcribe theirs. Two consequences
 * shape the whole form:
 *
 *   1. Every figure must be enterable, not derived. On a sales invoice we can
 *      compute the tax and be right by definition. Here the supplier's paper is
 *      the authority — if their arithmetic put ₹0.40 somewhere ours wouldn't, the
 *      bill still has to reconcile to their total, so tax is per line, discounts
 *      are per line, and round-off is explicit.
 *   2. It posts on save. A purchase ORDER is an intention (it posts only when
 *      received); a purchase INVOICE means the goods already arrived.
 *
 * The server recomputes all of it authoritatively in computePurchaseMoney() —
 * the totals here are a live preview using the identical rules, so what the user
 * sees before saving is what gets stored.
 *
 * Props:
 *   vendor?    — pre-select this supplier ({ id, name, gstNo, address, phone })
 *   onClose()  — close the form
 *   onCreated(po) — called with the created purchase before onClose()
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi, describeError } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';
import BranchSelect from './BranchSelect';
import { ref, onValue, db } from '../../services/realtime';

// Null-safe .trim(). Building the request body must never throw on an absent
// field — that failure surfaces as a bare "Failed" with no request ever sent.
const trim = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const inr = (n) => '₹' + round2(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const S = {
  title:    { en: 'Create Purchase Invoice', hi: 'खरीद इनवॉइस बनाएँ', hinglish: 'Purchase Invoice banayein' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel' },
  save:     { en: 'Save', hi: 'सहेजें', hinglish: 'Save' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
};

const GST_RATES = ['0', '5', '12', '18', '28'];
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

const blankItem = () => ({ name: '', description: '', hsn: '', unit: '', qty: '1', rate: '', discount: '', taxRate: '18', itemId: null });

const partyName = (v) => (v && (v.name || v.company || v.title)) || '';
const partyPhone = (v) => (v && (v.phone || v.mobile || v.contact)) || '';

function Row({ label, value, bold, color, muted }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
      <span style={{ fontWeight: bold ? 700 : 400, color: muted ? 'var(--text3)' : 'var(--text)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}

export default function CreatePurchaseFlow({ vendor, onClose, onCreated }) {
  const t = useT(S);

  // ── Bill From ──────────────────────────────────────────────────────────────
  const [vendors, setVendors] = useState([]);
  const [vendorQ, setVendorQ] = useState('');
  const [party, setParty] = useState({
    vendorId: vendor?.id || null,
    vendorName: vendor?.name || '',
    vendorPhone: vendor?.phone || '',
    vendorAddress: vendor?.address || '',
    vendorGstNo: vendor?.gstNo || vendor?.gstin || '',
    shipDifferent: false,
    shipFromAddress: '',
  });
  const setP = (k, v) => setParty((p) => ({ ...p, [k]: v }));

  const [form, setForm] = useState({
    purchaseInvoiceNo: '',            // THEIR bill number — the reference that matters
    originalInvoiceNo: '',
    date: new Date().toISOString().slice(0, 10),
    paymentTermDays: '', dueDate: '',
    purchaseOrderNo: '', ewayBillNo: '', vehicleNo: '',
    approvedBy: '', eventType: '', branchId: '',
    placeOfSupply: 'auto',
    discount: '0',
    tcsAmount: '0', applyTcs: false,
    tdsAmount: '0', applyTds: false,
    autoRoundOff: true,
    markFullyPaid: false, paidAmount: '0', paymentMode: 'Cash',
    notes: '', showNotes: false,
    terms: '', editingTerms: false,
  });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const [items, setItems] = useState([blankItem()]);
  const [charges, setCharges] = useState([]);   // [{ label, amount }]
  const [catalog, setCatalog] = useState([]);
  const [defaults, setDefaults] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const offV = onValue(ref(db, 'mpw/vendors'), (s) => {
      const raw = s.val() || {};
      setVendors(Object.entries(raw)
        .map(([id, v]) => ({ ...v, id, name: partyName(v), phone: partyPhone(v) }))
        .filter((v) => v.name));
    });
    const offP = onValue(ref(db, 'mpw/products'), (s) => {
      const raw = s.val() || {};
      setCatalog(Object.entries(raw).map(([id, rec]) => ({ ...rec, id })));
    });
    return () => { offV(); offP(); };
  }, []);

  // Company GSTIN/state and the round-off preference come from the same
  // settings the sales side uses, so both documents round the same way.
  useEffect(() => {
    accountingApi.invoiceDefaults('invoice').then(setDefaults).catch(() => {});
  }, []);

  const vendorMatches = useMemo(() => {
    const q = vendorQ.trim().toLowerCase();
    if (q.length < 1) return [];
    return vendors
      .filter((v) => v.name.toLowerCase().includes(q) || String(v.phone).toLowerCase().includes(q))
      .slice(0, 8);
  }, [vendors, vendorQ]);

  const pickVendor = (v) => {
    // Merge rather than replace, so fields the record doesn't carry keep their
    // values instead of vanishing (the bug that made the sales form throw).
    setParty((p) => ({
      ...p,
      vendorId: v.id,
      vendorName: v.name || '',
      vendorPhone: v.phone || '',
      vendorAddress: v.address || v.billingAddress || '',
      vendorGstNo: v.gstNo || v.gstin || '',
    }));
    setVendorQ('');
  };

  const setPaymentDays = (v) => {
    setF('paymentTermDays', v);
    const days = Number(v);
    if (Number.isFinite(days) && days >= 0) {
      const d = new Date(form.date || Date.now());
      d.setDate(d.getDate() + days);
      setF('dueDate', d.toISOString().slice(0, 10));
    }
  };

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => (
    idx === i ? { ...it, [k]: v, ...(k === 'name' ? { itemId: null } : {}) } : it
  )));
  const pickCatalogItem = (i, p) => setItems((arr) => arr.map((it, idx) => (
    idx === i
      ? { ...it, itemId: p.id, name: p.name, hsn: p.hsn || '', unit: p.unit || '', rate: String(p.purchasePrice ?? p.costPrice ?? p.price ?? '') }
      : it
  )));

  // Interstate decides CGST+SGST vs IGST. Previewed from the supplier's GSTIN
  // state code; the server recomputes it, this is display-only.
  const stateMap = useMemo(
    () => Object.fromEntries((defaults?.states || []).map((s) => [s.code, s.name])),
    [defaults]
  );
  const supplierState = stateMap[String(party.vendorGstNo || '').slice(0, 2)] || null;
  const pos = form.placeOfSupply === 'auto' ? (supplierState || defaults?.companyState || null) : form.placeOfSupply;
  const interState = !!defaults?.companyState && !!pos && pos !== defaults.companyState;

  // Same rules as the server's computePurchaseMoney, in the same order.
  const totals = useMemo(() => {
    let subtotal = 0; let taxTotal = 0;
    const lines = items.map((it) => {
      const gross = round2(num(it.qty) * num(it.rate));
      const lineDiscount = round2(num(it.discount));
      const amount = round2(Math.max(0, gross - lineDiscount));
      const tax = round2((amount * num(it.taxRate)) / 100);
      subtotal = round2(subtotal + amount);
      taxTotal = round2(taxTotal + tax);
      return { amount, tax };
    });
    const discount = round2(num(form.discount));
    const taxable = round2(Math.max(0, subtotal - discount));
    if (discount > 0 && subtotal > 0) taxTotal = round2((taxTotal * taxable) / subtotal);

    // SGST takes the remainder so the halves always reconstitute the gross tax.
    const cgst = interState ? 0 : round2(taxTotal / 2);
    const sgst = interState ? 0 : round2(taxTotal - round2(taxTotal / 2));
    const igst = interState ? taxTotal : 0;
    const tax = round2(cgst + sgst + igst);

    const chargesTotal = round2(charges.reduce((s, c) => s + num(c.amount), 0));
    const tcs = form.applyTcs ? round2(num(form.tcsAmount)) : 0;
    const tds = form.applyTds ? round2(num(form.tdsAmount)) : 0;

    const rawTotal = round2(Math.max(0, taxable + tax + chargesTotal + tcs - tds));
    const total = form.autoRoundOff ? round2(Math.round(rawTotal)) : rawTotal;
    const roundOff = round2(total - rawTotal);

    const paid = form.markFullyPaid ? total : round2(num(form.paidAmount));
    const paidAmount = Math.min(paid, total);
    const balance = round2(Math.max(0, total - paidAmount));

    return { lines, subtotal, discount, taxable, cgst, sgst, igst, taxTotal: tax, chargesTotal, tcs, tds, rawTotal, roundOff, total, paidAmount, balance };
  }, [items, charges, form.discount, form.applyTcs, form.tcsAmount, form.applyTds, form.tdsAmount,
    form.autoRoundOff, form.markFullyPaid, form.paidAmount, interState]);

  const submit = async () => {
    if (!trim(party.vendorName)) return showToast('Bill From — supplier is required', 'error');
    if (!items.some((it) => trim(it.name) && num(it.rate) > 0)) return showToast('Add at least one item with a price', 'error');
    setBusy(true);
    try {
      const body = {
        vendorId: party.vendorId || undefined,
        vendorName: trim(party.vendorName),
        vendorPhone: trim(party.vendorPhone),
        vendorAddress: trim(party.vendorAddress),
        vendorGstNo: trim(party.vendorGstNo),
        shipFromAddress: party.shipDifferent ? trim(party.shipFromAddress) : undefined,
        purchaseInvoiceNo: trim(form.purchaseInvoiceNo) || undefined,
        originalInvoiceNo: trim(form.originalInvoiceNo) || undefined,
        purchaseOrderNo: trim(form.purchaseOrderNo) || undefined,
        date: form.date,
        dueDate: form.dueDate || undefined,
        paymentTermDays: form.paymentTermDays === '' ? undefined : Number(form.paymentTermDays),
        ewayBillNo: trim(form.ewayBillNo) || undefined,
        vehicleNo: trim(form.vehicleNo) || undefined,
        approvedBy: trim(form.approvedBy) || undefined,
        eventType: trim(form.eventType) || undefined,
        branchId: form.branchId || undefined,
        placeOfSupply: pos || undefined,
        interState,
        items: items.filter((it) => trim(it.name)).map((it) => ({
          name: trim(it.name), description: trim(it.description) || undefined,
          hsn: trim(it.hsn), unit: trim(it.unit),
          qty: num(it.qty), rate: num(it.rate),
          discount: num(it.discount), taxRate: num(it.taxRate),
          itemId: it.itemId || null,
        })),
        discount: num(form.discount),
        additionalCharges: charges
          .filter((c) => num(c.amount) !== 0)
          .map((c) => ({ label: trim(c.label) || 'Charge', amount: num(c.amount) })),
        tcsAmount: form.applyTcs ? num(form.tcsAmount) : 0,
        tdsAmount: form.applyTds ? num(form.tdsAmount) : 0,
        // Explicitly false, not undefined — the server defaults to rounding.
        roundOff: form.autoRoundOff,
        roundOffMode: 'nearest',
        markFullyPaid: form.markFullyPaid,
        paidAmount: form.markFullyPaid ? undefined : num(form.paidAmount),
        paymentMode: form.paymentMode,
        notes: trim(form.notes) || undefined,
        terms: trim(form.terms) || undefined,
      };
      const po = await accountingApi.createPurchaseInvoice(body);
      showToast(`Purchase ${po.poNo || ''} recorded`, 'success');
      onCreated?.(po);
      onClose();
    } catch (e) {
      showToast(describeError(e, t('failed')), 'error');
    } finally {
      setBusy(false);
    }
  };

  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 1040, width: '100%', maxHeight: '94vh', overflow: 'auto', padding: 20 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{t('title')}</h3>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('cancel')}</button>
            {/* Wrapped, not passed directly — a bare handler hands the click
                event in as the first argument. */}
            <button className="btn btn-primary" onClick={() => submit()} disabled={busy}>
              {busy ? '…' : t('save')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          {/* ── LEFT COLUMN ── */}
          <div style={{ flex: '1 1 580px', minWidth: 320 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Bill From</div>
            {party.vendorName ? (
              <div className="card" style={{ background: 'var(--surface2)', marginBottom: 8, padding: 12 }}>
                <div className="flex items-center justify-between">
                  <b>{party.vendorName}</b>
                  <button className="btn btn-ghost btn-xs" onClick={() => setParty((p) => ({
                    ...p, vendorId: null, vendorName: '', vendorPhone: '', vendorAddress: '', vendorGstNo: '',
                  }))}>Change Party</button>
                </div>
                {party.vendorPhone && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>📞 {party.vendorPhone}</div>}
                {party.vendorAddress && <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>📍 {party.vendorAddress}</div>}
                {party.vendorGstNo && <div style={{ fontSize: 12, color: 'var(--text3)' }}>GSTIN: {party.vendorGstNo}</div>}
              </div>
            ) : null}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input className="input" placeholder="Search supplier by name or number" value={vendorQ} onChange={(e) => setVendorQ(e.target.value)} />
              {vendorMatches.length > 0 && (
                <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 180, overflow: 'auto' }}>
                  {vendorMatches.map((v) => (
                    <div key={v.id} onClick={() => pickVendor(v)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13 }}><b>{v.name}</b> <span style={{ color: 'var(--text3)' }}>{v.phone || ''}</span></div>
                      {(v.gstNo || v.gstin) && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.gstNo || v.gstin}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!party.vendorName && (
              <div className="flex gap-2" style={{ marginBottom: 10 }}>
                <input className="input" style={{ flex: 1 }} placeholder="Or type a new supplier name" value={party.vendorName} onChange={(e) => setP('vendorName', e.target.value)} />
                <input className="input" style={{ flex: 1 }} placeholder="Mobile" value={party.vendorPhone} onChange={(e) => setP('vendorPhone', e.target.value)} />
                <input className="input" style={{ flex: 1 }} placeholder="GSTIN" value={party.vendorGstNo} onChange={(e) => setP('vendorGstNo', e.target.value.toUpperCase())} />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={party.shipDifferent} onChange={(e) => setP('shipDifferent', e.target.checked)} />
              Ship From a different address
            </label>
            {party.shipDifferent ? (
              <div className="form-group">
                <label>Ship From — address</label>
                <input className="input" value={party.shipFromAddress} onChange={(e) => setP('shipFromAddress', e.target.value)} />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Ship From will match the supplier's address.</div>
            )}

            <div style={{ ...lbl, margin: '12px 0 6px' }}>Items</div>
            <div style={{ display: 'flex', gap: 6, ...lbl, padding: '0 2px 4px' }}>
              <span style={{ width: 20 }}>No</span>
              <span style={{ flex: 2.4 }}>Item</span>
              <span style={{ flex: 1 }}>HSN</span>
              <span style={{ width: 46 }}>Qty</span>
              <span style={{ flex: 1 }}>Price</span>
              <span style={{ flex: 1 }}>Discount</span>
              <span style={{ width: 62 }}>Tax</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Amount</span>
              <span style={{ width: 18 }} />
            </div>
            {items.map((it, i) => {
              const line = totals.lines[i] || { amount: 0, tax: 0 };
              const q = trim(it.name).toLowerCase();
              const exact = catalog.some((c) => c.name === it.name);
              const matches = (q.length < 1 || exact) ? [] : catalog
                .filter((p) => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
                .slice(0, 8);
              return (
                <div key={i}>
                  <div className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ width: 20, fontSize: 12, color: 'var(--text3)' }}>{i + 1}</span>
                    <div style={{ position: 'relative', flex: 2.4 }}>
                      <input className="input" style={{ width: '100%' }} placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                      {matches.length > 0 && (
                        <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 160, overflow: 'auto' }}>
                          {matches.map((p) => (
                            <div key={p.id} onClick={() => pickCatalogItem(i, p)} style={{ padding: '7px 9px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                              <b>{p.name}</b>
                              {p.sku ? <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{p.sku}</span> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input className="input" style={{ flex: 1, minWidth: 56 }} placeholder="HSN" value={it.hsn} onChange={(e) => setItem(i, 'hsn', e.target.value)} />
                    <input className="input" style={{ width: 46 }} type="number" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} />
                    <input className="input" style={{ flex: 1, minWidth: 62 }} type="number" placeholder="0" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} />
                    <input className="input" style={{ flex: 1, minWidth: 62 }} type="number" placeholder="0" value={it.discount} onChange={(e) => setItem(i, 'discount', e.target.value)} />
                    <select className="input" style={{ width: 62, padding: '6px 4px' }} value={it.taxRate} onChange={(e) => setItem(i, 'taxRate', e.target.value)}>
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                    <span style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{inr(line.amount + line.tax)}</span>
                    <button className="btn btn-ghost btn-xs" style={{ width: 18 }} onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} disabled={items.length === 1}>×</button>
                  </div>
                  <div className="flex gap-2" style={{ marginBottom: 8, alignItems: 'center' }}>
                    <span style={{ width: 20 }} />
                    <input className="input" style={{ flex: 1, fontSize: 12 }} placeholder="Description (optional)" value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                    <input className="input" style={{ width: 70, fontSize: 12 }} placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} />
                    <span style={{ width: 18 }} />
                  </div>
                </div>
              );
            })}
            <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => [...a, blankItem()])}>+ Add Item</button>

            {!form.showNotes ? (
              <div><button className="btn btn-ghost btn-xs" onClick={() => setF('showNotes', true)} style={{ padding: '4px 0' }}>+ Add Notes</button></div>
            ) : (
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setF('notes', e.target.value)} />
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Terms and Conditions</div>
            {form.editingTerms ? (
              <textarea className="input" rows={4} value={form.terms} onChange={(e) => setF('terms', e.target.value)} onBlur={() => setF('editingTerms', false)} autoFocus />
            ) : (
              <div className="card" style={{ background: 'var(--surface2)', fontSize: 12.5, color: 'var(--text2)', whiteSpace: 'pre-line', maxHeight: 90, overflow: 'auto' }}>
                {form.terms || '—'}
              </div>
            )}
            <button className="btn btn-ghost btn-xs" onClick={() => setF('editingTerms', true)} style={{ padding: '4px 0' }}>✏️ Edit Terms</button>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Invoice Details</div>
            <div className="form-group">
              <label>Purchase Invoice No.</label>
              <input className="input" placeholder="The supplier's bill number" value={form.purchaseInvoiceNo} onChange={(e) => setF('purchaseInvoiceNo', e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                Leave blank and we'll allocate our own reference.
              </div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Purchase Invoice Date</label><input className="input" type="date" value={form.date} onChange={(e) => setF('date', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Original Invoice No.</label><input className="input" value={form.originalInvoiceNo} onChange={(e) => setF('originalInvoiceNo', e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Payment Terms (days)</label><input className="input" type="number" min="0" value={form.paymentTermDays} onChange={(e) => setPaymentDays(e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Due Date</label><input className="input" type="date" value={form.dueDate} onChange={(e) => setF('dueDate', e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>PO No.</label><input className="input" value={form.purchaseOrderNo} onChange={(e) => setF('purchaseOrderNo', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>E-Way Bill No.</label><input className="input" value={form.ewayBillNo} onChange={(e) => setF('ewayBillNo', e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Vehicle No.</label><input className="input" value={form.vehicleNo} onChange={(e) => setF('vehicleNo', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Approved By</label><input className="input" value={form.approvedBy} onChange={(e) => setF('approvedBy', e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}><label>Event Type</label><input className="input" value={form.eventType} onChange={(e) => setF('eventType', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label>Branch</label><BranchSelect value={form.branchId} onChange={(v) => setF('branchId', v)} /></div>
            </div>
            <div className="form-group">
              <label>Place of Supply</label>
              <select className="input" value={form.placeOfSupply} onChange={(e) => setF('placeOfSupply', e.target.value)}>
                <option value="auto">Auto (from supplier GSTIN){supplierState ? ` — ${supplierState}` : ''}</option>
                {(defaults?.states || []).map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                {interState ? 'Inter-state — IGST input credit' : 'Intra-state — CGST + SGST input credit'}
              </div>
            </div>

            {/* Freight, packing, insurance — the supplier bills them after tax. */}
            <div className="flex items-center justify-between" style={{ margin: '10px 0 4px' }}>
              <span style={lbl}>Additional Charges</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setCharges((c) => [...c, { label: '', amount: '' }])}>+ Add</button>
            </div>
            {charges.map((c, i) => (
              <div key={i} className="flex gap-2" style={{ marginBottom: 6, alignItems: 'center' }}>
                <input className="input" style={{ flex: 1 }} placeholder="Freight / Packing" value={c.label}
                  onChange={(e) => setCharges((a) => a.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className="input" style={{ width: 90 }} type="number" placeholder="0" value={c.amount}
                  onChange={(e) => setCharges((a) => a.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
                <button className="btn btn-ghost btn-xs" style={{ width: 18 }} onClick={() => setCharges((a) => a.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}

            <div className="card" style={{ background: 'var(--surface2)', marginTop: 8 }}>
              <Row label="Taxable Amount" value={inr(totals.taxable)} />
              <div className="flex items-center justify-between" style={{ padding: '3px 0', fontSize: 13 }}>
                <span>Discount</span>
                <input className="input" type="number" style={{ width: 90, textAlign: 'right' }} value={form.discount} onChange={(e) => setF('discount', e.target.value)} />
              </div>
              {interState
                ? <Row label="IGST" value={inr(totals.igst)} />
                : (<><Row label="CGST" value={inr(totals.cgst)} /><Row label="SGST" value={inr(totals.sgst)} /></>)}
              {totals.chargesTotal !== 0 && <Row label="Additional Charges" value={inr(totals.chargesTotal)} />}

              <label className="flex items-center" style={{ gap: 6, padding: '5px 0', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.applyTcs} onChange={(e) => setF('applyTcs', e.target.checked)} />
                Apply TCS
              </label>
              {form.applyTcs && (
                <div className="flex items-center justify-between" style={{ padding: '2px 0 6px', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>TCS collected by supplier</span>
                  <input className="input" type="number" style={{ width: 90, textAlign: 'right' }} value={form.tcsAmount} onChange={(e) => setF('tcsAmount', e.target.value)} />
                </div>
              )}

              <label className="flex items-center" style={{ gap: 6, padding: '5px 0', fontSize: 12.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.autoRoundOff} onChange={(e) => setF('autoRoundOff', e.target.checked)} />
                Auto Round Off
              </label>
              {totals.roundOff !== 0 && (
                <Row label="Round Off" value={`${totals.roundOff > 0 ? '+' : '−'} ${inr(Math.abs(totals.roundOff))}`} muted />
              )}
              <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <Row label="Total Amount" value={inr(totals.total)} bold />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13 }}>
              <input type="checkbox" checked={form.markFullyPaid} onChange={(e) => setF('markFullyPaid', e.target.checked)} /> Mark as fully paid
            </label>
            {!form.markFullyPaid && (
              <div className="flex gap-2">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Total Amount Paid</label>
                  <input className="input" type="number" value={form.paidAmount} onChange={(e) => setF('paidAmount', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Mode</label>
                  <select className="input" value={form.paymentMode} onChange={(e) => setF('paymentMode', e.target.value)}>
                    {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* TDS is withheld from the supplier and owed onward to the
                government — it lowers what they are paid, it is not a discount. */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13 }}>
              <input type="checkbox" checked={form.applyTds} onChange={(e) => setF('applyTds', e.target.checked)} /> Apply TDS
            </label>
            {form.applyTds && (
              <div className="form-group">
                <label>TDS deducted</label>
                <input className="input" type="number" value={form.tdsAmount} onChange={(e) => setF('tdsAmount', e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                  Withheld from the supplier and booked as TDS payable.
                </div>
              </div>
            )}

            <Row
              label="Balance Amount"
              value={inr(totals.balance)}
              bold
              color={totals.balance > 0 ? 'var(--red, #DC2626)' : 'var(--green, #16A34A)'}
            />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
              Saving posts this bill to the ledger straight away — Inventory and
              input GST go up, the supplier is credited.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
