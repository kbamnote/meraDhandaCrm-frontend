/**
 * Sales Admin dashboard — read-only.
 * Subscribes to mpw/sales + mpw/leads and shows summary cards (total sales ₹,
 * won/open/lost counts, leads by stage) plus a table of recent sales.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';

function inr(n) {
  const num = Number(n) || 0;
  return '₹' + num.toLocaleString('en-IN');
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'won' || s === 'closed' || s === 'paid') return 'badge badge-green';
  if (s === 'lost' || s === 'cancelled' || s === 'canceled') return 'badge badge-red';
  if (s === 'open' || s === 'pending') return 'badge badge-amber';
  return 'badge badge-blue';
}

export default function SalesAdminPage() {
  const [sales, setSales] = useState({});
  const [leads, setLeads] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/sales'), (snap) => setSales(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/leads'), (snap) => setLeads(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const saleList = useMemo(
    () => Object.entries(sales).map(([id, s]) => ({ ...s, id })),
    [sales]
  );

  const leadList = useMemo(
    () => Object.entries(leads).map(([id, l]) => ({ ...l, id })),
    [leads]
  );

  const totalSales = useMemo(
    () => saleList.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    [saleList]
  );

  const counts = useMemo(() => {
    const c = { won: 0, open: 0, lost: 0 };
    saleList.forEach((s) => {
      const st = String(s.status || '').toLowerCase();
      if (st === 'won' || st === 'closed' || st === 'paid') c.won += 1;
      else if (st === 'lost' || st === 'cancelled' || st === 'canceled') c.lost += 1;
      else c.open += 1;
    });
    return c;
  }, [saleList]);

  const leadsByStage = useMemo(() => {
    const map = {};
    leadList.forEach((l) => {
      const stage = l.stage || l.status || 'unknown';
      map[stage] = (map[stage] || 0) + 1;
    });
    return Object.entries(map).map(([stage, count]) => ({ stage, count }));
  }, [leadList]);

  const recent = useMemo(() => saleList.slice(-10).reverse(), [saleList]);

  const cards = [
    { label: 'Total Sales', value: inr(totalSales), icon: '💰' },
    { label: 'Won', value: counts.won, icon: '✅' },
    { label: 'Open', value: counts.open, icon: '⏳' },
    { label: 'Lost', value: counts.lost, icon: '❌' },
  ];

  return (
    <div data-legacy-id="page-sales-admin">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>📊 Sales Admin</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {saleList.length} {saleList.length === 1 ? 'sale' : 'sales'} · {leadList.length} leads
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="card mb-4">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Leads by stage</div>
        {!leadsByStage.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No leads yet.</div>
        ) : (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {leadsByStage.map((s) => (
              <span key={s.stage} className="badge badge-blue">
                {s.stage}: {s.count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recent sales</div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!recent.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No sales yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Product</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.client || s.customer || '—'}</td>
                  <td>{s.product || s.item || '—'}</td>
                  <td>{inr(s.amount)}</td>
                  <td><span className={statusBadgeClass(s.status)}>{s.status || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
