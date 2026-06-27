/**
 * My Designer Panel — the designer-side of the workflow.
 *
 * A job at stage 'designer' with no designerId is "broadcast" (open pool). The
 * first designer to Accept claims it atomically (others get "already taken");
 * Pass releases it back (no customer message). Claimed jobs show Client-Approval
 * (pauses the timer) and Design-Ready (→ Job Setter). On-Leave hides the pool.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:     { en: '🎨 My Designer Panel', hi: '🎨 मेरा डिज़ाइनर पैनल', hinglish: '🎨 My Designer Panel', gu: '🎨 મારું ડિઝાઇનર પેનલ', mr: '🎨 माझे डिझाइनर पॅनल', mwr: '🎨 म्हारो डिज़ाइनर पैनल' },
  onLeave:   { en: 'On leave', hi: 'छुट्टी पर', hinglish: 'On leave', gu: 'રજા પર', mr: 'रजेवर', mwr: 'छुट्टी पर' },
  available: { en: 'Available jobs (broadcast)', hi: 'उपलब्ध जॉब (ब्रॉडकास्ट)', hinglish: 'Available jobs (broadcast)', gu: 'ઉપલબ્ધ જોબ (બ્રોડકાસ્ટ)', mr: 'उपलब्ध जॉब (ब्रॉडकास्ट)', mwr: 'उपलब्ध जॉब (ब्रॉडकास्ट)' },
  myJobs:    { en: 'My design jobs', hi: 'मेरे डिज़ाइन जॉब', hinglish: 'Mere design jobs', gu: 'મારા ડિઝાઇન જોબ', mr: 'माझे डिझाइन जॉब', mwr: 'म्हारा डिज़ाइन जॉब' },
  noneAvail: { en: 'No design jobs available right now.', hi: 'अभी कोई डिज़ाइन जॉब उपलब्ध नहीं।', hinglish: 'Abhi koi design job available nahi.', gu: 'અત્યારે કોઈ ડિઝાઇન જોબ ઉપલબ્ધ નથી.', mr: 'सध्या कोणतेही डिझाइन जॉब उपलब्ध नाही.', mwr: 'अबे कोई डिज़ाइन जॉब उपलब्ध कोनी।' },
  noneMine:  { en: 'You have no claimed jobs.', hi: 'आपने कोई जॉब नहीं ली।', hinglish: 'Aapne koi job nahi li.', gu: 'તમે કોઈ જોબ લીધી નથી.', mr: 'तुम्ही कोणतेही जॉब घेतले नाही.', mwr: 'थे कोई जॉब कोनी ली।' },
  accept:    { en: 'Accept', hi: 'स्वीकारें', hinglish: 'Accept', gu: 'સ્વીકારો', mr: 'स्वीकारा', mwr: 'स्वीकारो' },
  pass:      { en: 'Pass', hi: 'पास', hinglish: 'Pass', gu: 'પાસ', mr: 'पास', mwr: 'पास' },
  ready:     { en: 'Design ready →', hi: 'डिज़ाइन तैयार →', hinglish: 'Design ready →', gu: 'ડિઝાઇન તૈયાર →', mr: 'डिझाइन तयार →', mwr: 'डिज़ाइन तैयार →' },
  sendClient:{ en: 'Send to client', hi: 'क्लाइंट को भेजें', hinglish: 'Client ko bhejein', gu: 'ક્લાયન્ટને મોકલો', mr: 'क्लायंटला पाठवा', mwr: 'क्लाइंट ने भेजो' },
  awaiting:  { en: '⏸ Awaiting client approval', hi: '⏸ क्लाइंट अप्रूवल का इंतज़ार', hinglish: '⏸ Client approval ka wait', gu: '⏸ ક્લાયન્ટ મંજૂરીની રાહ', mr: '⏸ क्लायंट मंजुरीची वाट', mwr: '⏸ क्लाइंट अप्रूवल रो इंतज़ार' },
  onLeaveMsg:{ en: "You're on leave — jobs won't be shown. Turn off to accept work.", hi: 'आप छुट्टी पर हैं — जॉब नहीं दिखेंगे।', hinglish: 'Aap leave par hain — jobs nahi dikhenge.', gu: 'તમે રજા પર છો — જોબ બતાવાશે નહીં.', mr: 'तुम्ही रजेवर आहात — जॉब दिसणार नाहीत.', mwr: 'थे छुट्टी पर हो — जॉब कोनी दिखसी।' },
  taken:     { en: 'Job already taken', hi: 'जॉब पहले ही ले ली गई', hinglish: 'Job already taken', gu: 'જોબ પહેલેથી લેવાઈ', mr: 'जॉब आधीच घेतले', mwr: 'जॉब पैलाईं ले ली' },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function DesignerPanelPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const me = profile?.id;
  const [jobs, setJobs] = useState({});
  const [onLeave, setOnLeave] = useState(!!profile?.onLeave);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => u();
  }, []);

  const all = useMemo(() => Object.entries(jobs).map(([id, j]) => ({ ...j, id })), [jobs]);
  const available = all.filter((j) => j.stage === 'designer' && !j.designerId && !(j.designerRejectedBy || []).includes(me));
  const mine = all.filter((j) => j.stage === 'designer' && j.designerId === me);

  const run = async (id, fn, okMsg) => {
    setBusyId(id);
    try { await fn(); if (okMsg) showToast(okMsg, 'success'); }
    catch (e) { showToast(e.response?.status === 409 ? t('taken') : (e.response?.data?.error || t('failed')), 'error'); }
    finally { setBusyId(null); }
  };

  const toggleLeave = async () => {
    const next = !onLeave;
    try { await ordersApi.designerLeave(next); setOnLeave(next); } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-sm" onClick={toggleLeave}
          style={{ background: onLeave ? 'var(--amber)' : 'var(--surface2)', color: onLeave ? '#fff' : 'var(--text2)', border: 'none' }}>
          {onLeave ? '🌴 ' : '⚪ '}{t('onLeave')}
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '8px 0' }}>
        {t('myJobs')} ({mine.length})
      </div>
      {!mine.length && <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>{t('noneMine')}</div>}
      {mine.map((job) => (
        <div key={job.id} className="card" style={{ marginBottom: 8, borderLeft: '4px solid #8B5CF6' }}>
          <JobLine job={job} />
          {job.designClientPending && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>{t('awaiting')}</div>}
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => run(job.id, () => ordersApi.designerApproval(job.id))} disabled={busyId === job.id}
              style={{ background: job.designClientPending ? 'var(--amber)' : 'var(--surface2)', color: job.designClientPending ? '#fff' : 'var(--text2)', border: 'none' }}>
              {job.designClientPending ? '▶ ' : '📤 '}{t('sendClient')}
            </button>
            <button className="btn btn-success btn-sm" onClick={() => run(job.id, () => ordersApi.designerReady(job.id))} disabled={busyId === job.id}>{t('ready')}</button>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 0 8px' }}>
        {t('available')} ({onLeave ? 0 : available.length})
      </div>
      {onLeave ? (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--amber)' }}>{t('onLeaveMsg')}</div>
      ) : !available.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>{t('noneAvail')}</div>
      ) : available.map((job) => (
        <div key={job.id} className="card" style={{ marginBottom: 8 }}>
          <JobLine job={job} />
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => run(job.id, () => ordersApi.designerClaim(job.id))} disabled={busyId === job.id}>{t('accept')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => run(job.id, () => ordersApi.designerReject(job.id))} disabled={busyId === job.id}>{t('pass')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function JobLine({ job }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
        {job.priority === 'urgent' && <span className="badge badge-amber">⚡</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{job.clientName}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{job.work || '—'}{job.deliveryDate ? ` · 📅 ${job.deliveryDate}` : ''}</div>
    </div>
  );
}
