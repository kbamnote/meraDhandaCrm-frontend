/**
 * The job-card form — the whole thing, in one place.
 *
 * Lifted out of JobCardsPage so a shop visit can open the SAME card. A rep who
 * has just won an order should file a complete job card, not a cut-down one the
 * floor then has to chase the details for — and a second, smaller form would
 * have drifted out of step with this one the first time a field was added.
 *
 * Props
 *   onClose()         dismiss
 *   onCreated(job)    the created job, for the caller to react to
 *   job               an existing card to correct (same form, by design)
 *   prefill           starting values for a new card (a visit knows the client)
 *   extra             sent with the card but not shown as fields (visitId,
 *                     salesPersonId)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ordersApi, uploadApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

// Only the strings this form uses, so a caller need not supply a dictionary.
const S = {
  newJob:  { en: 'New Job Card', hi: 'नया जॉब कार्ड', hinglish: 'Naya Job Card', gu: 'નવું જોબ કાર્ડ', mr: 'नवीन जॉब कार्ड', mwr: 'नयो जॉब कार्ड' },
  editJob: { en: 'Edit Job Card', hi: 'जॉब कार्ड बदलें', hinglish: 'Job Card edit karein', gu: 'જોબ કાર્ડ બદલો', mr: 'जॉब कार्ड बदला', mwr: 'जॉब कार्ड बदलो' },
  nameReq: { en: 'Client name is required', hi: 'क्लाइंट का नाम ज़रूरी है', hinglish: 'Client ka naam zaroori hai', gu: 'ક્લાયન્ટનું નામ જરૂરી', mr: 'क्लायंटचे नाव आवश्यक', mwr: 'क्लाइंट रो नाम जरूरी' },
  created: { en: 'Job card created', hi: 'जॉब कार्ड बन गया', hinglish: 'Job card ban gaya', gu: 'જોબ કાર્ડ બન્યું', mr: 'जॉब कार्ड तयार झाले', mwr: 'जॉब कार्ड बण ग्यो' },
  saved:   { en: 'Job card updated', hi: 'जॉब कार्ड अपडेट हुआ', hinglish: 'Job card update hua', gu: 'જોબ કાર્ડ અપડેટ થયું', mr: 'जॉब कार्ड अपडेट झाले', mwr: 'जॉब कार्ड अपडेट हुयो' },
  failed:  { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

function JobSection({ icon, title, children }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

const lbl = { fontSize: 12, color: 'var(--text2)', marginBottom: 3, display: 'block' };
const asArr = (d) => (Array.isArray(d) ? d : d ? Object.values(d) : []);
const idOf = (x) => x.id || x._id;

export default function NewJobModal({ onClose, onCreated, job, prefill, extra, createdBy }) {
  const t = useT(S);
  // `job` = correcting an existing card. Same form, because a second one would
  // drift from this one field by field.
  const isEdit = !!job;
  const BLANK = {
    clientName: '', clientMobile: '', clientEmail: '', address: '', gstNo: '', pan: '', creditLimit: '',
    work: '', notes: '', salesPerson: '', deliveryDate: '', priority: 'normal', designNeeded: 'yes',
    designerId: '', eventType: '', billNumber: '', amount: '', advance: '',
  };
  const [form, setForm] = useState(() => (job ? {
    ...BLANK,
    clientName: job.clientName || '', clientMobile: job.clientMobile || '',
    clientEmail: job.clientEmail || '', address: job.address || '',
    gstNo: job.gstNo || '', pan: job.pan || '',
    creditLimit: job.creditLimit != null ? String(job.creditLimit) : '',
    work: job.work || '', notes: job.notes || '', salesPerson: job.salesPerson || '',
    deliveryDate: job.deliveryDate || '', priority: job.priority || 'normal',
    // A job already past the designer must not be flung back into the pool by
    // an edit, so this is only meaningful while it is still at enquiry.
    designNeeded: (job.designNeeded || job.designerId) ? 'yes' : 'no',
    designerId: job.designerId || '',
    eventType: job.eventType || '', billNumber: job.billNumber || '',
    amount: job.amount != null ? String(job.amount) : '',
    advance: job.advance != null ? String(job.advance) : '',
    description: job.description || '',
  } : { ...BLANK, ...(prefill || {}) }));
  const [items, setItems] = useState(() => (Array.isArray(job && job.items) ? job.items : []));
  const [attachments, setAttachments] = useState(() => (Array.isArray(job && job.attachments) ? job.attachments : []));
  // Delivery time as 12-hour + AM/PM. Stored as "5:00 PM" to match the format
  // already used by every existing job (170 of 180 carried this shape).
  const parsedTime = (() => {
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String((job && job.deliveryTime) || '').trim());
    return m ? { h: m[1], m: m[2], ap: m[3].toUpperCase() } : { h: '', m: '', ap: 'PM' };
  })();
  const [dh, setDh] = useState(parsedTime.h); const [dm, setDm] = useState(parsedTime.m); const [dap, setDap] = useState(parsedTime.ap);
  const [showGst, setShowGst] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [clientQ, setClientQ] = useState('');
  const [clientMatches, setClientMatches] = useState([]);
  const [existingClient, setExistingClient] = useState(null);
  const [prodQty, setProdQty] = useState('');
  // One box that searches AND lists: it used to be a search field beside a
  // dropdown, so the list only narrowed if you typed BEFORE opening it — and
  // opening it first showed hundreds of products in DOM order.
  const [prodSearch, setProdSearch] = useState('');
  const [prodOpen, setProdOpen] = useState(false);
  const [picked, setPicked] = useState(null);   // the chosen product, if any
  const [addingProd, setAddingProd] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    // An existing card keeps its number; only a new one previews the next.
    if (isEdit) { setPreview(job.jobNo || ''); } else {
      ordersApi.nextNumber().then((r) => setPreview(r.jobNo)).catch(() => {});
    }
    ordersApi.lookups().then((d) => {
      setProducts(d.products || []);
      setSalespeople(d.salespeople || []);
      setDesigners(d.designers || []);
    }).catch(() => {});
  }, []);

  // Debounced, server-backed client autocomplete — searches after 2+ chars and
  // works for any job-card creator (independent of the Customers section grant).
  useEffect(() => {
    const q = clientQ.trim();
    if (q.length < 2) { setClientMatches([]); return undefined; }
    const id = setTimeout(() => {
      ordersApi.searchClients(q).then((r) => setClientMatches(Array.isArray(r) ? r : [])).catch(() => setClientMatches([]));
    }, 250);
    return () => clearTimeout(id);
  }, [clientQ]);

  const pickClient = (c) => {
    setForm((f) => ({ ...f, clientName: c.name || '', clientMobile: c.phone || '', clientEmail: c.email || '', address: c.address || '', gstNo: c.gstNo || '', pan: c.pan || '' }));
    setClientQ('');
    setExistingClient(c);
    if (c.gstNo || c.pan) setShowGst(true);
  };

  // Dismiss the returning-customer banner and blank the auto-filled identity so
  // the entered details can't silently belong to the previous client.
  const clearExistingClient = () => {
    setExistingClient(null);
    setForm((f) => ({ ...f, clientName: '', clientMobile: '', clientEmail: '', address: '', gstNo: '', pan: '' }));
  };

  // Matches on the typed text; an exact hit is not "no match", so the add-new
  // row cannot offer to create something that already exists.
  const prodQ = prodSearch.trim().toLowerCase();
  const prodMatches = products.filter((p) => !prodQ || String(p.name || p.title || '').toLowerCase().includes(prodQ));
  const exactProd = products.find((p) => String(p.name || p.title || '').trim().toLowerCase() === prodQ);
  const canAddProd = prodQ.length >= 2 && !exactProd;

  const choose = (p) => {
    setPicked(p);
    setProdSearch(p.name || p.title || '');
    setProdOpen(false);
  };

  // A product nobody has entered yet: add it to the list right here, rather
  // than sending someone to the Items screen (which they may not be allowed to
  // open) in the middle of writing a job card.
  const addNewProduct = async () => {
    const name = prodSearch.trim();
    if (!name) return;
    setAddingProd(true);
    try {
      const made = await ordersApi.createProduct(name);
      const p = { id: made.id, name: made.name };
      setProducts((arr) => (arr.some((x) => String(idOf(x)) === String(made.id)) ? arr : [...arr, p]));
      choose(p);
      showToast(made.created ? `${made.name} added to your products` : `${made.name} was already in your products`, 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not add that product', 'error');
    } finally { setAddingProd(false); }
  };

  const addItem = () => {
    // Whatever is typed counts, even without picking from the list — the line
    // then reads as loose text, exactly as it did before.
    const name = picked ? (picked.name || picked.title) : prodSearch.trim();
    if (!name) return;
    const p = picked;
    setItems((arr) => [...arr, { name, qty: Number(prodQty) || 1, productId: p ? idOf(p) : null }]);
    setPicked(null); setProdSearch(''); setProdQty('');
  };

  const suggestDate = () => {
    // Most urgent = same day; urgent = next day; otherwise size-based.
    const days = form.priority === 'most_urgent' ? 0
      : form.priority === 'urgent' ? 1
        : (items.length > 3 ? 5 : 3);
    const d = new Date(); d.setDate(d.getDate() + days);
    set('deliveryDate', d.toISOString().slice(0, 10));
  };
  const autoBill = () => set('billNumber', preview || ('BILL-' + String(Date.now()).slice(-6)));

  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    const room = 3 - attachments.length;
    if (!files.length || room <= 0) return;
    setUploading(true);
    try {
      for (const f of files.slice(0, room)) {
        const r = await uploadApi.upload(f);
        setAttachments((a) => [...a, r.url]);
      }
    } catch (err) { showToast(err.response?.data?.error || 'Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) return showToast(t('nameReq'), 'error');
    if (form.clientMobile && !/^\d{10}$/.test(form.clientMobile.trim())) return showToast('Enter a valid 10-digit mobile', 'error');
    setBusy(true);
    try {
      const hasDesigner = !!form.designerId;
      const isDesignNeeded = form.designNeeded === 'yes' || hasDesigner;
      const chosenDesigner = hasDesigner ? designers.find((d) => String(d.id) === String(form.designerId)) : null;

      const payload = {
        ...form,
        ...(extra || {}),
        designNeeded: isDesignNeeded,
        designerId: hasDesigner ? form.designerId : null,
        designerName: chosenDesigner ? chosenDesigner.name : null,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        amount: form.amount === '' ? null : Number(form.amount),
        advance: form.advance === '' ? null : Number(form.advance),
        items,
        attachments,
        deliveryTime: (dh !== '' && dm !== '') ? `${dh}:${dm} ${dap}` : null,
      };
      if (isEdit) {
        const saved = await ordersApi.update(job.id, payload);
        showToast(`${t('saved')} — ${saved.jobNo || job.jobNo}`, 'success');
      } else {
        const made = await ordersApi.create(payload);
        showToast(`${t('created')} — ${made.jobNo}`, 'success');
        onCreated?.(made);
      }
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 460, width: '100%', margin: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>📋 {isEdit ? t('editJob') : t('newJob')}</h3>
          {preview ? <span className="badge badge-green" style={{ fontFamily: 'monospace' }}>{preview}</span> : null}
        </div>

        {/* CUSTOMER DETAILS */}
        <JobSection icon="👤" title="Customer Details">
          <div className="form-group" style={{ position: 'relative' }}>
            <label style={lbl}>Search Existing Client (Mobile / Name / GST)</label>
            <input className="input" placeholder="Mobile number ya naam type karein..." value={clientQ} onChange={(e) => setClientQ(e.target.value)} />
            {clientMatches.length > 0 && (
              <div className="card" style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 180, overflow: 'auto' }}>
                {clientMatches.map((c) => (
                  <div key={c.id} onClick={() => pickClient(c)} style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b>{c.name || '—'}</b>
                      <span style={{ color: 'var(--text3)' }}>{c.phone || ''}</span>
                      {c.jobCount > 0 && (
                        <span className="badge badge-green" style={{ fontSize: 10 }}>
                          {c.jobCount} {c.jobCount === 1 ? 'job' : 'jobs'}
                        </span>
                      )}
                    </div>
                    {c.lastJobNo ? (
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                        Last: <b style={{ fontFamily: 'monospace' }}>{c.lastJobNo}</b>
                        {c.lastStage ? ` · ${c.lastStage}` : ''}
                      </div>
                    ) : null}
                    {(c.email || c.gstNo || c.address) ? (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{[c.email, c.gstNo, c.address].filter(Boolean).join(' · ')}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Returning-customer banner — makes it obvious the details were filled
              from an existing record, so nobody creates a near-duplicate client. */}
          {existingClient && (
            <div
              className="card"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                marginBottom: 10, background: 'var(--surface2)', borderLeft: '3px solid var(--green)',
              }}
            >
              <span style={{ fontSize: 18 }}>🔁</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Existing client — {existingClient.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {existingClient.jobCount > 0 ? (
                    <>
                      {existingClient.jobCount} total {existingClient.jobCount === 1 ? 'job' : 'jobs'}
                      {existingClient.lastJobNo ? (
                        <> · last <b style={{ fontFamily: 'monospace' }}>{existingClient.lastJobNo}</b>
                          {existingClient.lastStage ? ` (${existingClient.lastStage})` : ''}</>
                      ) : null}
                    </>
                  ) : 'No jobs yet — this will be their first.'}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={clearExistingClient}>Clear</button>
            </div>
          )}
          <div className="form-group">
            <label style={lbl}>Client Name *</label>
            <input className="input" placeholder="Client ka poora naam..." value={form.clientName} onChange={(e) => set('clientName', e.target.value)} autoFocus required />
          </div>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Mobile * (10 digits)</label>
              <input className="input" type="tel" placeholder="10 digit mobile..." value={form.clientMobile} onChange={(e) => set('clientMobile', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Address</label>
              <input className="input" placeholder="Client address..." value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label style={lbl}>Email</label>
            <input className="input" type="email" placeholder="email@example.com" value={form.clientEmail} onChange={(e) => set('clientEmail', e.target.value)} />
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowGst((v) => !v)}>
            {showGst ? '▲' : '▼'} GST / PAN / Credit Details (optional)
          </button>
          {showGst && (
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <div className="form-group" style={{ flex: 1 }}><label style={lbl}>GST No.</label><input className="input" value={form.gstNo} onChange={(e) => set('gstNo', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label style={lbl}>PAN</label><input className="input" value={form.pan} onChange={(e) => set('pan', e.target.value)} /></div>
              <div className="form-group" style={{ flex: 1 }}><label style={lbl}>Credit ₹</label><input className="input" type="number" min="0" value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value)} /></div>
            </div>
          )}
        </JobSection>

        {/* JOB DETAILS */}
        <JobSection icon="🗒" title="Job Details">
          <div className="form-group">
            <label style={lbl}>Work / Particulars (zaroori — ya neeche product select karein)</label>
            <textarea className="input" rows={3} placeholder={'Line 1: Flex banner 10x4 ft\nLine 2: Visiting cards 500 pcs'} value={form.work} onChange={(e) => set('work', e.target.value)} />
          </div>
          <div className="form-group">
            <label style={lbl}>🛍 Products/Items (optional — product list se select karein)</label>
            <div className="flex gap-2">
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  data-testid="product-search"
                  placeholder="🔍 Type to search, or a new product name"
                  value={prodSearch}
                  onFocus={() => setProdOpen(true)}
                  onChange={(e) => { setProdSearch(e.target.value); setPicked(null); setProdOpen(true); }}
                  onKeyDown={(e) => { if (e.key === 'Escape') setProdOpen(false); }}
                />
                {prodOpen && (
                  <div
                    className="card"
                    data-testid="product-list"
                    style={{ position: 'absolute', zIndex: 6, left: 0, right: 0, top: '100%', marginTop: 2, padding: 0, maxHeight: 220, overflow: 'auto' }}
                  >
                    {prodMatches.slice(0, 50).map((p) => (
                      <div
                        key={idOf(p)}
                        data-testid="product-option"
                        onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                        style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
                      >
                        {p.name || p.title}
                      </div>
                    ))}
                    {!prodMatches.length && !canAddProd && (
                      <div style={{ padding: '8px 10px', fontSize: 12.5, color: 'var(--text3)' }}>No product matches that.</div>
                    )}
                    {canAddProd && (
                      <div
                        data-testid="product-add-new"
                        onMouseDown={(e) => { e.preventDefault(); addNewProduct(); }}
                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--primary, #2563EB)', background: 'var(--surface2)' }}
                      >
                        {addingProd ? 'Adding…' : `+ Add "${prodSearch.trim()}" to your products`}
                        <span style={{ display: 'block', fontWeight: 400, fontSize: 11, color: 'var(--text3)' }}>
                          so it is on the list next time
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input className="input" style={{ width: 70 }} type="number" min="1" placeholder="Qty" value={prodQty} onChange={(e) => setProdQty(e.target.value)} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addItem}>+ Add</button>
            </div>
            {/* Clicking away closes the list without stealing the click that
                chose an option (hence onMouseDown above). */}
            {prodOpen && (
              <div onClick={() => setProdOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
            )}
            {items.map((it, i) => (
              <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, padding: '4px 0' }}>
                <span>• {it.name} × {it.qty}</span>
                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))}>✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Special Notes</label>
              <input className="input" placeholder="Any special instructions..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Sales Person</label>
              <input className="input" list="np-salespeople" placeholder="Sales person ka naam" value={form.salesPerson} onChange={(e) => set('salesPerson', e.target.value)} />
              <datalist id="np-salespeople">{salespeople.map((u) => <option key={idOf(u)} value={u.name || u.email} />)}</datalist>
            </div>
          </div>
          {/* Order value and what was taken up front. Part of the job card in
              the data model all along, but there was nowhere to enter them —
              they only survived an edit. Without the amount a job raised from a
              shop visit records a ₹0 order, which is exactly the number the
              rep's own dashboard adds up. The invoice later carries the real
              money; this is what was agreed at the shop. */}
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Order Amount ₹</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0" data-testid="job-amount"
                value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Advance ₹</label>
              <input className="input" type="number" min="0" step="0.01" placeholder="0" data-testid="job-advance"
                value={form.advance} onChange={(e) => set('advance', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Delivery Date *
                <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 6 }} onClick={suggestDate}>⚡ AI Suggest</button>
              </label>
              <input className="input" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
            </div>
            <div className="form-group" style={{ width: 190 }}>
              <label style={lbl}>Delivery Time</label>
              <div className="flex gap-2">
                <select className="input" value={dh} onChange={(e) => setDh(e.target.value)}>
                  <option value="">Hr</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select className="input" value={dm} onChange={(e) => setDm(e.target.value)}>
                  <option value="">Min</option>
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="input" value={dap} onChange={(e) => setDap(e.target.value)}>
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              {(dh !== '' && dm !== '') ? (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  Delivery by <b>{dh}:{dm} {dap}</b>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgent">⚡ Urgent</option>
                <option value="most_urgent">🔥 Most Urgent</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Design Required?</label>
              <select className="input" value={form.designNeeded} onChange={(e) => {
                const v = e.target.value;
                set('designNeeded', v);
                if (v === 'no') set('designerId', '');
              }}>
                <option value="yes">Yes — Design banana hai</option>
                <option value="no">No — Ready design (→ Job Setter)</option>
              </select>
            </div>
          </div>
          {form.designNeeded === 'yes' && (
            <div className="form-group">
              <label style={lbl}>Assign Designer (optional)</label>
              <select className="input" value={form.designerId || ''} onChange={(e) => set('designerId', e.target.value)}>
                <option value="">Broadcast to All Designers (Open Pool)</option>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Event Type</label>
              <input className="input" placeholder="e.g. Wedding, Birthday, Corporate" value={form.eventType} onChange={(e) => set('eventType', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Bill Number (optional)
                <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 6 }} onClick={autoBill}>⚡ Auto</button>
              </label>
              <input className="input" placeholder="e.g. BILL-001" value={form.billNumber} onChange={(e) => set('billNumber', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label style={lbl}>📎 Reference Images (optional)</label>
            <input id="np-images" type="file" accept="image/jpeg,image/png" multiple style={{ display: 'none' }} onChange={onPickImages} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => document.getElementById('np-images').click()} disabled={uploading || attachments.length >= 3}>
              {uploading ? 'Uploading…' : `🖼 Click to add images (max 3, JPG/PNG)`}
            </button>
            {attachments.length > 0 && (
              <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                {attachments.map((u, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={u} alt="ref" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                    <button type="button" onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </JobSection>

        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? '…' : `✅ ${t('create')}`}</button>
        </div>
      </form>
    </div>
  );
}
