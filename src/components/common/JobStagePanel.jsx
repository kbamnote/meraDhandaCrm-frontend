/**
 * JobStagePanel — the top of the Job View page: where the job is now, and for a
 * cancelled / on-hold job, who did it, when and why. With `canMove` (opened
 * from Job Cards) it also carries the "Move to…" control that used to sit on
 * every job card; holding or cancelling asks for a reason, which the server
 * requires and records against the person who did it.
 */
import { useState } from 'react';
import { ordersApi } from '../../services/api';
import { showToast } from './toast';
import { useT } from '../../i18n/LanguageContext';

export const STAGE_META = {
  enquiry:    { label: 'Enquiry',    emoji: '❓', color: '#6B7280' },
  designer:   { label: 'Designer',   emoji: '🎨', color: '#8B5CF6' },
  jobsetter:  { label: 'Job Setter', emoji: '🛠', color: '#0EA5E9' },
  production: { label: 'Production', emoji: '🏭', color: '#F59E0B' },
  qc:         { label: 'QC',         emoji: '🔍', color: '#CA8A04' },
  dispatch:   { label: 'Dispatch',   emoji: '🚚', color: '#3B82F6' },
  delivered:  { label: 'Delivered',  emoji: '✅', color: '#16A34A' },
  hold:       { label: 'Hold',       emoji: '⏸', color: '#9CA3AF' },
  cancelled:  { label: 'Cancelled',  emoji: '✖', color: '#DC2626' },
};
export const MOVE_STAGES = ['enquiry', 'designer', 'jobsetter', 'production', 'qc', 'dispatch', 'delivered', 'hold', 'cancelled'];
const NEEDS_REASON = new Set(['hold', 'cancelled']);

const S = {
  currentStage: { en: 'Current stage', hi: 'मौजूदा स्टेज', hinglish: 'Current stage', gu: 'હાલનો સ્ટેજ', mr: 'सध्याचा टप्पा', mwr: 'अबार रो स्टेज' },
  cancelledBy:  { en: 'Cancelled by', hi: 'कैंसिल किया', hinglish: 'Cancelled by', gu: 'કેન્સલ કર્યું', mr: 'कॅन्सल केले', mwr: 'कैंसिल कियो' },
  heldBy:       { en: 'Put on hold by', hi: 'होल्ड किया', hinglish: 'Hold kiya by', gu: 'હોલ્ડ કર્યું', mr: 'होल्ड केले', mwr: 'होल्ड कियो' },
  reason:       { en: 'Reason', hi: 'कारण', hinglish: 'Reason', gu: 'કારણ', mr: 'कारण', mwr: 'कारण' },
  unknown:      { en: 'unknown', hi: 'अज्ञात', hinglish: 'unknown', gu: 'અજ્ઞાત', mr: 'अज्ञात', mwr: 'अणजाण' },
  moveTo:       { en: 'Move to', hi: 'भेजें', hinglish: 'Move to', gu: 'ખસેડો', mr: 'हलवा', mwr: 'भेजो' },
  move:         { en: 'Move', hi: 'भेजें', hinglish: 'Move', gu: 'ખસેડો', mr: 'हलवा', mwr: 'भेजो' },
  choose:       { en: '— choose stage —', hi: '— स्टेज चुनें —', hinglish: '— stage chunein —', gu: '— સ્ટેજ પસંદ કરો —', mr: '— टप्पा निवडा —', mwr: '— स्टेज चुणो —' },
  reasonNeeded: { en: 'Reason (required for hold / cancel)', hi: 'कारण (होल्ड / कैंसिल के लिए ज़रूरी)', hinglish: 'Reason (hold / cancel ke liye zaroori)', gu: 'કારણ (હોલ્ડ / કેન્સલ માટે જરૂરી)', mr: 'कारण (होल्ड / कॅन्सलसाठी आवश्यक)', mwr: 'कारण (होल्ड / कैंसिल खातर जरूरी)' },
  moved:        { en: 'Stage updated', hi: 'स्टेज बदल गया', hinglish: 'Stage update ho gaya', gu: 'સ્ટેજ બદલાયો', mr: 'टप्पा बदलला', mwr: 'स्टेज बदळ ग्यो' },
  failed:       { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const fmt = (ms) => {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Date(n).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

// The most recent history entry that moved the job INTO `stage` (null if none).
export function lastStageEvent(job, stage) {
  const h = Array.isArray(job && job.stageHistory) ? job.stageHistory : [];
  for (let i = h.length - 1; i >= 0; i -= 1) if (h[i] && h[i].stage === stage) return h[i];
  return null;
}

// A teammate's display name from a { uid: name } map; null when unknown.
export const nameOf = (uid, names) => (uid && names && names[uid]) || null;

export default function JobStagePanel({ job, userNames, canMove = false }) {
  const t = useT(S);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const meta = STAGE_META[job.stage] || { label: job.stage || '—', emoji: '•', color: '#6B7280' };
  const closed = job.stage === 'cancelled' || job.stage === 'hold';
  const ev = closed ? lastStageEvent(job, job.stage) : null;
  const who = ev ? (nameOf(ev.by, userNames) || t('unknown')) : null;
  const needsReason = NEEDS_REASON.has(to);

  const submit = async () => {
    if (!to) return;
    if (needsReason && !note.trim()) { showToast(t('reasonNeeded'), 'error'); return; }
    setBusy(true);
    try {
      // QC → Production is a reject: production progress starts over.
      const resetSteps = job.stage === 'qc' && to === 'production';
      await ordersApi.transition(job.id, { to, resetSteps, note: note.trim() || null });
      showToast(t('moved'), 'success');
      setTo(''); setNote('');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" data-testid="job-stage-panel" style={{ marginBottom: 12 }}>
      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t('currentStage')}</span>
        <span data-testid="current-stage" style={{ background: meta.color, color: '#fff', fontSize: 14, padding: '4px 12px', borderRadius: 12, fontWeight: 700 }}>
          {meta.emoji} {meta.label}
        </span>
      </div>

      {closed && (
        <div data-testid="closed-banner" style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: job.stage === 'cancelled' ? '#FEF2F2' : 'var(--surface2)',
          border: `1px solid ${job.stage === 'cancelled' ? '#FECACA' : 'var(--border)'}`, fontSize: 13,
        }}>
          <div>
            <b>{job.stage === 'cancelled' ? t('cancelledBy') : t('heldBy')}: {who || t('unknown')}</b>
            {ev && fmt(ev.at) ? <span style={{ color: 'var(--text2)' }}> · {fmt(ev.at)}</span> : null}
          </div>
          {ev && ev.note ? <div style={{ marginTop: 2 }}>{t('reason')}: {ev.note}</div> : null}
        </div>
      )}

      {canMove && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', alignSelf: 'center' }}>{t('moveTo')}</label>
          <select className="input" data-testid="move-to" style={{ width: 'auto', minWidth: 170 }} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">{t('choose')}</option>
            {MOVE_STAGES.filter((s) => s !== job.stage).map((s) => (
              <option key={s} value={s}>{STAGE_META[s].emoji} {STAGE_META[s].label}</option>
            ))}
          </select>
          {needsReason && (
            <input className="input" data-testid="move-reason" style={{ flex: 1, minWidth: 220 }} placeholder={t('reasonNeeded')}
              value={note} onChange={(e) => setNote(e.target.value)} />
          )}
          <button className="btn btn-primary btn-sm" data-testid="move-submit" disabled={!to || busy || (needsReason && !note.trim())} onClick={submit}>
            {busy ? '…' : t('move')}
          </button>
        </div>
      )}
    </div>
  );
}
