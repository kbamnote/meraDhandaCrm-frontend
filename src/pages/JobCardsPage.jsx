/**
 * Job Cards / Enquiry — create orders and drive them through the 7-stage workflow.
 *
 * Create + stage transitions go through the backend order-workflow engine
 * (ordersApi → routes/orders.js): financial-year job numbering (PW-2526-####),
 * customer auto-add, validated stage moves + audit history + notifications.
 * The job LIST is read live from `mpw/jobs` via the realtime shim.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi, dbApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import AssignProductionModal from '../components/common/AssignProductionModal';

// Stages from which a job can still be sent into production.
const PRE_PRODUCTION = ['enquiry', 'designer', 'jobsetter'];

const STAGES = ['enquiry', 'designer', 'jobsetter', 'production', 'qc', 'dispatch', 'delivered'];
const STAGE_META = {
  enquiry:    { label: 'Enquiry',   emoji: '❓', color: '#6B7280' },
  designer:   { label: 'Designer',  emoji: '🎨', color: '#8B5CF6' },
  jobsetter:  { label: 'Job Setter', emoji: '🛠', color: '#0EA5E9' },
  production: { label: 'Production', emoji: '🏭', color: '#F59E0B' },
  qc:         { label: 'QC',        emoji: '🔍', color: '#CA8A04' },
  dispatch:   { label: 'Dispatch',  emoji: '🚚', color: '#3B82F6' },
  delivered:  { label: 'Delivered', emoji: '✅', color: '#16A34A' },
  hold:       { label: 'Hold',      emoji: '⏸', color: '#9CA3AF' },
  cancelled:  { label: 'Cancelled', emoji: '✖', color: '#DC2626' },
};
const ALL_STAGES = [...STAGES, 'hold', 'cancelled'];

const S = {
  title:       { en: '📋 Job Cards', hi: '📋 जॉब कार्ड', hinglish: '📋 Job Cards', gu: '📋 જોબ કાર્ડ', mr: '📋 जॉब कार्ड', mwr: '📋 जॉब कार्ड' },
  newJob:      { en: '+ New Job Card', hi: '+ नया जॉब कार्ड', hinglish: '+ Naya Job Card', gu: '+ નવો જોબ કાર્ડ', mr: '+ नवीन जॉब कार्ड', mwr: '+ नयो जॉब कार्ड' },
  search:      { en: '🔍 Search by job no, client…', hi: '🔍 जॉब नंबर, क्लाइंट से खोजें…', hinglish: '🔍 Job no, client se search…', gu: '🔍 જોબ નં, ક્લાયન્ટથી શોધો…', mr: '🔍 जॉब नं, क्लायंट शोधा…', mwr: '🔍 जॉब नं, क्लाइंट सूं ढूंढो…' },
  all:         { en: 'All', hi: 'सभी', hinglish: 'All', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
  none:        { en: 'No job cards yet.', hi: 'अभी कोई जॉब कार्ड नहीं।', hinglish: 'Abhi koi job card nahi.', gu: 'હજુ કોઈ જોબ કાર્ડ નથી.', mr: 'अद्याप जॉब कार्ड नाही.', mwr: 'अजे कोई जॉब कार्ड कोनी।' },
  client:      { en: 'Client name', hi: 'क्लाइंट का नाम', hinglish: 'Client ka naam', gu: 'ક્લાયન્ટનું નામ', mr: 'क्लायंटचे नाव', mwr: 'क्लाइंट रो नाम' },
  mobile:      { en: 'Mobile', hi: 'मोबाइल', hinglish: 'Mobile', gu: 'મોબાઇલ', mr: 'मोबाइल', mwr: 'मोबाइल' },
  work:        { en: 'Work / description', hi: 'काम / विवरण', hinglish: 'Kaam / description', gu: 'કામ / વર્ણન', mr: 'काम / वर्णन', mwr: 'काम / विवरण' },
  delivery:    { en: 'Delivery date', hi: 'डिलीवरी तारीख', hinglish: 'Delivery date', gu: 'ડિલિવરી તારીખ', mr: 'डिलिव्हरी तारीख', mwr: 'डिलीवरी तारीख' },
  amount:      { en: 'Amount (₹)', hi: 'राशि (₹)', hinglish: 'Amount (₹)', gu: 'રકમ (₹)', mr: 'रक्कम (₹)', mwr: 'रकम (₹)' },
  priority:    { en: 'Priority', hi: 'प्राथमिकता', hinglish: 'Priority', gu: 'પ્રાયોરિટી', mr: 'प्राधान्य', mwr: 'प्राथमिकता' },
  designNeeded:{ en: 'Design needed', hi: 'डिज़ाइन चाहिए', hinglish: 'Design needed', gu: 'ડિઝાઇન જોઈએ', mr: 'डिझाइन हवे', mwr: 'डिज़ाइन चाइजे' },
  moveTo:      { en: 'Move to', hi: 'भेजें', hinglish: 'Move to', gu: 'ખસેડો', mr: 'हलवा', mwr: 'भेजो' },
  assignProd:  { en: 'Assign', hi: 'सौंपें', hinglish: 'Assign', gu: 'સોંપો', mr: 'नेमा', mwr: 'सौंपो' },
  create:      { en: 'Create job card', hi: 'जॉब कार्ड बनाएं', hinglish: 'Job card banayein', gu: 'જોબ કાર્ડ બનાવો', mr: 'जॉब कार्ड तयार करा', mwr: 'जॉब कार्ड बणावो' },
  cancel:      { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  nameReq:     { en: 'Client name is required', hi: 'क्लाइंट का नाम ज़रूरी है', hinglish: 'Client ka naam zaroori hai', gu: 'ક્લાયન્ટનું નામ જરૂરી છે', mr: 'क्लायंटचे नाव आवश्यक', mwr: 'क्लाइंट रो नाम जरूरी है' },
  created:     { en: 'Job card created', hi: 'जॉब कार्ड बन गया', hinglish: 'Job card ban gaya', gu: 'જોબ કાર્ડ બન્યો', mr: 'जॉब कार्ड तयार झाले', mwr: 'जॉब कार्ड बण ग्यो' },
  moved:       { en: 'Stage updated', hi: 'स्टेज अपडेट हुई', hinglish: 'Stage update hui', gu: 'સ્ટેજ અપડેટ થઈ', mr: 'स्टेज अपडेट झाली', mwr: 'स्टेज अपडेट हुई' },
  reasonPrompt:{ en: 'Reason for hold / cancel?', hi: 'होल्ड / कैंसिल का कारण?', hinglish: 'Hold / cancel ka reason?', gu: 'હોલ્ડ / કેન્સલનું કારણ?', mr: 'होल्ड / कॅन्सलचे कारण?', mwr: 'होल्ड / कैंसिल रो कारण?' },
  failed:      { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  willBe:      { en: 'Job number', hi: 'जॉब नंबर', hinglish: 'Job number', gu: 'જોબ નંબર', mr: 'जॉब नंबर', mwr: 'जॉब नंबर' },
  normal:      { en: 'Normal', hi: 'सामान्य', hinglish: 'Normal', gu: 'સામાન્ય', mr: 'सामान्य', mwr: 'सामान्य' },
  urgent:      { en: '⚡ Urgent', hi: '⚡ अर्जेंट', hinglish: '⚡ Urgent', gu: '⚡ અર્જન્ટ', mr: '⚡ तातडीचे', mwr: '⚡ अर्जेंट' },
};

function StageBadge({ stage }) {
  const m = STAGE_META[stage] || STAGE_META.enquiry;
  return (
    <span style={{ background: m.color, color: '#fff', fontSize: 11, padding: '2px 9px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {m.emoji} {m.label}
    </span>
  );
}

export default function JobCardsPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [assignJob, setAssignJob] = useState(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => u();
  }, []);

  const all = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [jobs]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((j) => {
      if (stageFilter !== 'all' && j.stage !== stageFilter) return false;
      if (!q) return true;
      return (j.jobNo || '').toLowerCase().includes(q) ||
        (j.clientName || '').toLowerCase().includes(q) ||
        (j.clientMobile || '').includes(q) ||
        (j.work || '').toLowerCase().includes(q);
    });
  }, [all, search, stageFilter]);

  const counts = useMemo(() => {
    const c = {};
    all.forEach((j) => { c[j.stage] = (c[j.stage] || 0) + 1; });
    return c;
  }, [all]);

  const move = async (job, to) => {
    if (!to || to === job.stage) return;
    // Hold / cancel require a reason (the backend enforces this).
    let note = null;
    if (to === 'hold' || to === 'cancelled') {
      note = window.prompt(t('reasonPrompt'));
      if (!note || !note.trim()) return;
      note = note.trim();
    }
    try {
      // QC → Production means a reject: reset production progress.
      const resetSteps = job.stage === 'qc' && to === 'production';
      await ordersApi.transition(job.id, { to, resetSteps, note });
      showToast(t('moved'), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{all.length} total</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newJob')}</button>
      </div>

      <input className="input mb-4" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip active={stageFilter === 'all'} onClick={() => setStageFilter('all')} label={`${t('all')} (${all.length})`} />
        {STAGES.map((s) => (
          <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}
            label={`${STAGE_META[s].emoji} ${STAGE_META[s].label} (${counts[s] || 0})`} color={STAGE_META[s].color} />
        ))}
      </div>

      {!filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      )}

      {filtered.map((job) => (
        <div key={job.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{job.jobNo || '—'}</span>
                <StageBadge stage={job.stage} />
                {job.priority === 'urgent' && <span className="badge badge-amber">⚡</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{job.clientName}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {job.clientMobile && <span>📱 {job.clientMobile} · </span>}
                {job.work || '—'}
                {job.deliveryDate && <span> · 📅 {job.deliveryDate}</span>}
                {job.amount ? <span> · ₹{job.amount}</span> : null}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {PRE_PRODUCTION.includes(job.stage) && (
                <button className="btn btn-xs" onClick={() => setAssignJob(job)}
                  style={{ background: 'var(--blue, #C05621)', color: '#fff', border: 'none' }}>🏭 {t('assignProd')}</button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('moveTo')}</span>
              <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value="" onChange={(e) => move(job, e.target.value)}>
                <option value="">—</option>
                {ALL_STAGES.filter((s) => s !== job.stage).map((s) => (
                  <option key={s} value={s}>{STAGE_META[s].emoji} {STAGE_META[s].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}

      {showNew && <NewJobModal onClose={() => setShowNew(false)} t={t} createdBy={profile?.id} />}
      {assignJob && (
        <AssignProductionModal jobId={assignJob.id} jobNo={assignJob.jobNo} onClose={() => setAssignJob(null)} />
      )}
    </div>
  );
}

function Chip({ active, onClick, label, color }) {
  return (
    <button onClick={onClick} className="btn btn-xs"
      style={{
        background: active ? (color || 'var(--blue, #C05621)') : 'var(--surface2)',
        color: active ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14, fontWeight: 600,
      }}>
      {label}
    </button>
  );
}

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

function NewJobModal({ onClose, t }) {
  const BLANK = {
    clientName: '', clientMobile: '', clientEmail: '', address: '', gstNo: '', pan: '', creditLimit: '',
    work: '', notes: '', salesPerson: '', deliveryDate: '', priority: 'normal', designNeeded: 'yes',
    eventType: '', billNumber: '',
  };
  const [form, setForm] = useState(BLANK);
  const [items, setItems] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [dh, setDh] = useState(''); const [dm, setDm] = useState('');
  const [showGst, setShowGst] = useState(false);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [clientQ, setClientQ] = useState('');
  const [clientMatches, setClientMatches] = useState([]);
  const [prodSel, setProdSel] = useState(''); const [prodQty, setProdQty] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    ordersApi.nextNumber().then((r) => setPreview(r.jobNo)).catch(() => {});
    ordersApi.lookups().then((d) => { setProducts(d.products || []); setSalespeople(d.salespeople || []); }).catch(() => {});
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
    if (c.gstNo || c.pan) setShowGst(true);
  };

  const addItem = () => {
    if (!prodSel) return;
    const p = products.find((x) => String(idOf(x)) === String(prodSel));
    setItems((arr) => [...arr, { name: p ? (p.name || p.title) : prodSel, qty: Number(prodQty) || 1, productId: p ? idOf(p) : null }]);
    setProdSel(''); setProdQty('');
  };

  const suggestDate = () => {
    const days = form.priority === 'urgent' ? 1 : (items.length > 3 ? 5 : 3);
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
      const job = await ordersApi.create({
        ...form,
        designNeeded: form.designNeeded === 'yes',
        creditLimit: form.creditLimit ? Number(form.creditLimit) : null,
        items,
        attachments,
        deliveryTime: (dh !== '' && dm !== '') ? `${String(dh).padStart(2, '0')}:${dm}` : null,
      });
      showToast(`${t('created')} — ${job.jobNo}`, 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 460, width: '100%', margin: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>📋 {t('newJob')}</h3>
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
                    <div style={{ fontSize: 13 }}><b>{c.name || '—'}</b> <span style={{ color: 'var(--text3)' }}>{c.phone || ''}</span></div>
                    {(c.email || c.gstNo || c.address) ? (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{[c.email, c.gstNo, c.address].filter(Boolean).join(' · ')}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
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
              <select className="input" style={{ flex: 1 }} value={prodSel} onChange={(e) => setProdSel(e.target.value)}>
                <option value="">— Product select karein —</option>
                {products.map((p) => <option key={idOf(p)} value={idOf(p)}>{p.name || p.title}</option>)}
              </select>
              <input className="input" style={{ width: 70 }} type="number" min="1" placeholder="Qty" value={prodQty} onChange={(e) => setProdQty(e.target.value)} />
              <button type="button" className="btn btn-primary btn-sm" onClick={addItem}>+ Add</button>
            </div>
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
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Delivery Date *
                <button type="button" className="btn btn-ghost btn-xs" style={{ marginLeft: 6 }} onClick={suggestDate}>⚡ AI Suggest</button>
              </label>
              <input className="input" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
            </div>
            <div className="form-group" style={{ width: 130 }}>
              <label style={lbl}>Delivery Time</label>
              <div className="flex gap-2">
                <select className="input" value={dh} onChange={(e) => setDh(e.target.value)}>
                  <option value="">--</option>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
                <select className="input" value={dm} onChange={(e) => setDm(e.target.value)}>
                  <option value="">--</option>
                  {['00', '15', '30', '45'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Priority</label>
              <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgent">⚡ Urgent</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label style={lbl}>Design Required?</label>
              <select className="input" value={form.designNeeded} onChange={(e) => set('designNeeded', e.target.value)}>
                <option value="yes">Yes — Design banana hai</option>
                <option value="no">No — Ready design</option>
              </select>
            </div>
          </div>
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
