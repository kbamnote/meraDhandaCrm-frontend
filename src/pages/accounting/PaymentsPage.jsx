/**
 * Payment In / Payment Out — the voucher register.
 *
 * One component for both sides. A receipt and a payment differ in direction
 * and in two column labels; everything else — the numbering, the period
 * filter, the search, the row menu — is the same, and keeping them as one
 * screen is what stops them drifting apart.
 *
 * "Total Amount Settled" and "Amount Paid" are deliberately separate columns.
 * They differ whenever an advance is taken or a discount given, and showing
 * only the money is how an on-account receipt becomes invisible.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import { usePeriod, PeriodPicker } from '../../components/common/ReportShell';
import ExportButtons from '../../components/common/reportExport';

const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');

export default function PaymentsPage({ direction = 'in' }) {
  const navigate = useNavigate();
  const out = direction === 'out';
  const period = usePeriod('year');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const { from, to } = period.range;

  const load = useCallback(async () => {
    if (!from || !to) return;
    setBusy(true);
    try { setData(await accountingApi.payments({ direction, from, to })); }
    catch (e) { showToast(describeError(e, 'Could not load payments'), 'error'); }
    finally { setBusy(false); }
  }, [direction, from, to]);

  useEffect(() => { load(); }, [load]);

  // Filtered here rather than on the server: the period query already bounds
  // the set, and typing should not cost a round trip.
  const rows = useMemo(() => {
    const all = (data && data.rows) || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) => [r.paymentNo, r.partyName, r.invoiceNo, r.reference, r.mode]
      .some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [data, q]);

  const totals = useMemo(() => rows.reduce((a, r) => ({
    amount: Math.round((a.amount + r.amount) * 100) / 100,
    settled: Math.round((a.settled + r.settled) * 100) / 100,
  }), { amount: 0, settled: 0 }), [rows]);

  const grid = useMemo(() => ({
    headers: ['Date', 'Payment Number', 'Party Name', 'Total Amount Settled',
      out ? 'Amount Paid' : 'Amount Received', 'Discount', 'On Account', 'Payment Mode'],
    rows: rows.map((r) => [r.date, r.paymentNo || '', r.partyName, r.settled,
      r.amount, r.discount, r.onAccount, r.mode || '']),
  }), [rows, out]);

  const remove = async (r) => {
    setMenuFor(null);
    if (!window.confirm(
      `Delete ${r.paymentNo || 'this payment'}?\n\n`
      + 'The bill it settled gets its balance back and may stop showing as paid.\n\n'
      + 'This cannot be undone.',
    )) return;
    try {
      await accountingApi.undoPayment(r.id);
      showToast('Deleted', 'success');
      load();
    } catch (e) { showToast(describeError(e, 'Could not delete'), 'error'); }
  };

  const COLS = '110px minmax(150px,1.1fr) minmax(160px,1.4fr) 140px 140px 130px 40px';

  return (
    <div data-legacy-id={`page-payment-${direction}`}>
      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
          {out ? 'Payment Out' : 'Payment In'}
        </h2>
        <button className="btn btn-primary btn-sm" data-testid="payment-create"
          onClick={() => navigate(`/payments/${direction}/new`)}>
          + {out ? 'Create Payment Out' : 'Create Payment In'}
        </button>
      </div>

      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input className="input" style={{ width: 220 }} placeholder="🔍  Number, party, reference…"
            value={q} onChange={(e) => setQ(e.target.value)} data-testid="payment-search" />
          <PeriodPicker period={period} />
        </div>
        <ExportButtons title={out ? 'Payment Out' : 'Payment In'} grid={grid}
          fileBase={`payment-${direction}-${from}-to-${to}`} />
      </div>

      {busy && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Loading…</div>}

      <div className="card" style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 840 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <div>Date</div><div>Payment Number</div><div>Party Name</div>
              <div style={{ textAlign: 'right' }}>Total Amount Settled</div>
              <div style={{ textAlign: 'right' }}>{out ? 'Amount Paid' : 'Amount Received'}</div>
              <div>Payment Mode</div><div />
            </div>

            {!rows.length && !busy && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                {(data && data.rows.length) ? 'Nothing matches that search.' : 'No payments in this period.'}
              </div>
            )}

            {rows.map((r) => (
              <div key={r.id} data-testid="payment-row"
                style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '11px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center', position: 'relative' }}>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap' }}>{pretty(r.date)}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{r.paymentNo || '—'}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.partyId ? (
                    <button type="button" className="btn btn-ghost"
                      onClick={() => navigate('/accounting/parties')}
                      style={{ padding: 0, color: 'var(--primary, #2563EB)', fontWeight: 600, fontSize: 12.5 }}>
                      {r.partyName}
                    </button>
                  ) : r.partyName}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {inr(r.settled)}
                  {/* An advance settles nothing, which otherwise reads as a
                      broken row rather than money held against future bills. */}
                  {r.onAccount > 0 && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--amber)' }}>
                      {inr(r.onAccount)} on account
                    </span>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  {inr(r.amount)}
                  {r.discount > 0 && (
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                      +{inr(r.discount)} discount
                    </span>
                  )}
                </div>
                <div style={{ color: 'var(--text2)' }}>{r.mode || '—'}</div>
                <div style={{ position: 'relative' }}>
                  <button type="button" className="btn btn-xs btn-ghost" data-testid="payment-menu"
                    onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                    style={{ padding: '1px 6px' }}>⋮</button>
                  {menuFor === r.id && (
                    <>
                      {/* Click-away, so the menu does not strand itself open. */}
                      <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setMenuFor(null)} />
                      <div className="card" style={{ position: 'absolute', right: 0, top: 24, zIndex: 21, padding: 4, minWidth: 150 }}>
                        <button className="btn btn-xs btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left' }}
                          onClick={() => { setMenuFor(null); navigate('/accounting/cash'); }}>
                          View in Cash &amp; Bank
                        </button>
                        <button className="btn btn-xs btn-ghost" style={{ display: 'block', width: '100%', textAlign: 'left', color: 'var(--red)' }}
                          data-testid="payment-delete" onClick={() => remove(r)}>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}

            {rows.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '11px 12px', fontSize: 12.5, fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <div style={{ gridColumn: '1 / 4' }}>Total ({rows.length})</div>
                <div style={{ textAlign: 'right' }}>{inr(totals.settled)}</div>
                <div style={{ textAlign: 'right' }}>{inr(totals.amount)}</div>
                <div /><div />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// The route table renders components with no props, so each side gets a name.
export const PaymentInPage = () => <PaymentsPage direction="in" />;
export const PaymentOutPage = () => <PaymentsPage direction="out" />;
