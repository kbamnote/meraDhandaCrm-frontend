/**
 * My Salary — personal self-service page.
 * Lists the caller's own salary slips via meApi.payroll().
 */
import { useEffect, useMemo, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';

function inr(v) {
  const n = Number(v || 0);
  return '₹' + (Number.isFinite(n) ? n.toLocaleString('en-IN') : '0');
}

export default function MySalaryPage() {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await meApi.payroll();
        if (active) setSlips(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to load salary slips', 'error');
        if (active) setSlips([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalNet = useMemo(
    () => slips.reduce((sum, s) => sum + Number(s.net || 0), 0),
    [slips]
  );

  if (loading) {
    return (
      <div data-legacy-id="page-my-salary" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-salary">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>💰 My Salary</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {slips.length} {slips.length === 1 ? 'slip' : 'slips'}
          {slips.length ? <> · total net paid {inr(totalNet)}</> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!slips.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No salary slips yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Year</th>
                <th style={{ textAlign: 'right' }}>Basic</th>
                <th style={{ textAlign: 'right' }}>Allowances</th>
                <th style={{ textAlign: 'right' }}>Deductions</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s, i) => (
                <tr key={s.id || `${s.year || ''}-${s.month || ''}-${i}`}>
                  <td>{s.month || '—'}</td>
                  <td>{s.year || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.basic)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.allowances)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.deductions)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
