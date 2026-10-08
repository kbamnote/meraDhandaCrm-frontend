/**
 * Shop Visits — what the field team did today, shop by shop.
 *
 * A rep files these from the phone: a photo of the shop on arrival, then
 * feedback on the way out. This is the reading end. One row per visit, with the
 * photo, where it was, how long they stayed and what came of it; a manager gets
 * a per-rep strip across the top, a rep sees only their own.
 *
 * A visit still open (checked in, no feedback) is shown as such rather than
 * hidden — "still at the shop" and "never filed the feedback" look the same on
 * paper, and the person reading this is the one who can tell the difference.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { visitsApi, ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🏪 Shop Visits', hi: '🏪 शॉप विज़िट', hinglish: '🏪 Shop Visits', gu: '🏪 શોપ વિઝિટ', mr: '🏪 शॉप व्हिजिट', mwr: '🏪 शॉप विज़िट' },
  date:     { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  none:     { en: 'No visits recorded for this day.', hi: 'इस दिन कोई विज़िट नहीं।', hinglish: 'Is din koi visit nahi.', gu: 'આ દિવસે કોઈ વિઝિટ નથી.', mr: 'या दिवशी कोणतीही व्हिजिट नाही.', mwr: 'इण दिन कोई विज़िट कोनी।' },
  loading:  { en: 'Loading…', hi: 'लोड हो रहा है…', hinglish: 'Loading…', gu: 'લોડ થઈ રહ્યું છે…', mr: 'लोड होत आहे…', mwr: 'लोड हो रयो है…' },
  failed:   { en: 'Could not load visits', hi: 'विज़िट लोड नहीं हुईं', hinglish: 'Visits load nahi hui', gu: 'વિઝિટ લોડ ન થઈ', mr: 'व्हिजिट लोड झाल्या नाहीत', mwr: 'विज़िट लोड कोनी हुई' },
  visits:   { en: 'visits', hi: 'विज़िट', hinglish: 'visits', gu: 'વિઝિટ', mr: 'व्हिजिट', mwr: 'विज़िट' },
  open:     { en: 'Still at the shop', hi: 'अभी दुकान पर', hinglish: 'Abhi shop par', gu: 'હજી દુકાને', mr: 'अजून दुकानात', mwr: 'अबे दुकान पर' },
  noFeedback: { en: 'Left without feedback', hi: 'बिना फीडबैक के निकले', hinglish: 'Bina feedback ke nikle', gu: 'ફીડબેક વગર નીકળ્યા', mr: 'फीडबॅकशिवाय निघाले', mwr: 'बिना फीडबैक रै निकल्या' },
  noLoc:    { en: 'Location not captured', hi: 'लोकेशन नहीं मिली', hinglish: 'Location nahi mili', gu: 'લોકેશન મળ્યું નથી', mr: 'लोकेशन मिळाले नाही', mwr: 'लोकेशन कोनी मिली' },
  mins:     { en: 'min at shop', hi: 'मिनट दुकान पर', hinglish: 'min shop par', gu: 'મિનિટ દુકાને', mr: 'मिनिटे दुकानात', mwr: 'मिनट दुकान पर' },
  map:      { en: 'Map ↗', hi: 'मैप ↗', hinglish: 'Map ↗', gu: 'મેપ ↗', mr: 'मॅप ↗', mwr: 'मैप ↗' },
  del:      { en: 'Delete', hi: 'हटाएं', hinglish: 'Delete', gu: 'કાઢો', mr: 'हटवा', mwr: 'हटाओ' },
  delAsk:   { en: 'Delete this visit? The photo and feedback go with it.', hi: 'यह विज़िट हटाएं? फोटो और फीडबैक भी हट जाएंगे।', hinglish: 'Yeh visit delete karein? Photo aur feedback bhi hat jayenge.', gu: 'આ વિઝિટ કાઢો? ફોટો અને ફીડબેક પણ જશે.', mr: 'ही व्हिजिट हटवायची? फोटो व फीडबॅकही जाईल.', mwr: 'यो विज़िट हटाओ? फोटो अर फीडबैक ही जासी।' },
  deleted:  { en: 'Visit deleted', hi: 'विज़िट हटा दी', hinglish: 'Visit delete ho gayi', gu: 'વિઝિટ કાઢી', mr: 'व्हिजिट हटवली', mwr: 'विज़िट हट गई' },
  followUp: { en: 'Follow up', hi: 'फॉलो अप', hinglish: 'Follow up', gu: 'ફોલો અપ', mr: 'फॉलो अप', mwr: 'फॉलो अप' },
  makeJob:  { en: '+ Job card', hi: '+ जॉब कार्ड', hinglish: '+ Job card', gu: '+ જોબ કાર્ડ', mr: '+ जॉब कार्ड', mwr: '+ जॉब कार्ड' },
  jobFor:   { en: 'Job card for', hi: 'जॉब कार्ड —', hinglish: 'Job card for', gu: 'જોબ કાર્ડ —', mr: 'जॉब कार्ड —', mwr: 'जॉब कार्ड —' },
  work:     { en: 'What was ordered', hi: 'क्या ऑर्डर हुआ', hinglish: 'Kya order hua', gu: 'શું ઓર્ડર થયું', mr: 'काय ऑर्डर झाले', mwr: 'कांई ऑर्डर हुयो' },
  amount:   { en: 'Order amount (₹)', hi: 'ऑर्डर राशि (₹)', hinglish: 'Order amount (₹)', gu: 'ઓર્ડર રકમ (₹)', mr: 'ऑर्डर रक्कम (₹)', mwr: 'ऑर्डर रकम (₹)' },
  delivery: { en: 'Delivery date', hi: 'डिलीवरी तारीख', hinglish: 'Delivery date', gu: 'ડિલિવરી તારીખ', mr: 'डिलिव्हरी तारीख', mwr: 'डिलीवरी तारीख' },
  designNeeded: { en: 'Design needed', hi: 'डिज़ाइन चाहिए', hinglish: 'Design needed', gu: 'ડિઝાઇન જોઈએ', mr: 'डिझाइन हवे', mwr: 'डिज़ाइन चाइजै' },
  create:   { en: 'Create job card', hi: 'जॉब कार्ड बनाएं', hinglish: 'Job card banayein', gu: 'જોબ કાર્ડ બનાવો', mr: 'जॉब कार्ड तयार करा', mwr: 'जॉब कार्ड बणाओ' },
  created:  { en: 'Job card created', hi: 'जॉब कार्ड बन गया', hinglish: 'Job card ban gaya', gu: 'જોબ કાર્ડ બન્યું', mr: 'जॉब कार्ड तयार झाले', mwr: 'जॉब कार्ड बण ग्यो' },
  needWork: { en: 'Say what was ordered', hi: 'क्या ऑर्डर हुआ लिखें', hinglish: 'Kya order hua likhein', gu: 'શું ઓર્ડર થયું લખો', mr: 'काय ऑर्डर झाले लिहा', mwr: 'कांई ऑर्डर हुयो लिखो' },
  cancel:   { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel', gu: 'રદ', mr: 'रद्द', mwr: 'रद्द' },
};

// Labels and colours for what came of a visit. The server owns the list; this
// only decides how each one reads.
const OUTCOME = {
  order_placed:   { label: 'Order placed',   color: '#10B981' },
  interested:     { label: 'Interested',     color: '#2563EB' },
  follow_up:      { label: 'Follow up',      color: '#D97706' },
  not_interested: { label: 'Not interested', color: '#6B7280' },
  shop_closed:    { label: 'Shop closed',    color: '#9CA3AF' },
  other:          { label: 'Other',          color: '#6B7280' },
};

const today = () => new Date().toISOString().slice(0, 10);
const clock = (ms) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
const mins = (ms) => Math.max(0, Math.round((ms || 0) / 60000));

export default function ShopVisitsPage() {
  const t = useT(S);
  const { profile } = useAuth();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [canWatch, setCanWatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = ['owner', 'admin', 'superadmin'].includes(profile?.role);
  // The visit a job card is being raised from, plus that form's fields.
  const [jobFor, setJobFor] = useState(null);
  const [job, setJob] = useState({ work: '', amount: '', deliveryDate: '', designNeeded: false });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (day) => {
    setLoading(true);
    try {
      const data = await visitsApi.list({ date: day });
      setRows(data.rows || []);
      setCanWatch(!!data.canWatch);
      if (data.canWatch) {
        try { setSummary(await visitsApi.summary({ date: day })); }
        catch (e) { setSummary(null); }   // the list is the point; the strip is extra
      } else {
        setSummary(null);
      }
    } catch (e) {
      showToast(t('failed'), 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);         // useT() is a new function every render — not a dependency

  useEffect(() => { load(date); }, [date, load]);

  const remove = async (v) => {
    if (!window.confirm(t('delAsk'))) return;
    try {
      await visitsApi.remove(v.id);
      showToast(t('deleted'), 'success');
      load(date);
    } catch (e) {
      showToast(e?.response?.data?.error || t('failed'), 'error');
    }
  };

  // Raising the card from here keeps the order tied to the visit it came
  // out of: the job is credited to the rep who made the visit, and the
  // visit shows what came of it instead of ending at "order placed".
  const createJob = async () => {
    if (!job.work.trim()) return showToast(t('needWork'), 'error');
    setSaving(true);
    try {
      const created = await ordersApi.create({
        clientName: jobFor.clientName,
        clientMobile: jobFor.clientPhone || '',
        clientId: jobFor.clientId || undefined,
        work: job.work.trim(),
        amount: Number(job.amount) || 0,
        deliveryDate: job.deliveryDate || null,
        designNeeded: job.designNeeded,
        visitId: jobFor.id,
        // Credit goes to whoever MADE the visit, not whoever is typing —
        // an admin raising it on a rep's behalf must not take the order.
        salesPersonId: jobFor.userId,
        salesPerson: jobFor.userName,
      });
      showToast(`${t('created')} · ${created.jobNo}`, 'success');
      setJobFor(null);
      setJob({ work: '', amount: '', deliveryDate: '', designNeeded: false });
      load(date);
    } catch (e) {
      showToast(e?.response?.data?.error || t('failed'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('title')}</h2>
        <div className="flex items-center" style={{ gap: 8 }}>
          <label style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('date')}</label>
          <input className="input" type="date" value={date} max={today()} data-testid="visit-date"
            onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        </div>
      </div>

      {/* Per-rep strip — only for someone allowed to see the team. */}
      {canWatch && summary && !!summary.rows.length && (
        <div className="card" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }} data-testid="visit-summary">
          {summary.rows.map((r) => (
            <div key={r.userId} style={{ minWidth: 130 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {r.visits} {t('visits')} · {r.finished}/{r.visits} ✓
                {r.avgMs ? ` · ~${mins(r.avgMs)} ${t('mins')}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text3)' }}>{t('loading')}</p>
      ) : !rows.length ? (
        <p style={{ color: 'var(--text3)' }} data-testid="visits-empty">{t('none')}</p>
      ) : rows.map((v) => {
        const oc = OUTCOME[v.outcome];
        return (
          <div className="card" key={v.id} data-testid="visit-row" style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {v.photo && (
              <a href={v.photo} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                <img src={v.photo} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </a>
            )}
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14 }}>{v.clientName}</strong>
                {v.clientPhone && (
                  <a href={`tel:${v.clientPhone}`} style={{ fontSize: 12.5 }}>{v.clientPhone}</a>
                )}
                {oc && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: oc.color, border: `1px solid ${oc.color}`, borderRadius: 999, padding: '1px 8px' }}>
                    {oc.label}
                  </span>
                )}
                {!v.checkOutAt && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706' }} data-testid="visit-open">● {t('open')}</span>
                )}
                {v.closedWithout === 'feedback' && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('noFeedback')}</span>
                )}
              </div>

              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {canWatch ? `${v.userName} · ` : ''}
                {clock(v.checkInAt)}{v.checkOutAt ? ` – ${clock(v.checkOutAt)}` : ''}
                {v.durationMs ? ` · ${mins(v.durationMs)} ${t('mins')}` : ''}
              </div>

              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                {v.locationMissing
                  ? <span style={{ color: '#B45309' }}>⚠ {t('noLoc')}</span>
                  : (
                    <>
                      <span style={{ color: 'var(--text2)' }}>{v.area || `${v.lat?.toFixed(5)}, ${v.lng?.toFixed(5)}`}</span>
                      {' · '}
                      <a href={`https://www.google.com/maps?q=${v.lat},${v.lng}`} target="_blank" rel="noreferrer">{t('map')}</a>
                    </>
                  )}
              </div>

              {v.note && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--text2)' }}>{v.note}</div>}
              {v.feedback && (
                <div style={{ fontSize: 13, marginTop: 6, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 6 }} data-testid="visit-feedback">
                  {v.feedback}
                </div>
              )}
              {v.followUpDate && (
                <div style={{ fontSize: 12, marginTop: 4, color: '#D97706' }}>{t('followUp')}: {v.followUpDate}</div>
              )}

              {/* An order that came out of this visit, or the offer to raise
                  one. Only for a visit that actually ended in an order — the
                  button on every row would invite job cards for shops that
                  said no. */}
              {v.jobId ? (
                <div style={{ fontSize: 12.5, marginTop: 6 }} data-testid="visit-job">
                  📦 <Link to={`/job-detail?id=${v.jobId}`}>{v.jobNo}</Link>
                  {v.orderAmount ? ` · ₹${Number(v.orderAmount).toLocaleString('en-IN')}` : ''}
                </div>
              ) : v.outcome === 'order_placed' ? (
                <button className="btn btn-sm btn-primary" style={{ marginTop: 6 }}
                  data-testid="visit-make-job" onClick={() => setJobFor(v)}>
                  {t('makeJob')}
                </button>
              ) : null}
            </div>

            {isAdmin && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={() => remove(v)}>
                {t('del')}
              </button>
            )}
          </div>
        );
      })}

      {jobFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setJobFor(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 18 }}>
            <h3 style={{ margin: '0 0 2px', fontSize: 16 }}>{t('jobFor')} {jobFor.clientName}</h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{jobFor.clientPhone || ''}</div>
            <div className="form-group">
              <label>{t('work')}</label>
              <input className="input" data-testid="job-work" value={job.work}
                onChange={(e) => setJob((j) => ({ ...j, work: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('amount')}</label>
                <input className="input" type="number" min="0" data-testid="job-amount" value={job.amount}
                  onChange={(e) => setJob((j) => ({ ...j, amount: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('delivery')}</label>
                <input className="input" type="date" value={job.deliveryDate}
                  onChange={(e) => setJob((j) => ({ ...j, deliveryDate: e.target.value }))} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={job.designNeeded}
                onChange={(e) => setJob((j) => ({ ...j, designNeeded: e.target.checked }))} />
              {t('designNeeded')}
            </label>
            <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setJobFor(null)} disabled={saving}>{t('cancel')}</button>
              <button className="btn btn-sm btn-primary" onClick={createJob} disabled={saving} data-testid="job-save">
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
