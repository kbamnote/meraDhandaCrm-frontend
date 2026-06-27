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
import { ordersApi } from '../services/api';
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

function NewJobModal({ onClose, t }) {
  const [form, setForm] = useState({ clientName: '', clientMobile: '', work: '', deliveryDate: '', amount: '', priority: 'normal', designNeeded: true });
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { ordersApi.nextNumber().then((r) => setPreview(r.jobNo)).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.clientName.trim()) return showToast(t('nameReq'), 'error');
    setBusy(true);
    try {
      const job = await ordersApi.create({
        ...form,
        amount: form.amount ? Number(form.amount) : null,
      });
      showToast(`${t('created')} — ${job.jobNo}`, 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 4 }}>{t('newJob')}</h3>
        {preview && (
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            {t('willBe')}: <b style={{ fontFamily: 'monospace', color: 'var(--blue, #C05621)' }}>{preview}</b>
          </div>
        )}

        <div className="form-group">
          <label>{t('client')} *</label>
          <input className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} autoFocus required />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('mobile')}</label>
            <input className="input" type="tel" value={form.clientMobile} onChange={(e) => set('clientMobile', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('delivery')}</label>
            <input className="input" type="date" value={form.deliveryDate} onChange={(e) => set('deliveryDate', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>{t('work')}</label>
          <textarea className="input" rows={2} value={form.work} onChange={(e) => set('work', e.target.value)} />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('amount')}</label>
            <input className="input" type="number" min="0" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('priority')}</label>
            <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="normal">{t('normal')}</option>
              <option value="urgent">{t('urgent')}</option>
            </select>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12 }}>
          <input type="checkbox" checked={form.designNeeded} onChange={(e) => set('designNeeded', e.target.checked)} />
          {t('designNeeded')}
        </label>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? '…' : t('create')}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
