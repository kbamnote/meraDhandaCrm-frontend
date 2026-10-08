/**
 * The map used by Team Map and Route History.
 *
 * Leaflet with OpenStreetMap tiles: free, no API key, no account, no billing to
 * set up before anyone can see where their team is. It is loaded from a CDN at
 * runtime rather than bundled, so this works without adding a dependency or
 * rebuilding — and a map is useless offline anyway, since the tiles come over
 * the network regardless.
 *
 * Props
 *   markers  [{ id, lat, lng, color, label, initial, popupHtml }]
 *   route    [[lat, lng], …]            a path to draw
 *   focus    { lat, lng, zoom, at }     recentre; `at` makes repeats distinct
 *   onMarkerClick (marker) => void
 *   emptyText shown when there is nothing to plot
 */
import { useEffect, useRef, useState } from 'react';

const CDN_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CDN_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const INDIA = [20.5937, 78.9629];

// One loader shared by every mount, so two maps on one screen don't both inject
// the script and race each other.
let loader = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${CDN_CSS}"]`)) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = CDN_CSS;
      document.head.appendChild(css);
    }
    const s = document.createElement('script');
    s.src = CDN_JS;
    s.async = true;
    s.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet did not load')));
    s.onerror = () => reject(new Error('Leaflet could not be reached'));
    document.head.appendChild(s);
  });
  return loader;
}

// A pin that carries the person's initials and their status colour, so the map
// is readable without clicking anything.
const pinHtml = (color, initial) => `
  <div style="width:34px;height:34px;border-radius:50%;background:${color};
              border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);
              display:flex;align-items:center;justify-content:center;
              color:#fff;font-weight:800;font-size:12px;font-family:system-ui,sans-serif">
    ${initial || ''}
  </div>`;

export default function TrackingMap({ markers = [], route = null, focus = null, onMarkerClick, emptyText }) {
  const holder = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const line = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !holder.current || map.current) return;
      map.current = L.map(holder.current, { zoomControl: true, attributionControl: true })
        .setView(INDIA, 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      setReady(true);
    }).catch((e) => setError(e.message));

    return () => {
      dead = true;
      if (map.current) { map.current.remove(); map.current = null; }
      layer.current = null;
      line.current = null;
    };
  }, []);

  // Redraw the pins whenever they change.
  useEffect(() => {
    const L = window.L;
    if (!ready || !L || !layer.current) return;
    layer.current.clearLayers();

    const pts = [];
    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue;
      pts.push([m.lat, m.lng]);
      const mk = L.marker([m.lat, m.lng], {
        icon: L.divIcon({
          html: pinHtml(m.color || '#2563EB', m.initial),
          className: '',          // no Leaflet default styling
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        title: m.label || '',
      });
      if (m.popupHtml) mk.bindPopup(m.popupHtml);
      if (onMarkerClick) mk.on('click', () => onMarkerClick(m));
      mk.addTo(layer.current);
    }

    // The route line, drawn under the pins.
    if (line.current) { line.current.remove(); line.current = null; }
    if (Array.isArray(route) && route.length > 1) {
      line.current = L.polyline(route, { color: '#2563EB', weight: 4, opacity: 0.75 }).addTo(map.current);
      route.forEach((p) => pts.push(p));
      // Start and end of the day, which is what people look for first.
      L.circleMarker(route[0], { radius: 6, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 })
        .bindPopup('Start').addTo(layer.current);
      L.circleMarker(route[route.length - 1], { radius: 6, color: '#EF4444', fillColor: '#EF4444', fillOpacity: 1 })
        .bindPopup('Latest').addTo(layer.current);
    }

    // Fit everything, unless the caller is pointing the map at one person — the
    // focus effect below owns the view in that case.
    if (pts.length && !focus) {
      map.current.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, route, ready]);

  // Fly to one person. `focus.at` changes on every request so clicking the same
  // name twice still recentres.
  useEffect(() => {
    if (!ready || !map.current || !focus || focus.lat == null) return;
    map.current.setView([focus.lat, focus.lng], focus.zoom || 15, { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.at, focus?.lat, focus?.lng, ready]);

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
        The map could not load ({error}).<br />
        The list beside it still works, and each person has an “Open in Google Maps” link.
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 320 }}>
      <div ref={holder} style={{ width: '100%', height: '100%', minHeight: 320, background: 'var(--bg2)' }} />
      {ready && !markers.some((m) => m.lat != null) && !(route && route.length) && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 16,
        }}>
          {emptyText || 'Nothing to show on the map yet'}
        </div>
      )}
    </div>
  );
}
