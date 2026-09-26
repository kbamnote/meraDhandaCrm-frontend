/**
 * How many jobs sit at each stage, for the sidebar badges.
 *
 * Deliberately NOT onValue('mpw/jobs'): that pulls the whole jobs collection,
 * and the sidebar is mounted on every screen, so every page load would download
 * every job just to show a number. This asks the server to count instead — one
 * small aggregation — and re-asks when the server says jobs changed.
 *
 * Returns { byStage, active, total }, all zeros until the first answer arrives,
 * so a caller never has to guard against undefined.
 */
import { useEffect, useState } from 'react';
import { ordersApi } from '../services/api';
import { socket } from '../services/realtime';

const EMPTY = { byStage: {}, active: 0, total: 0 };

export default function useStageCounts() {
  const [counts, setCounts] = useState(EMPTY);

  useEffect(() => {
    let alive = true;
    let timer = null;

    const load = async () => {
      try {
        const r = await ordersApi.stageCounts();
        if (alive && r) setCounts({ byStage: r.byStage || {}, active: r.active || 0, total: r.total || 0 });
      } catch {
        // A badge is not worth an error message. Leave the last known numbers.
      }
    };

    // A stage move fires several changes at once (the job, its history, a
    // notification); count once after the burst rather than once per event.
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = null; load(); }, 400);
    };

    const onChange = (msg) => {
      const p = String((msg && msg.path) || '').replace(/^mpw\//, '');
      if (p === 'jobs' || p.startsWith('jobs/')) schedule();
    };

    load();
    socket.on('data:change', onChange);
    // A tab left open overnight shows yesterday's numbers otherwise: the socket
    // may have dropped while it was hidden.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      socket.off('data:change', onChange);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return counts;
}
