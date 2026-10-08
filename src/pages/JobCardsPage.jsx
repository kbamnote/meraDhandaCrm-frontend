/**
 * Job Cards / Enquiry — create orders and drive them through the 7-stage workflow.
 *
 * Create + stage transitions go through the backend order-workflow engine
 * (ordersApi → routes/orders.js): financial-year job numbering (PW-2526-####),
 * customer auto-add, validated stage moves + audit history + notifications.
 * The job LIST is read live from `mpw/jobs` via the realtime shim.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DATE_PRESETS, presetRange, inDateRange, isoDay } from '../utils/jobDateFilter';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi, dbApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import NewJobModal from '../components/common/NewJobModal';
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
// Kept in step with JOB_EDIT_ROLES in the backend's orders route.
const JOB_EDIT_ROLES = ['owner', 'admin', 'superadmin', 'manager', 'floor_manager'];
// Label key for each date preset.
const PRESET_KEY = { all: 'pAll', today: 'pToday', yesterday: 'pYesterday', last7: 'pLast7', thisMonth: 'pThisMonth', lastMonth: 'pLastMonth', custom: 'pCustom' };

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
  edit:        { en: 'Edit', hi: 'बदलें', hinglish: 'Edit', gu: 'સંપાદિત', mr: 'बदला', mwr: 'बदलो' },
  editJob:     { en: 'Edit job card', hi: 'जॉब कार्ड बदलें', hinglish: 'Job card edit karein', gu: 'જોબ કાર્ડ સંપાદિત કરો', mr: 'जॉब कार्ड बदला', mwr: 'जॉब कार्ड बदलो' },
  saved:       { en: 'Job card updated', hi: 'जॉब कार्ड अपडेट हुआ', hinglish: 'Job card update ho gaya', gu: 'જોબ કાર્ડ અપડેટ થયું', mr: 'जॉब कार्ड अपडेट झाले', mwr: 'जॉब कार्ड अपडेट हुयो' },
  created:     { en: 'Job card created', hi: 'जॉब कार्ड बन गया', hinglish: 'Job card ban gaya', gu: 'જોબ કાર્ડ બન્યો', mr: 'जॉब कार्ड तयार झाले', mwr: 'जॉब कार्ड बण ग्यो' },
  moved:       { en: 'Stage updated', hi: 'स्टेज अपडेट हुई', hinglish: 'Stage update hui', gu: 'સ્ટેજ અપડેટ થઈ', mr: 'स्टेज अपडेट झाली', mwr: 'स्टेज अपडेट हुई' },
  reasonPrompt:{ en: 'Reason for hold / cancel?', hi: 'होल्ड / कैंसिल का कारण?', hinglish: 'Hold / cancel ka reason?', gu: 'હોલ્ડ / કેન્સલનું કારણ?', mr: 'होल्ड / कॅन्सलचे कारण?', mwr: 'होल्ड / कैंसिल रो कारण?' },
  failed:      { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  willBe:      { en: 'Job number', hi: 'जॉब नंबर', hinglish: 'Job number', gu: 'જોબ નંબર', mr: 'जॉब नंबर', mwr: 'जॉब नंबर' },
  normal:      { en: 'Normal', hi: 'सामान्य', hinglish: 'Normal', gu: 'સામાન્ય', mr: 'सामान्य', mwr: 'सामान्य' },
  urgent:      { en: '⚡ Urgent', hi: '⚡ अर्जेंट', hinglish: '⚡ Urgent', gu: '⚡ અર્જન્ટ', mr: '⚡ तातडीचे', mwr: '⚡ अर्जेंट' },
  dateBy:      { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  byCreated:   { en: 'Created on', hi: 'बनाने की तारीख', hinglish: 'Created on', gu: 'બનાવ્યાની તારીખ', mr: 'तयार केल्याची तारीख', mwr: 'बणावण री तारीख' },
  byDelivery:  { en: 'Delivery date', hi: 'डिलीवरी तारीख', hinglish: 'Delivery date', gu: 'ડિલિવરી તારીખ', mr: 'डिलिव्हरी तारीख', mwr: 'डिलीवरी तारीख' },
  pAll:        { en: 'All dates', hi: 'सभी तारीखें', hinglish: 'All dates', gu: 'બધી તારીખો', mr: 'सर्व तारखा', mwr: 'सगळी तारीखां' },
  pToday:      { en: 'Today', hi: 'आज', hinglish: 'Today', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  pYesterday:  { en: 'Yesterday', hi: 'कल', hinglish: 'Yesterday', gu: 'ગઈકાલે', mr: 'काल', mwr: 'काल' },
  pLast7:      { en: 'Last 7 days', hi: 'पिछले 7 दिन', hinglish: 'Last 7 days', gu: 'છેલ્લા 7 દિવસ', mr: 'मागील 7 दिवस', mwr: 'पाछला 7 दिन' },
  pThisMonth:  { en: 'This month', hi: 'इस महीने', hinglish: 'This month', gu: 'આ મહિને', mr: 'हा महिना', mwr: 'इण महीने' },
  pLastMonth:  { en: 'Last month', hi: 'पिछला महीना', hinglish: 'Last month', gu: 'ગયા મહિને', mr: 'मागील महिना', mwr: 'पाछलो महीनो' },
  pCustom:     { en: 'Custom…', hi: 'कस्टम…', hinglish: 'Custom…', gu: 'કસ્ટમ…', mr: 'कस्टम…', mwr: 'कस्टम…' },
  from:        { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to:          { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  showing:     { en: 'showing', hi: 'दिखा रहे', hinglish: 'showing', gu: 'બતાવી રહ્યા', mr: 'दाखवत आहे', mwr: 'दिखा रया' },
  openDetail:  { en: 'Open job details', hi: 'जॉब का विवरण खोलें', hinglish: 'Job details kholein', gu: 'જોબની વિગતો ખોલો', mr: 'जॉबचा तपशील उघडा', mwr: 'जॉब री जाणकारी खोलो' },
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
  // Same rule the server enforces: changing what a card SAYS after people have
  // started work is a supervisor's call. A button that is always refused is
  // worse than no button, so it is hidden for everyone else.
  const canEdit = JOB_EDIT_ROLES.includes(profile?.role)
    || JOB_EDIT_ROLES.includes(String(profile?.customRole || '').toLowerCase());
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  // Date filter: which date to look at, a preset, and the custom range.
  const [dateField, setDateField] = useState('created');
  const [datePreset, setDatePreset] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [showNew, setShowNew] = useState(false);
  const [assignJob, setAssignJob] = useState(null);
  // The job card being corrected — the same form the job was raised with.
  const [editJob, setEditJob] = useState(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => u();
  }, []);

  const all = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [jobs]
  );

  const today = isoDay(new Date());
  const range = datePreset === 'custom' ? custom : presetRange(datePreset, today);
  // Jobs in the chosen date range. The stage chips count within it, so they
  // answer "how many of THESE are in production" rather than all-time totals.
  const dated = useMemo(
    () => all.filter((j) => inDateRange(j, dateField, range.from, range.to)),
    [all, dateField, range.from, range.to]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dated.filter((j) => {
      if (stageFilter !== 'all' && j.stage !== stageFilter) return false;
      if (!q) return true;
      return (j.jobNo || '').toLowerCase().includes(q) ||
        (j.clientName || '').toLowerCase().includes(q) ||
        (j.clientMobile || '').includes(q) ||
        (j.work || '').toLowerCase().includes(q);
    });
  }, [dated, search, stageFilter]);

  const counts = useMemo(() => {
    const c = {};
    dated.forEach((j) => { c[j.stage] = (c[j.stage] || 0) + 1; });
    return c;
  }, [dated]);
  const dateActive = !!(range.from || range.to);

  // A card opens the job's full detail; the stage is changed there ("Move to"),
  // with the reason that holding / cancelling needs.
  const navigate = useNavigate();
  const openJob = (job) => navigate(`/job-view?id=${encodeURIComponent(job.id)}&manage=1`);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }} data-testid="job-total">
            {all.length} total{dateActive || stageFilter !== 'all' || search.trim() ? ` · ${t('showing')} ${filtered.length}` : ''}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newJob')}</button>
      </div>

      <input className="input mb-4" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />

      {/* Date filter — by the day the job was created, or its delivery date. */}
      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>📅 {t('dateBy')}</span>
        <select className="input" data-testid="date-field" style={{ maxWidth: 150 }} value={dateField} onChange={(e) => setDateField(e.target.value)}>
          <option value="created">{t('byCreated')}</option>
          <option value="delivery">{t('byDelivery')}</option>
        </select>
        <select className="input" data-testid="date-preset" style={{ maxWidth: 150 }} value={datePreset}
          onChange={(e) => {
            const v = e.target.value;
            // Starting a custom range from the preset that was showing saves retyping.
            if (v === 'custom' && datePreset !== 'custom') setCustom(presetRange(datePreset, today) || { from: '', to: '' });
            setDatePreset(v);
          }}>
          {DATE_PRESETS.map((p) => <option key={p} value={p}>{t(PRESET_KEY[p])}</option>)}
        </select>
        {datePreset === 'custom' && (
          <>
            <input type="date" className="input" data-testid="date-from" aria-label={t('from')} style={{ maxWidth: 160 }}
              value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span style={{ color: 'var(--text3)' }}>→</span>
            <input type="date" className="input" data-testid="date-to" aria-label={t('to')} style={{ maxWidth: 160 }}
              value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </>
        )}
        {dateActive && (
          <button className="btn btn-ghost btn-xs" onClick={() => { setDatePreset('all'); setCustom({ from: '', to: '' }); }}>✕</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        <Chip active={stageFilter === 'all'} onClick={() => setStageFilter('all')} label={`${t('all')} (${dated.length})`} />
        {ALL_STAGES.map((s) => (
          <Chip key={s} active={stageFilter === s} onClick={() => setStageFilter(s)}
            label={`${STAGE_META[s].emoji} ${STAGE_META[s].label} (${counts[s] || 0})`} color={STAGE_META[s].color} />
        ))}
      </div>

      {!filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      )}

      {filtered.map((job) => (
        <div key={job.id} className="card" data-testid="job-card" role="button" tabIndex={0}
          title={t('openDetail')}
          onClick={() => openJob(job)}
          onKeyDown={(e) => { if (e.key === 'Enter') openJob(job); }}
          style={{ marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{job.jobNo || '—'}</span>
                <StageBadge stage={job.stage} />
                {job.priority === 'most_urgent' && <span className="badge badge-red">🔥</span>}
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
            {/* Buttons act on their own, without also opening the job. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
              {/* Details only — the stage is moved from the job's detail page
                  (click the card). A closed job is not editable, so the button
                  is hidden rather than offered and then refused. */}
              {canEdit && job.stage !== 'delivered' && job.stage !== 'cancelled' && (
                <button className="btn btn-xs btn-ghost" data-testid="edit-job" onClick={() => setEditJob(job)}>
                  ✏️ {t('edit')}
                </button>
              )}
              {PRE_PRODUCTION.includes(job.stage) && (
                <button className="btn btn-xs" onClick={() => setAssignJob(job)}
                  style={{ background: 'var(--blue, #C05621)', color: '#fff', border: 'none' }}>🏭 {t('assignProd')}</button>
              )}
            </div>
          </div>
        </div>
      ))}

      {showNew && <NewJobModal onClose={() => setShowNew(false)} createdBy={profile?.id} />}
      {editJob && <NewJobModal job={editJob} onClose={() => setEditJob(null)} createdBy={profile?.id} />}
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

