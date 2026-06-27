/**
 * Production floor — the 12 departments with active job counts, the jobs in each
 * department, and a step checklist per job. Marking steps, completing a
 * department (→ next dept or → QC), and hold all go through the order-workflow
 * engine (ordersApi → routes/orders.js). Jobs are read live from `mpw/jobs`.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:     { en: '🏭 Production', hi: '🏭 प्रोडक्शन', hinglish: '🏭 Production', gu: '🏭 પ્રોડક્શન', mr: '🏭 प्रोडक्शन', mwr: '🏭 प्रोडक्शन' },
  none:      { en: 'No jobs in production.', hi: 'प्रोडक्शन में कोई जॉब नहीं।', hinglish: 'Production mein koi job nahi.', gu: 'પ્રોડક્શનમાં કોઈ જોબ નથી.', mr: 'प्रोडक्शनमध्ये जॉब नाही.', mwr: 'प्रोडक्शन मांय कोई जॉब कोनी।' },
  noneDept:  { en: 'No active jobs in this department.', hi: 'इस विभाग में कोई एक्टिव जॉब नहीं।', hinglish: 'Is department mein koi active job nahi.', gu: 'આ વિભાગમાં કોઈ સક્રિય જોબ નથી.', mr: 'या विभागात सक्रिय जॉब नाही.', mwr: 'इण विभाग मांय कोई एक्टिव जॉब कोनी।' },
  back:      { en: '← All departments', hi: '← सभी विभाग', hinglish: '← All departments', gu: '← બધા વિભાગ', mr: '← सर्व विभाग', mwr: '← सगळा विभाग' },
  done:      { en: 'Done', hi: 'पूरा', hinglish: 'Done', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरो' },
  skip:      { en: 'Skip', hi: 'स्किप', hinglish: 'Skip', gu: 'સ્કિપ', mr: 'वगळा', mwr: 'स्किप' },
  undo:      { en: 'Undo', hi: 'वापस', hinglish: 'Undo', gu: 'પાછું', mr: 'पूर्ववत', mwr: 'वापस' },
  optional:  { en: 'optional', hi: 'वैकल्पिक', hinglish: 'optional', gu: 'વૈકલ્પિક', mr: 'ऐच्छिक', mwr: 'मरजी रो' },
  sendQc:    { en: 'Send to QC ✓', hi: 'QC में भेजें ✓', hinglish: 'QC mein bhejein ✓', gu: 'QC માં મોકલો ✓', mr: 'QC ला पाठवा ✓', mwr: 'QC मांय भेजो ✓' },
  nextDept:  { en: 'Complete → next dept', hi: 'पूरा → अगला विभाग', hinglish: 'Complete → next dept', gu: 'પૂર્ણ → આગળનો વિભાગ', mr: 'पूर्ण → पुढील विभाग', mwr: 'पूरो → अगलो विभाग' },
  hold:      { en: 'Hold', hi: 'होल्ड', hinglish: 'Hold', gu: 'હોલ્ડ', mr: 'होल्ड', mwr: 'होल्ड' },
  holdReason:{ en: 'Reason for hold?', hi: 'होल्ड का कारण?', hinglish: 'Hold ka reason?', gu: 'હોલ્ડનું કારણ?', mr: 'होल्डचे कारण?', mwr: 'होल्ड रो कारण?' },
  material:  { en: 'Material used', hi: 'इस्तेमाल मटेरियल', hinglish: 'Material used', gu: 'વપરાયેલ મટિરિયલ', mr: 'वापरलेले मटेरियल', mwr: 'काम आयो मटेरियल' },
  wastage:   { en: 'Wastage', hi: 'बर्बादी', hinglish: 'Wastage', gu: 'બગાડ', mr: 'वाया', mwr: 'बरबादी' },
  close:     { en: 'Close', hi: 'बंद करें', hinglish: 'Close', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  step:      { en: 'Step', hi: 'स्टेप', hinglish: 'Step', gu: 'સ્ટેપ', mr: 'स्टेप', mwr: 'स्टेप' },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const curDept = (job) => (Array.isArray(job.plan) ? job.plan[job.currentDeptIndex || 0] : null);

export default function ProductionPage() {
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  const [depts, setDepts] = useState([]);
  const [selDept, setSelDept] = useState(null);   // dept key or null
  const [selJobId, setSelJobId] = useState(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    ordersApi.departments().then(setDepts).catch(() => setDepts([]));
    return () => u();
  }, []);

  const byKey = useMemo(() => Object.fromEntries(depts.map((d) => [d.key, d])), [depts]);

  const prodJobs = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id })).filter((j) => j.stage === 'production'),
    [jobs]
  );

  const countByDept = useMemo(() => {
    const c = {};
    prodJobs.forEach((j) => { const d = curDept(j); if (d) c[d.dept] = (c[d.dept] || 0) + 1; });
    return c;
  }, [prodJobs]);

  const deptJobs = useMemo(
    () => prodJobs.filter((j) => curDept(j)?.dept === selDept),
    [prodJobs, selDept]
  );

  const selJob = useMemo(() => prodJobs.find((j) => j.id === selJobId) || null, [prodJobs, selJobId]);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{prodJobs.length} active</div>

      {!selDept ? (
        <>
          {!prodJobs.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {depts.map((d) => {
              const n = countByDept[d.key] || 0;
              return (
                <button key={d.key} className="card" onClick={() => setSelDept(d.key)}
                  style={{ textAlign: 'left', cursor: 'pointer', borderTop: `3px solid ${d.color}`, opacity: n ? 1 : 0.6 }}>
                  <div style={{ fontSize: 26 }}>{d.emoji}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{d.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: d.color, marginTop: 4 }}>{n}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button className="btn btn-ghost btn-sm mb-4" onClick={() => setSelDept(null)}>{t('back')}</button>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
            {byKey[selDept]?.emoji} {byKey[selDept]?.name}
          </h3>
          {!deptJobs.length && <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('noneDept')}</div>}
          {deptJobs.map((job) => {
            const dept = curDept(job);
            const required = dept.steps.filter((s) => !s.optional);
            const doneCount = required.filter((s) => job.stepProgress?.[`${job.currentDeptIndex || 0}:${s.id}`]?.done).length;
            const pct = required.length ? Math.round((doneCount / required.length) * 100) : 0;
            return (
              <button key={job.id} className="card" onClick={() => setSelJobId(job.id)} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
                    <span style={{ marginLeft: 8, fontSize: 13 }}>{job.clientName}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{doneCount}/{required.length} {t('step')}</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: byKey[selDept]?.color || 'var(--blue)' }} />
                </div>
              </button>
            );
          })}
        </>
      )}

      {selJob && <StepModal job={selJob} dept={byKey[curDept(selJob)?.dept]} t={t} onClose={() => setSelJobId(null)} />}
    </div>
  );
}

function StepModal({ job, dept, t, onClose }) {
  const idx = job.currentDeptIndex || 0;
  const plan = Array.isArray(job.plan) ? job.plan : [];
  const planStep = plan[idx];
  const isLast = idx === plan.length - 1;
  const [material, setMaterial] = useState(job.material || '');
  const [wastage, setWastage] = useState(job.wastage || '');
  const [busy, setBusy] = useState(false);

  const prog = job.stepProgress || {};
  const stepState = (sid) => prog[`${idx}:${sid}`] || null;
  const required = (planStep?.steps || []).filter((s) => !s.optional);
  const allRequiredDone = required.every((s) => stepState(s.id)?.done);

  const act = async (stepId, action) => {
    try { await ordersApi.markStep(job.id, { stepId, action }); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await ordersApi.deptComplete(job.id, isLast ? { material: material || null, wastage: wastage || null } : {});
      showToast(isLast ? 'Sent to QC' : 'Department complete', 'success');
      onClose();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  const hold = async () => {
    const reason = window.prompt(t('holdReason'));
    if (!reason || !reason.trim()) return;
    try { await ordersApi.transition(job.id, { to: 'hold', note: reason.trim() }); onClose(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3>{dept?.emoji} {dept?.name}</h3>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text2)' }}>{job.jobNo}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{job.clientName} · {job.work || ''}</div>

        {(planStep?.steps || []).map((s) => {
          const st = stepState(s.id);
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 24, textAlign: 'center', fontSize: 18 }}>
                {st?.done ? '✅' : st?.skipped ? '⏭️' : '⬜'}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: st?.done ? 'var(--text3)' : 'var(--text)', textDecoration: st?.done ? 'line-through' : 'none' }}>
                {s.name}{s.optional ? <span style={{ fontSize: 11, color: 'var(--text3)' }}> ({t('optional')})</span> : null}
              </span>
              {st?.done || st?.skipped ? (
                <button className="btn btn-ghost btn-xs" onClick={() => act(s.id, 'undo')}>{t('undo')}</button>
              ) : (
                <>
                  <button className="btn btn-success btn-xs" onClick={() => act(s.id, 'done')}>{t('done')}</button>
                  {s.optional && <button className="btn btn-ghost btn-xs" onClick={() => act(s.id, 'skip')}>{t('skip')}</button>}
                </>
              )}
            </div>
          );
        })}

        {isLast && (
          <div className="flex gap-2 mt-2" style={{ marginTop: 14 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('material')}</label>
              <input className="input" value={material} onChange={(e) => setMaterial(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('wastage')}</label>
              <input className="input" value={wastage} onChange={(e) => setWastage(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2" style={{ marginTop: 12 }}>
          <button className="btn btn-primary flex-1" onClick={complete} disabled={busy || !allRequiredDone}>
            {isLast ? t('sendQc') : t('nextDept')}
          </button>
          <button className="btn btn-sm" onClick={hold} style={{ background: 'var(--amber)', color: '#fff' }}>{t('hold')}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
