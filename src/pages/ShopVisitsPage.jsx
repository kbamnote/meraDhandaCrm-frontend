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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { visitsApi } from '../services/api';
import NewJobModal from '../components/common/NewJobModal';
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
  person:   { en: 'Salesperson', hi: 'सेल्सपर्सन', hinglish: 'Salesperson', gu: 'સેલ્સપર્સન', mr: 'सेल्सपर्सन', mwr: 'सेल्सपर्सन' },
  everyone: { en: 'Everyone', hi: 'सभी', hinglish: 'Everyone', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
  openOrig: { en: 'Open original ↗', hi: 'ओरिजिनल खोलें ↗', hinglish: 'Original kholein ↗', gu: 'ઓરિજિનલ ખોલો ↗', mr: 'मूळ उघडा ↗', mwr: 'ओरिजिनल खोलो ↗' },
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
  // The visit a job card is being raised from. The card itself is the real
  // job-card form — the same one the Job Cards page opens, with every field
  // on it. A rep who has just won an order should not be filing a cut-down
  // card that leaves the floor chasing details, and a second smaller form
  // would have drifted from the real one the first time a field was added.
  const [jobFor, setJobFor] = useState(null);
  // Which rep's visits to show, for someone who can see more than one.
  const [who, setWho] = useState('all');
  // The photo being looked at. A 92px thumbnail proves nothing — the point
  // of the photo is that somebody can actually look at it.
  const [photo, setPhoto] = useState(null);

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

  // The people who filed a visit on this day. Built from the rows so the
  // filter can never offer a name with nothing behind it.
  const people = useMemo(() => {
    const by = new Map();
    for (const v of rows) if (!by.has(String(v.userId))) by.set(String(v.userId), v.userName || '—');
    return [...by.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const shown = useMemo(
    () => (who === 'all' ? rows : rows.filter((v) => String(v.userId) === who)),
    [rows, who]
  );

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

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{t('title')}</h2>
        <div className="flex items-center" style={{ gap: 8 }}>
          <label style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('date')}</label>
          <input className="input" type="date" value={date} max={today()} data-testid="visit-date"
            onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
          {/* Only for someone who can see more than one person's visits; a rep
              looking at their own day has nothing to choose between. */}
          {canWatch && people.length > 1 && (
            <>
              <label style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('person')}</label>
              <select className="input" value={who} data-testid="visit-person"
                onChange={(e) => setWho(e.target.value)} style={{ width: 190 }}>
                <option value="all">{t('everyone')} ({rows.length})</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
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
      ) : !shown.length ? (
        <p style={{ color: 'var(--text3)' }} data-testid="visits-empty">{t('none')}</p>
      ) : shown.map((v) => {
        const oc = OUTCOME[v.outcome];
        return (
          <div className="card" key={v.id} data-testid="visit-row" style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {v.photo && (
              // Opens in a viewer rather than a new tab: a Cloudinary URL in a
              // fresh tab loses which visit it belonged to, and a popup
              // blocker can swallow it entirely.
              <button type="button" onClick={() => setPhoto(v)} data-testid="visit-photo"
                title={t('openOrig')}
                style={{ flexShrink: 0, padding: 0, border: 'none', background: 'none', cursor: 'zoom-in' }}>
                <img src={v.photo} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              </button>
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

      {photo && (
        <div data-testid="photo-viewer"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPhoto(null)}>
          <img src={photo.photo} alt=""
            style={{ maxWidth: '94vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 6 }}
            onClick={(e) => e.stopPropagation()} />
          <div style={{ color: '#fff', marginTop: 10, textAlign: 'center', fontSize: 13 }}>
            <div style={{ fontWeight: 700 }}>
              {photo.clientName}{photo.userName ? ` · ${photo.userName}` : ''}
            </div>
            <div style={{ color: '#CBD5E1', fontSize: 12 }}>
              {photo.area || ''}{photo.checkInAt ? ` · ${clock(photo.checkInAt)}` : ''}
            </div>
            <a href={photo.photo} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#93C5FD', fontSize: 12.5, display: 'inline-block', marginTop: 6 }}>
              {t('openOrig')}
            </a>
          </div>
        </div>
      )}

      {/* The full job-card form, prefilled with the shop this order came from.
          `visitId` ties the card back to the visit it came out of, and
          `salesPersonId` credits the rep who MADE the visit — not whoever is
          at the keyboard, which may be an admin filing on their behalf.

          The client goes in by name and number rather than id: the form lets
          whoever is filling it search and pick a different client, and the
          server matches an existing one by phone anyway, so carrying an id the
          form cannot update would be a way to file against the wrong party. */}
      {jobFor && (
        <NewJobModal
          prefill={{ clientName: jobFor.clientName || '', clientMobile: jobFor.clientPhone || '' }}
          extra={{ visitId: jobFor.id, salesPersonId: jobFor.userId }}
          onCreated={() => load(date)}
          onClose={() => setJobFor(null)}
        />
      )}
    </div>
  );
}
