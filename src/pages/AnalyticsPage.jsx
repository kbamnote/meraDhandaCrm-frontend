import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState({});
  const [invoices, setInvoices] = useState({});
  const [jobs, setJobs] = useState({});
  const [products, setProducts] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/leads'), (snap) => setLeads(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/invoices'), (snap) => setInvoices(snap.val() || {}));
    const u3 = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    const u4 = onValue(ref(db, 'mpw/products'), (snap) => setProducts(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const leadList = useMemo(() => Object.values(leads || {}), [leads]);
  const invoiceList = useMemo(() => Object.values(invoices || {}), [invoices]);

  const leadCount = leadList.length;
  const invoiceCount = invoiceList.length;
  const jobCount = Object.keys(jobs || {}).length;
  const productCount = Object.keys(products || {}).length;

  const stageGroups = useMemo(() => {
    const map = {};
    leadList.forEach((l) => {
      const stage = (l && l.stage) || 'unspecified';
      map[stage] = (map[stage] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [leadList]);

  const totalAmount = useMemo(
    () => invoiceList.reduce((sum, inv) => sum + (Number(inv && inv.amount) || 0), 0),
    [invoiceList]
  );

  const unpaidCount = useMemo(
    () => invoiceList.filter((inv) => inv && inv.status !== 'paid').length,
    [invoiceList]
  );

  const cards = [
    { label: 'Leads', icon: '📞', value: leadCount },
    { label: 'Invoices', icon: '🧾', value: invoiceCount },
    { label: 'Jobs', icon: '🛠', value: jobCount },
    { label: 'Products', icon: '🛍', value: productCount },
  ];

  return (
    <div data-legacy-id="page-analytics">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>📊 Analytics</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Business at a glance{profile?.name ? ` · ${profile.name}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginTop: 16 }}>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Invoiced total</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
            ₹{(totalAmount || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            across {invoiceCount} invoice{invoiceCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Unpaid invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2, color: unpaidCount ? 'var(--red)' : 'inherit' }}>
            {unpaidCount}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
            status not “paid”
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Leads by stage</div>
        {!stageGroups.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No leads yet.</div>
        ) : (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {stageGroups.map(([stage, count]) => (
              <span key={stage} className="badge badge-blue">
                {stage}: <b>{count}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
