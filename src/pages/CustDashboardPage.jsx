import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';

export default function CustDashboardPage() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState({});
  const [invoices, setInvoices] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/invoices'), (snap) => setInvoices(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const jobList = useMemo(() => Object.values(jobs || {}), [jobs]);
  const invoiceList = useMemo(() => Object.values(invoices || {}), [invoices]);

  const myJobs = jobList.length;
  const openInvoices = useMemo(
    () => invoiceList.filter((inv) => inv && inv.status !== 'paid').length,
    [invoiceList]
  );

  const cards = [
    { label: 'My jobs', icon: '🛠', value: myJobs },
    { label: 'Open invoices', icon: '🧾', value: openInvoices },
  ];

  return (
    <div data-legacy-id="page-cust-dashboard">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        👋 Welcome{profile?.name ? `, ${profile.name}` : ''}
      </h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Here’s a quick look at your orders and bills.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, background: 'var(--blue-light)', borderColor: 'var(--blue)' }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--blue-dark)' }}>Need help?</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Reach out to our team for anything about your jobs or invoices. We’re happy to help.
        </div>
      </div>
    </div>
  );
}
