/**
 * My Designer Panel — the designer-side of the workflow.
 *
 * A job at stage 'designer' with no designerId is "broadcast" (open pool). The
 * first designer to Accept claims it atomically (others get "already taken");
 * Pass releases it back (no customer message). Claimed jobs show Client-Approval
 * (pauses the timer) and Design-Ready (→ Job Setter). On-Leave hides the pool.
 */
import { useEffect, useState } from 'react';
import { socket } from '../services/realtime';
import { ordersApi, uploadApi } from '../services/api';
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
  sendApproval:{ en: 'Send for Approval', hi: 'अप्रूवल के लिए भेजें', hinglish: 'Send for Approval', gu: 'મંજૂરી માટે મોકલો', mr: 'मंजुरीसाठी पाठवा', mwr: 'अप्रूवल खातर भेजो' },
  waitData:  { en: 'Waiting for Client Data', hi: 'क्लाइंट डेटा का इंतज़ार', hinglish: 'Waiting for Client Data', gu: 'ક્લાયન્ટ ડેટાની રાહ', mr: 'क्लायंट डेटाची वाट', mwr: 'क्लाइंट डेटा रो इंतज़ार' },
  clientReceived: { en: 'Client Data received', hi: 'क्लाइंट डेटा मिल गया', hinglish: 'Client Data received', gu: 'ક્લાયન્ટ ડેટા મળ્યો', mr: 'क्लायंट डेटा मिळाला', mwr: 'क्लाइंट डेटा मिल गयो' },
  clientChanges:  { en: 'Client wants changes', hi: 'क्लाइंट बदलाव चाहता है', hinglish: 'Client wants changes', gu: 'ક્લાયન્ટ ફેરફાર ઇચ્છે છે', mr: 'क्लायंट बदल इच्छितो', mwr: 'क्लाइंट बदलाव चाहे है' },
  badgeChanges:   { en: 'Client wants changes', hi: 'क्लाइंट बदलाव चाहता है', hinglish: 'Client wants changes', gu: 'ક્લાયન્ટ ફેરફાર ઇચ્છે છે', mr: 'क्लायंट बदल इच्छितो', mwr: 'क्लाइंट बदलाव चाहे है' },
  approvalsSent:  { en: 'Sent for approval', hi: 'अप्रूवल के लिए भेजा गया', hinglish: 'Sent for approval', gu: 'મંજૂરી માટે મોકલ્યું', mr: 'मंजुरीसाठी पाठवले', mwr: 'अप्रूवल खातर भेज्यो' },
  uploadDesign: { en: 'Upload design image', hi: 'डिज़ाइन इमेज अपलोड करें', hinglish: 'Upload design image', gu: 'ડિઝાઇન ઇમેજ અપલોડ કરો', mr: 'डिझाइन इमेज अपलोड करा', mwr: 'डिज़ाइन इमेज अपलोड करो' },
  changeDesign: { en: 'Change design image', hi: 'डिज़ाइन इमेज बदलें', hinglish: 'Change design image', gu: 'ડિઝાઇન ઇમેજ બદલો', mr: 'डिझाइन इमेज बदला', mwr: 'डिज़ाइन इमेज बदलो' },
  uploading:    { en: 'Uploading…', hi: 'अपलोड हो रहा है…', hinglish: 'Uploading…', gu: 'અપલોડ થઈ રહ્યું છે…', mr: 'अपलोड होत आहे…', mwr: 'अपलोड हो रयो है…' },
  imageSaved:   { en: 'Design image saved', hi: 'डिज़ाइन इमेज सेव हो गई', hinglish: 'Design image saved', gu: 'ડિઝાઇન ઇમેજ સેવ થઈ', mr: 'डिझाइन इमेज सेव झाली', mwr: 'डिज़ाइन इमेज सेव हो गई' },
  uploadFail:   { en: 'Upload failed', hi: 'अपलोड नहीं हुआ', hinglish: 'Upload failed', gu: 'અપલોડ નિષ્ફળ', mr: 'अपलोड अयशस्वी', mwr: 'अपलोड कोनी हुयो' },
  complete:  { en: 'Design Complete', hi: 'डिज़ाइन पूरा', hinglish: 'Design Complete', gu: 'ડિઝાઇન પૂર્ણ', mr: 'डिझाइन पूर्ण', mwr: 'डिज़ाइन पूरो' },
  hold:      { en: 'Hold', hi: 'होल्ड', hinglish: 'Hold', gu: 'હોલ્ડ', mr: 'होल्ड', mwr: 'होल्ड' },
  passOthers:{ en: 'Pass to Others', hi: 'दूसरों को पास करें', hinglish: 'Pass to Others', gu: 'બીજાને પાસ કરો', mr: 'इतरांना पास करा', mwr: 'दूजां ने पास करो' },
  badgeApproval:  { en: 'Awaiting approval', hi: 'अप्रूवल का इंतज़ार', hinglish: 'Awaiting approval', gu: 'મંજૂરીની રાહ', mr: 'मंजुरीची वाट', mwr: 'अप्रूवल रो इंतज़ार' },
  badgeData:      { en: 'Awaiting client data', hi: 'क्लाइंट डेटा का इंतज़ार', hinglish: 'Awaiting client data', gu: 'ક્લાયન્ટ ડેટાની રાહ', mr: 'क्लायंट डेटाची वाट', mwr: 'क्लाइंट डेटा रो इंतज़ार' },
  badgeDesigning: { en: 'Designing', hi: 'डिज़ाइनिंग', hinglish: 'Designing', gu: 'ડિઝાઇનિંગ', mr: 'डिझाइनिंग', mwr: 'डिज़ाइनिंग' },
  urgent:    { en: 'Urgent', hi: 'अर्जेंट', hinglish: 'Urgent', gu: 'તાત્કાલિક', mr: 'तातडीचे', mwr: 'अर्जेंट' },
  delivery:  { en: 'Delivery', hi: 'डिलीवरी', hinglish: 'Delivery', gu: 'ડિલિવરી', mr: 'डिलिव्हरी', mwr: 'डिलीवरी' },
  received:  { en: 'Received', hi: 'प्राप्त', hinglish: 'Received', gu: 'મળ્યું', mr: 'मिळाले', mwr: 'मिल्यो' },
  onLeaveMsg:{ en: "You're on leave — jobs won't be shown. Turn off to accept work.", hi: 'आप छुट्टी पर हैं — जॉब नहीं दिखेंगे।', hinglish: 'Aap leave par hain — jobs nahi dikhenge.', gu: 'તમે રજા પર છો — જોબ બતાવાશે નહીં.', mr: 'तुम्ही रजेवर आहात — जॉब दिसणार नाहीत.', mwr: 'थे छुट्टी पर हो — जॉब कोनी दिखसी।' },
  taken:     { en: 'Job already taken', hi: 'जॉब पहले ही ले ली गई', hinglish: 'Job already taken', gu: 'જોબ પહેલેથી લેવાઈ', mr: 'जॉब आधीच घेतले', mwr: 'जॉब पैलाईं ले ली' },
  completeNeedsImage: { en: 'Attach the design image to mark this complete', hi: 'पूरा करने के लिए डिज़ाइन इमेज लगाएं', hinglish: 'Complete karne ke liye design image lagayein', gu: 'પૂર્ણ કરવા ડિઝાઇન ઇમેજ જોડો', mr: 'पूर्ण करण्यासाठी डिझाइन इमेज जोडा', mwr: 'पूरो करण खातर डिज़ाइन इमेज लगावो' },
  chooseImage: { en: 'Choose image…', hi: 'इमेज चुनें…', hinglish: 'Image chunein…', gu: 'ઇમેજ પસંદ કરો…', mr: 'इमेज निवडा…', mwr: 'इमेज चुणो…' },
  completedOk: { en: 'Design marked complete', hi: 'डिज़ाइन पूरा हुआ', hinglish: 'Design complete ho gaya', gu: 'ડિઝાઇન પૂર્ણ થયું', mr: 'डिझाइन पूर्ण झाले', mwr: 'डिज़ाइन पूरो हुयो' },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function DesignerPanelPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const me = profile?.id;
  const [all, setAll] = useState([]);
  const [onLeave, setOnLeave] = useState(!!profile?.onLeave);
  const [busyId, setBusyId] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [passJob, setPassJob] = useState(null);   // job awaiting a pass reason
  const [passReason, setPassReason] = useState('');
  const [completeJob, setCompleteJob] = useState(null); // job awaiting its design image before it can complete

  // Self-service designer feed (open pool + my claimed jobs). A dedicated endpoint
  // so a designer does NOT need the broad `jobs` (Job Cards) permission to see
  // their own work. Refreshes live on any job change + on socket reconnect.
  useEffect(() => {
    const load = () => ordersApi.designerFeed().then((rows) => setAll(Array.isArray(rows) ? rows : [])).catch(() => {});
    load();
    const onChange = (msg) => {
      const base = String((msg && msg.path) || '').replace(/^mpw\//, '').split('/')[0];
      if (base === 'jobs') load();
    };
    socket.on('data:change', onChange);
    socket.on('connect', load);
    return () => { socket.off('data:change', onChange); socket.off('connect', load); };
  }, []);

  const available = all.filter((j) => j.stage === 'designer' && !j.designerId && !(j.designerRejectedBy || []).includes(me));
  const mine = all.filter((j) => j.stage === 'designer' && j.designerId === me);

  const run = async (id, fn, okMsg) => {
    setBusyId(id);
    try { await fn(); if (okMsg) showToast(okMsg, 'success'); }
    catch (e) { showToast(e.response?.status === 409 ? t('taken') : (e.response?.data?.error || t('failed')), 'error'); }
    finally { setBusyId(null); }
  };

  // Passing a job sends it back to every designer, so the next person needs to
  // know why it bounced. The reason is required — the server rejects an empty one.
  const askPassReason = (job) => { setPassJob(job); setPassReason(''); };
  const submitPass = async () => {
    const reason = passReason.trim();
    if (reason.length < 3) return showToast('Please write why you are passing this job', 'error');
    const job = passJob;
    setPassJob(null);
    await run(job.id, () => ordersApi.designerReject(job.id, reason), 'Job passed back to the pool');
  };

  // Upload the design preview image via the generic /upload endpoint, then link
  // the returned URL onto the job. Updates the local card immediately so the
  // thumbnail appears without waiting for the next feed refresh.
  const uploadDesign = async (e, job) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setUploading(job.id);
    try {
      const r = await uploadApi.upload(f);
      await ordersApi.designerDesignImage(job.id, r.url);
      setAll((prev) => prev.map((j) => (j.id === job.id ? { ...j, designImage: r.url } : j)));
      showToast(t('imageSaved'), 'success');
    } catch (err) { showToast(err.response?.data?.error || t('uploadFail'), 'error'); }
    finally { setUploading(null); }
  };

  // Design Complete requires a design image. If one's already attached the job
  // just advances; otherwise this opens a modal that uploads the image AND
  // advances the job in one step, so "complete" can never happen without it —
  // matching the same rule the server enforces on /designer/ready.
  const clickComplete = (job) => {
    if (job.designImage) { run(job.id, () => ordersApi.designerReady(job.id)); return; }
    setCompleteJob(job);
  };
  const completeWithImage = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    const job = completeJob;
    if (!f || !job) return;
    setUploading(job.id);
    try {
      const r = await uploadApi.upload(f);
      await ordersApi.designerDesignImage(job.id, r.url);
      await ordersApi.designerReady(job.id);
      setAll((prev) => prev.map((j) => (j.id === job.id ? { ...j, designImage: r.url } : j)));
      showToast(t('completedOk'), 'success');
      setCompleteJob(null);
    } catch (err) { showToast(err.response?.data?.error || t('uploadFail'), 'error'); }
    finally { setUploading(null); }
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
      {mine.map((job) => {
        const isUrgent = job.priority === 'urgent' || job.priority === 'high' || job.priority === 'most_urgent';
        const badge = job.designWait === 'approval'
          ? { label: t('badgeApproval'), bg: 'var(--amber)', fg: '#fff' }
          : job.designWait === 'client_data'
            ? { label: t('badgeData'), bg: '#0EA5E9', fg: '#fff' }
            : job.designWait === 'changes'
              ? { label: t('badgeChanges'), bg: 'var(--red)', fg: '#fff' }
              : { label: t('badgeDesigning'), bg: 'var(--surface2)', fg: 'var(--text2)' };
        return (
        <div key={job.id} className="card" style={{ marginBottom: 8, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
                {isUrgent && <span className="badge badge-amber">⚡ {t('urgent')}</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{job.work || '—'}</div>
              {job.clientName && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{job.clientName}</div>}
              {job.clientMobile && <div style={{ fontSize: 12, color: 'var(--text2)' }}>📞 {job.clientMobile}</div>}
            </div>
            <span className="badge" style={{ background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>{badge.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            {job.deliveryDate && <span>📅 {t('delivery')}: {fmt(job.deliveryDate)}</span>}
            {job.createdAt && <span>🕒 {t('received')}: {fmt(job.createdAt)}</span>}
            {job.designApprovals > 0 && <span>✉️ {t('approvalsSent')}: {job.designApprovals}×</span>}
          </div>
          <div className="flex gap-2 items-center" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {job.designImage && <img src={job.designImage} alt="design preview" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
            <input id={`des-${job.id}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadDesign(e, job)} />
            <button className="btn btn-sm" onClick={() => document.getElementById(`des-${job.id}`).click()} disabled={busyId === job.id || uploading === job.id}
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: 'none' }}>
              {uploading === job.id ? t('uploading') : (job.designImage ? t('changeDesign') : t('uploadDesign'))}
            </button>
          </div>
          <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => run(job.id, () => ordersApi.designerWait(job.id, job.designWait === 'approval' ? null : 'approval'))} disabled={busyId === job.id}
              style={{ background: job.designWait === 'approval' ? 'var(--amber)' : 'var(--surface2)', color: job.designWait === 'approval' ? '#fff' : 'var(--text2)', border: 'none' }}>
              {t('sendApproval')}
            </button>
            <button className="btn btn-sm" onClick={() => run(job.id, () => ordersApi.designerWait(job.id, job.designWait === 'client_data' ? null : 'client_data'))} disabled={busyId === job.id}
              style={{ background: job.designWait === 'client_data' ? 'var(--green)' : 'var(--surface2)', color: job.designWait === 'client_data' ? '#fff' : 'var(--text2)', border: 'none' }}>
              {job.designWait === 'client_data' ? t('clientReceived') : t('waitData')}
            </button>
            <button className="btn btn-sm" onClick={() => run(job.id, () => ordersApi.designerWait(job.id, job.designWait === 'changes' ? null : 'changes'))} disabled={busyId === job.id}
              style={{ background: job.designWait === 'changes' ? 'var(--red)' : 'var(--surface2)', color: job.designWait === 'changes' ? '#fff' : 'var(--text2)', border: 'none' }}>
              {t('clientChanges')}
            </button>
            <button className="btn btn-success btn-sm" onClick={() => clickComplete(job)} disabled={busyId === job.id}>{t('complete')}</button>
            <button className="btn btn-sm" onClick={() => run(job.id, () => ordersApi.designerHold(job.id))} disabled={busyId === job.id}
              style={{ background: 'var(--surface2)', color: 'var(--text2)', border: 'none' }}>{t('hold')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => askPassReason(job)} disabled={busyId === job.id}>{t('passOthers')}</button>
          </div>
        </div>
        );
      })}

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
            <button className="btn btn-ghost btn-sm" onClick={() => askPassReason(job)} disabled={busyId === job.id}>{t('pass')}</button>
          </div>
        </div>
      ))}

      {/* Design Complete without an image yet — forces the upload right here
          instead of just erroring, then advances the job in the same step. */}
      {completeJob && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => (uploading ? null : setCompleteJob(null))}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 380, padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>🖼️</div>
            <h3 style={{ margin: '8px 0 4px', fontSize: 16 }}>{t('completeNeedsImage')}</h3>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>
              <b style={{ fontFamily: 'monospace' }}>{completeJob.jobNo}</b> — {completeJob.clientName}
            </div>
            <input id="complete-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={completeWithImage} />
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => document.getElementById('complete-image-input').click()}
              disabled={uploading === completeJob.id}
            >
              {uploading === completeJob.id ? t('uploading') : t('chooseImage')}
            </button>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setCompleteJob(null)} disabled={uploading === completeJob.id}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pass reason — required, because the job goes back to every designer and
          the next one needs to know why it bounced. */}
      {passJob && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPassJob(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, padding: 18 }}>
            <h3 style={{ marginTop: 0, marginBottom: 4, fontSize: 16 }}>Why are you passing this job?</h3>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              <b style={{ fontFamily: 'monospace' }}>{passJob.jobNo}</b> — {passJob.clientName}
            </div>
            <textarea
              className="input"
              rows={3}
              autoFocus
              value={passReason}
              onChange={(e) => setPassReason(e.target.value)}
              placeholder="e.g. Client artwork missing / not my specialisation / already overloaded"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={submitPass} disabled={busyId === passJob.id}>
                Pass job back
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPassJob(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact date/time formatter for delivery & received timestamps. Falls back to
// the raw value if it isn't a parseable date.
function fmt(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function JobLine({ job }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
        {(job.priority === 'urgent' || job.priority === 'most_urgent') && <span className="badge badge-amber">⚡</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{job.clientName}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{job.work || '—'}{job.deliveryDate ? ` · 📅 ${job.deliveryDate}` : ''}</div>
    </div>
  );
}
