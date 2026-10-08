/**
 * Team Map — where the field team is right now.
 *
 * A list of everyone who is tracked beside the map: click a name to centre on
 * them. The opening snapshot comes from GET /tracking/live and every fix after
 * that arrives on the `tracking:live` socket event, so a moving rep's pin moves
 * without waiting for the next poll. The poll stays as a safety net — a dropped
 * socket should cost freshness, not the whole screen.
 *
 * Reps with no fix today are listed WITHOUT a pin rather than left out: a rep
 * who is absent and a rep whose tracking has quietly broken look identical if
 * missing people simply vanish.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackingApi } from '../services/api';
import { socket } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import TrackingMap from '../components/common/TrackingMap';

const S = {
  title:    { en: '📍 Team Map', hi: '📍 टीम मैप', hinglish: '📍 Team Map', gu: '📍 ટીમ મેપ', mr: '📍 टीम मॅप', mwr: '📍 टीम मैप' },
  working:  { en: 'Working', hi: 'काम पर', hinglish: 'Working', gu: 'કામ પર', mr: 'कामावर', mwr: 'काम पर' },
  done:     { en: 'Punched out', hi: 'पंच आउट', hinglish: 'Punched out', gu: 'પંચ આઉટ', mr: 'पंच आउट', mwr: 'पंच आउट' },
  offline:  { en: 'Offline', hi: 'ऑफलाइन', hinglish: 'Offline', gu: 'ઓફલાઇન', mr: 'ऑफलाइन', mwr: 'ऑफलाइन' },
  absent:   { en: 'Not punched in', hi: 'पंच इन नहीं', hinglish: 'Punch in nahi', gu: 'પંચ ઇન નથી', mr: 'पंच इन नाही', mwr: 'पंच इन कोनी' },
  noLoc:    { en: 'No location today', hi: 'आज कोई लोकेशन नहीं', hinglish: 'Aaj koi location nahi', gu: 'આજે કોઈ લોકેશન નથી', mr: 'आज कोणतेही लोकेशन नाही', mwr: 'आज कोई लोकेशन कोनी' },
  unknown:  { en: 'Area unknown', hi: 'इलाका अज्ञात', hinglish: 'Area unknown', gu: 'વિસ્તાર અજાણ', mr: 'परिसर अज्ञात', mwr: 'इलाको अज्ञात' },
  nobody:   { en: 'Nobody is being tracked yet. Turn it on for a sales user in Permissions.', hi: 'अभी किसी की ट्रैकिंग नहीं है। Permissions में सेल्स यूज़र के लिए चालू करें।', hinglish: 'Abhi kisi ki tracking nahi hai. Permissions mein sales user ke liye on karein.', gu: 'હજી કોઈનું ટ્રેકિંગ નથી. Permissions માં સેલ્સ યુઝર માટે ચાલુ કરો.', mr: 'अजून कोणाचेही ट्रॅकिंग नाही. Permissions मध्ये सेल्स युझरसाठी चालू करा.', mwr: 'अबे कोई री ट्रैकिंग कोनी। Permissions में सेल्स यूज़र खातर चालू करो।' },
  loading:  { en: 'Loading…', hi: 'लोड हो रहा है…', hinglish: 'Loading…', gu: 'લોડ થઈ રહ્યું છે…', mr: 'लोड होत आहे…', mwr: 'लोड हो रयो है…' },
  failed:   { en: 'Could not load the team map', hi: 'टीम मैप लोड नहीं हुआ', hinglish: 'Team map load nahi hua', gu: 'ટીમ મેપ લોડ ન થયો', mr: 'टीम मॅप लोड झाला नाही', mwr: 'टीम मैप लोड कोनी हुयो' },
  route:    { en: "Today's route", hi: 'आज का रूट', hinglish: 'Aaj ka route', gu: 'આજનો રૂટ', mr: 'आजचा मार्ग', mwr: 'आज रो रूट' },
  openMaps: { en: 'Open in Google Maps ↗', hi: 'Google Maps में खोलें ↗', hinglish: 'Google Maps mein kholein ↗', gu: 'Google Maps માં ખોલો ↗', mr: 'Google Maps मध्ये उघडा ↗', mwr: 'Google Maps में खोलो ↗' },
  live:     { en: 'Live', hi: 'लाइव', hinglish: 'Live', gu: 'લાઇવ', mr: 'लाइव्ह', mwr: 'लाइव' },
};

const COLOR = { working: '#10B981', done: '#3B82F6', offline: '#9CA3AF', absent: '#EF4444' };

// "2 min ago" — a pin's age is the first thing you check on a map like this, and
// a timestamp makes you do the arithmetic yourself.
function ago(ms) {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function TeamMapPage() {
  const t = useT(S);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [focus, setFocus] = useState(null);
  // Set once a socket fix has arrived, so the header can say the map is live
  // rather than leaving people guessing whether it updates by itself.
  const [liveAt, setLiveAt] = useState(null);
  const failedOnce = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await trackingApi.live();
      setRows(data.rows || []);
      failedOnce.current = false;
    } catch (e) {
      // Only complain once: a 30-second poll that keeps failing would otherwise
      // bury the screen in toasts.
      if (!failedOnce.current) { showToast(t('failed'), 'error'); failedOnce.current = true; }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);          // useT() is a new function every render — keep it out of here

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  // Live fixes. The payload carries only the position, so it is merged into the
  // row we already have — the attendance-derived state and the person's name
  // come from the snapshot and must survive a fix arriving.
  useEffect(() => {
    const onLive = (loc) => {
      if (!loc || !loc.userId) return;
      setLiveAt(Date.now());
      setRows((prev) => {
        const i = prev.findIndex((r) => String(r.userId) === String(loc.userId));
        if (i === -1) { load(); return prev; }   // somebody new started sharing
        const next = [...prev];
        next[i] = {
          ...next[i],
          lat: loc.lat, lng: loc.lng, area: loc.area || next[i].area,
          speed: loc.speed, accuracy: loc.accuracy,
          lastSeen: loc.lastSeen, aliveAt: loc.aliveAt,
          // A fix just arrived, so they are not offline. Punched-out stays
          // punched-out: the last ping of a shift is the punch-out itself.
          state: loc.status === 'offline' ? 'done' : (next[i].punchedOut ? 'done' : 'working'),
        };
        return next;
      });
    };
    socket.on('tracking:live', onLive);
    return () => socket.off('tracking:live', onLive);
  }, [load]);

  const markers = useMemo(() => rows
    .filter((r) => r.lat != null)
    .map((r) => ({
      id: r.userId,
      lat: r.lat,
      lng: r.lng,
      color: COLOR[r.state] || COLOR.offline,
      initial: (r.name || '?').slice(0, 1).toUpperCase(),
      label: r.name,
      popupHtml: `<strong>${r.name}</strong><br>${t(r.state)}<br>${r.area || ''}<br>${ago(r.lastSeen)}`,
      row: r,
    })), [rows, t]);

  const counts = rows.reduce((a, r) => ({ ...a, [r.state]: (a[r.state] || 0) + 1 }), {});

  const pick = (r) => {
    setSelected(r);
    if (r.lat != null) setFocus({ lat: r.lat, lng: r.lng, zoom: 16, at: Date.now() });
  };

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{t('title')}</h2>
        {liveAt && (
          <span style={{ fontSize: 12, color: 'var(--green, #10B981)' }}>
            ● {t('live')} · {ago(liveAt)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Roster */}
        <div className="card" style={{ flex: '1 1 290px', maxWidth: 360, padding: 0, display: 'flex', flexDirection: 'column', maxHeight: 'min(72vh, 680px)' }}>
          <div style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, flexWrap: 'wrap' }}>
            <span><span style={{ color: COLOR.working }}>●</span> {t('working')} {counts.working || 0}</span>
            <span><span style={{ color: COLOR.done }}>●</span> {t('done')} {counts.done || 0}</span>
            <span><span style={{ color: COLOR.offline }}>●</span> {t('offline')} {counts.offline || 0}</span>
            <span><span style={{ color: COLOR.absent }}>●</span> {t('absent')} {counts.absent || 0}</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <p style={{ padding: 18, textAlign: 'center', color: 'var(--text3)' }}>{t('loading')}</p>
            ) : !rows.length ? (
              <p style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13, lineHeight: 1.5 }}>{t('nobody')}</p>
            ) : rows.map((r) => (
              <button
                key={r.userId}
                onClick={() => pick(r)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  background: selected?.userId === r.userId ? 'var(--bg2)' : 'transparent',
                  opacity: r.state === 'absent' ? 0.65 : 1,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, overflow: 'hidden' }}>
                    {r.avatar ? <img src={r.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (r.name || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--bg)', background: COLOR[r.state] || COLOR.offline }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {r.lat == null ? t('noLoc') : (r.area || t('unknown'))}
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', textAlign: 'right', flexShrink: 0 }}>
                  {r.lat != null ? ago(r.lastSeen) : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="card" style={{ flex: '2 1 420px', padding: 0, overflow: 'hidden', position: 'relative', height: 'min(72vh, 680px)' }}>
          <TrackingMap
            markers={markers}
            focus={focus}
            onMarkerClick={(mk) => setSelected(mk.row)}
            emptyText={loading ? t('loading') : t('nobody')}
          />
          {selected && (
            <div style={{
              position: 'absolute', left: 12, bottom: 12, zIndex: 500,
              background: 'rgba(255,255,255,.96)', color: '#0F172A',
              borderRadius: 8, padding: '9px 12px', boxShadow: '0 2px 10px rgba(0,0,0,.18)', maxWidth: 260,
            }}>
              <strong style={{ fontSize: 13 }}>{selected.name}</strong>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {t(selected.state)}{selected.lat != null ? ` · ${ago(selected.lastSeen)}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, flexWrap: 'wrap' }}>
                <Link to={`/tracking/route?user=${selected.userId}`}>{t('route')}</Link>
                {selected.lat != null && (
                  <a href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer">
                    {t('openMaps')}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
