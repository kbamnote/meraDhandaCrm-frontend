/**
 * Dependency-free dashboard primitives (no chart library) shared by all role
 * dashboards: KPI cards, a labeled horizontal bar list, and a vertical column
 * chart. All use the app's CSS variables so dark mode + branding apply.
 */
export function inr(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (Math.abs(v) >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  if (Math.abs(v) >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'k';
  return '₹' + v.toLocaleString('en-IN');
}

export function DashHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
      {subtitle ? <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{subtitle}</div> : null}
    </div>
  );
}

export function Kpi({ label, value, sub, color, icon }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {icon ? <span style={{ fontSize: 16 }}>{icon}</span> : null}
        <div style={{ fontSize: 24, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export function KpiGrid({ children, min = 150 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 12, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export function Section({ title, action, children }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
        {action || null}
      </div>
      {children}
    </div>
  );
}

// items: [{ label, value, color? }]
export function BarList({ items, money }) {
  if (!items || !items.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No data yet.</div>;
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  return (
    <div>
      {items.map((it) => {
        const pct = Math.round(((Number(it.value) || 0) / max) * 100);
        return (
          <div key={it.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{it.label}</span>
              <span style={{ fontWeight: 600 }}>{money ? inr(it.value) : (Number(it.value) || 0)}</span>
            </div>
            <div style={{ height: 9, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: it.color || 'var(--blue)', borderRadius: 5 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// data: [{ label, value }]
export function ColumnChart({ data, color = '#C05621', money, height = 150 }) {
  if (!data || !data.length) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>No data yet.</div>;
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height }}>
      {data.map((d, i) => {
        const pct = Math.round(((Number(d.value) || 0) / max) * 100);
        return (
          <div key={i} title={money ? inr(d.value) : String(d.value)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ width: '70%', height: `${pct}%`, minHeight: (Number(d.value) || 0) > 0 ? 3 : 0, background: color, borderRadius: '3px 3px 0 0' }} />
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function QuickLinks({ links }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {links.map((l) => (
        <a key={l.to} href={l.to} className="btn btn-ghost btn-sm">{l.label}</a>
      ))}
    </div>
  );
}
