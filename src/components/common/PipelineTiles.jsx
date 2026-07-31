/**
 * PipelineTiles — the "All Time Overview" strip: where every job currently sits,
 * plus how many are parked on client approval and how many staff are connected.
 *
 * Fed by GET /api/analytics/pipeline (one aggregation pass over `jobs`). Refreshes
 * on the live `data:change` socket event for jobs, so a stage move updates the
 * counts without a reload, with a slow poll as a fallback for the online-staff
 * figure (presence changes emit no data event).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi } from '../../services/api';
import { socket } from '../../services/realtime';

// Order matters — this is the shop-floor flow, left to right. `to` is the page
// that backs the number, so a tile doubles as a shortcut into that queue.
const TILES = [
  { key: 'total',       label: 'Total Jobs',  color: 'var(--text)',            to: '/job-cards' },
  { key: 'inProgress',  label: 'In Progress', color: 'var(--green)',           to: '/job-cards' },
  { key: 'delivered',   label: 'Delivered',   color: 'var(--green)',           to: '/completed' },
  { key: 'rejected',    label: 'Rejected',    color: 'var(--red)',             to: '/job-cards' },
  { key: 'hold',        label: 'On Hold',     color: 'var(--amber)',           to: '/hold' },
  { key: 'enquiry',     label: 'Enquiry',     color: 'var(--text2)',           to: '/job-cards' },
  { key: 'design',      label: 'Design',      color: 'var(--purple, #7c3aed)', to: '/designers-view' },
  { key: 'jobsetter',   label: 'Job Setter',  color: 'var(--amber)',           to: '/jobsetter' },
  { key: 'production',  label: 'Production',  color: 'var(--red)',             to: '/production' },
  { key: 'qc',          label: 'QC',          color: 'var(--blue)',            to: '/qc' },
  { key: 'dispatch',    label: 'Dispatch',    color: 'var(--green)',           to: '/dispatch' },
  { key: 'approval',    label: '⏳ Approval',  color: 'var(--amber)',           to: '/designers-view' },
  { key: 'onlineStaff', label: '🟢 Online Staff', color: 'var(--green)',       to: '/hr-staff' },
];

export default function PipelineTiles({ title = '📊 All Time Overview' }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(() => {
    analyticsApi.pipeline().then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onChange = (msg) => {
      const path = String((msg && msg.path) || '');
      if (path.startsWith('mpw/jobs')) load();
    };
    socket.on('data:change', onChange);
    // Presence isn't a data change, so poll slowly to keep "online" honest.
    const poll = setInterval(load, 60000);
    return () => { socket.off('data:change', onChange); clearInterval(poll); };
  }, [load]);

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', border: 'none', background: 'var(--surface2)',
          color: 'var(--text)', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
          gap: 10, padding: 12,
        }}>
          {TILES.map((t) => (
            <div
              key={t.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(t.to)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(t.to); } }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
              style={{
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 12px', background: 'var(--surface)', minWidth: 0,
                cursor: 'pointer', transition: 'transform .12s ease, border-color .12s ease',
              }}
            >
              <div style={{
                fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase',
                color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: t.color, lineHeight: 1.25 }}>
                {data ? (data[t.key] ?? 0) : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
