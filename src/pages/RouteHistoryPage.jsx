/**
 * Route History — one person's day on the map, with how far they went.
 *
 * Reads GET /tracking/history/:userId?date=, which returns the points in order
 * plus the distance measured on EVERY point (the line itself is thinned for the
 * browser, so measuring the drawn line would under-report a long day).
 *
 * A rep can open their own route; seeing anyone else's needs the Tracking
 * permission, and the server enforces that — this page only decides what to
 * offer in the dropdown.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trackingApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import TrackingMap from '../components/common/TrackingMap';

const S = {
  title:    { en: '🛣 Route History', hi: '🛣 रूट हिस्ट्री', hinglish: '🛣 Route History', gu: '🛣 રૂટ હિસ્ટ્રી', mr: '🛣 मार्ग इतिहास', mwr: '🛣 रूट हिस्ट्री' },
  person:   { en: 'Person', hi: 'व्यक्ति', hinglish: 'Person', gu: 'વ્યક્તિ', mr: 'व्यक्ती', mwr: 'व्यक्ति' },
  date:     { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  distance: { en: 'Distance', hi: 'दूरी', hinglish: 'Distance', gu: 'અંતર', mr: 'अंतर', mwr: 'दूरी' },
  points:   { en: 'Points', hi: 'पॉइंट', hinglish: 'Points', gu: 'પોઇન્ટ', mr: 'पॉइंट', mwr: 'पॉइंट' },
  first:    { en: 'First fix', hi: 'पहला फिक्स', hinglish: 'Pehla fix', gu: 'પ્રથમ ફિક્સ', mr: 'पहिला फिक्स', mwr: 'पहलो फिक्स' },
  last:     { en: 'Last fix', hi: 'आखिरी फिक्स', hinglish: 'Aakhri fix', gu: 'છેલ્લો ફિક્સ', mr: 'शेवटचा फिक्स', mwr: 'आखरी फिक्स' },
  none:     { en: 'No route recorded for this day.', hi: 'इस दिन का कोई रूट नहीं।', hinglish: 'Is din ka koi route nahi.', gu: 'આ દિવસનો કોઈ રૂટ નથી.', mr: 'या दिवसाचा मार्ग नाही.', mwr: 'इण दिन रो कोई रूट कोनी।' },
  loading:  { en: 'Loading…', hi: 'लोड हो रहा है…', hinglish: 'Loading…', gu: 'લોડ થઈ રહ્યું છે…', mr: 'लोड होत आहे…', mwr: 'लोड हो रयो है…' },
  failed:   { en: 'Could not load the route', hi: 'रूट लोड नहीं हुआ', hinglish: 'Route load nahi hua', gu: 'રૂટ લોડ ન થયો', mr: 'मार्ग लोड झाला नाही', mwr: 'रूट लोड कोनी हुयो' },
  nobody:   { en: 'Nobody is being tracked yet.', hi: 'अभी किसी की ट्रैकिंग नहीं है।', hinglish: 'Abhi kisi ki tracking nahi hai.', gu: 'હજી કોઈનું ટ્રેકિંગ નથી.', mr: 'अजून कोणाचेही ट्रॅकिंग नाही.', mwr: 'अबे कोई री ट्रैकिंग कोनी।' },
};

const today = () => new Date().toISOString().slice(0, 10);
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m || 0} m`);
const clock = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

export default function RouteHistoryPage() {
  const t = useT(S);
  const [params, setParams] = useSearchParams();
  const [people, setPeople] = useState([]);
  const [userId, setUserId] = useState(params.get('user') || '');
  const [date, setDate] = useState(params.get('date') || today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Who can be asked about. The live feed already answers that — it lists every
  // tracked person, or just yourself if you are not a watcher.
  useEffect(() => {
    trackingApi.live()
      .then((r) => {
        const rows = r.rows || [];
        setPeople(rows);
        setUserId((cur) => cur || (rows[0] ? rows[0].userId : ''));
      })
      .catch(() => { /* the empty state covers it */ });
  }, []);

  const load = useCallback(async (uid, day) => {
    if (!uid) return;
    setLoading(true);
    try {
      setData(await trackingApi.history(uid, { date: day }));
    } catch (e) {
      showToast(e?.response?.data?.error || t('failed'), 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);          // useT() changes identity every render — not a dependency

  useEffect(() => { load(userId, date); }, [userId, date, load]);

  // Keep the URL in step so a route can be linked to from the Team Map.
  useEffect(() => {
    if (userId) setParams({ user: userId, date }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date]);

  const route = useMemo(
    () => (data?.points || []).map((p) => [p.lat, p.lng]),
    [data]
  );
  const person = people.find((p) => String(p.userId) === String(userId));

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{t('title')}</h2>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
          <label>{t('person')}</label>
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} data-testid="route-person">
            {!people.length && <option value="">—</option>}
            {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>{t('date')}</label>
          <input className="input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} data-testid="route-date" />
        </div>
        {data && (
          <div style={{ display: 'flex', gap: 18, fontSize: 12.5, paddingBottom: 6, flexWrap: 'wrap' }}>
            <span><b data-testid="route-distance">{km(data.distanceM)}</b><br /><span style={{ color: 'var(--text3)' }}>{t('distance')}</span></span>
            <span><b>{data.total}</b><br /><span style={{ color: 'var(--text3)' }}>{t('points')}</span></span>
            <span><b>{clock(data.firstAt)}</b><br /><span style={{ color: 'var(--text3)' }}>{t('first')}</span></span>
            <span><b>{clock(data.lastAt)}</b><br /><span style={{ color: 'var(--text3)' }}>{t('last')}</span></span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'min(70vh, 640px)' }}>
        <TrackingMap
          route={route}
          markers={[]}
          emptyText={loading ? t('loading') : (!people.length ? t('nobody') : t('none'))}
        />
      </div>

      {person && data && !data.total && (
        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 10 }} data-testid="route-empty">
          {t('none')}
        </p>
      )}
    </div>
  );
}
