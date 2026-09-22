/**
 * Dependency-free dashboard primitives (no chart library) shared by all role
 * dashboards: KPI cards, a labeled horizontal bar list, and a vertical column
 * chart. All use the app's CSS variables so dark mode + branding apply.
 */
/**
 * Money, in full, with Indian grouping: ₹4,900 — never ₹4.9k.
 *
 * This used to abbreviate above a thousand, which is fine on a chart axis and
 * wrong everywhere money is being checked: ₹4.9k could be ₹4,850 or ₹4,949, and
 * an invoice line, a balance or a statement has to show the actual figure. The
 * rounding also made totals look like they didn't add up.
 *
 * Paise are shown only when there are any, so ₹28.98 keeps its paise while
 * ₹4,900 doesn't gain a pointless ".00".
 */
export function inr(n) {
  const v = Number(n) || 0;
  const hasPaise = Math.round(v * 100) % 100 !== 0;
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Abbreviated form — ₹4.9k / ₹1.20 L / ₹1.05 Cr — for chart axes and tiles
 * where the exact figure is not the point and the space genuinely will not take
 * it. Never use it where someone might reconcile the number against a document.
 */
export function inrCompact(n) {
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

// `onClick` is optional — pass it to make the tile a shortcut to the page that
// backs the number. Without it the card renders exactly as before.
// A figure shrinks rather than overflows. Indian grouping makes rupee amounts
// long — ₹96,66,550 is ten characters before the icon — and at a fixed 24px it
// ran straight out of a 150px card. Shrinking beats truncating: an ellipsis on a
// money figure hides exactly the digits someone is reading it for.
function kpiFontSize(value) {
  const n = String(value ?? '').length;
  if (n <= 8) return 24;
  if (n <= 11) return 20;
  if (n <= 14) return 17;
  return 15;
}

export function Kpi({ label, value, sub, color, icon, onClick }) {
  const clickable = typeof onClick === 'function';
  return (
    <div
      className="card"
      style={{
        padding: 16,
        // A grid item's default min-width is its content, which is what let a
        // long figure push past the card edge. 0 lets the card own its width.
        minWidth: 0,
        overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'transform .12s ease, box-shadow .12s ease',
      }}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onMouseEnter={clickable ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,.10)'; } : undefined}
      onMouseLeave={clickable ? (e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        {icon ? <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span> : null}
        <div
          data-testid="kpi-value"
          title={String(value ?? '')}
          style={{
            fontSize: kpiFontSize(value), fontWeight: 800, color: color || 'var(--text)', lineHeight: 1.1,
            minWidth: 0,
            // Last resort on a very narrow screen: wrap inside the card rather
            // than spill out of it.
            overflowWrap: 'anywhere',
          }}
        >
          {value}
        </div>
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
