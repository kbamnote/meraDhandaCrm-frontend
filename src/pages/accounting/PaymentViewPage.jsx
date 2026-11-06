/**
 * One payment voucher, opened from the register.
 *
 * Read-only: what was received or paid, how, and which bills it settled. The
 * balances shown against those bills are what they owe NOW, not what they
 * owed when this was recorded — a voucher still showing a stale balance would
 * be quietly wrong rather than usefully historic.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import { downloadPdf, printReport } from '../../components/common/reportExport';

const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');

/** One labelled figure in the details panel. */
function Field({ label, value, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {value === null || value === undefined || value === '' ? '—' : value}
      </div>
    </div>
  );
}

export default function PaymentViewPage() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setErr('No payment chosen.'); return; }
    try { setData(await accountingApi.payment(id)); setErr(''); }
    catch (e) { setData(null); setErr(describeError(e, 'Could not open this payment')); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const out = data && data.direction === 'out';
  const listPath = `/payments/${out ? 'out' : 'in'}`;

  const remove = async () => {
    if (!window.confirm(
      `Delete ${data.paymentNo || 'this payment'}?\n\n`
      + 'The bills it settled get their balance back and may stop showing as paid.\n\n'
      + 'This cannot be undone.',
    )) return;
    setBusy(true);
    try {
      await accountingApi.undoPayment(id);
      showToast('Deleted', 'success');
      navigate(listPath);
    } catch (e) {
      showToast(describeError(e, 'Could not delete'), 'error');
      setBusy(false);
    }
  };

  // The settled table, as a grid the shared PDF and Print helpers understand.
  const grid = data && {
    headers: ['Date', 'Invoice Number', 'Invoice Amount', ...(data.tdsTotal > 0 ? ['TDS'] : []),
      'Discount', out ? 'Amount Paid' : 'Amount Received', 'Balance Amount'],
    rows: data.settled.map((r) => [
      pretty(r.date), r.invoiceNo || '', r.total ?? '',
      ...(data.tdsTotal > 0 ? [r.tds] : []),
      r.discount, r.received, r.balance ?? '',
    ]),
  };
  const title = `${out ? 'Payment Out' : 'Payment In'} ${data ? (data.paymentNo || '') : ''}`.trim();

  if (err) {
    return (
      <div data-legacy-id="page-payment-view">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(listPath)}>←</button>
        <div className="card" style={{ marginTop: 12, padding: 30, textAlign: 'center', color: 'var(--red)' }}>{err}</div>
      </div>
    );
  }
  if (!data) {
    return <div data-legacy-id="page-payment-view" style={{ padding: 30, color: 'var(--text3)' }}>Loading…</div>;
  }

  return (
    <div data-legacy-id="page-payment-view">
      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(listPath)}>←</button>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
            {out ? 'Payment Out' : 'Payment In'}
            {data.paymentNo && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> {data.paymentNo}</span>}
          </h2>
        </div>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" disabled={!grid.rows.length}
            onClick={() => downloadPdf(title, grid, `${(data.paymentNo || 'payment').replace(/[^\w.-]+/g, '-')}.pdf`)}>
            Download PDF
          </button>
          <button className="btn btn-ghost btn-sm" data-testid="payment-print"
            disabled={!grid.rows.length} onClick={() => printReport(title, grid)}>Print</button>
          <button className="btn btn-primary btn-sm" data-testid="payment-edit"
            onClick={() => navigate(`/payments/${out ? 'out' : 'in'}/new?id=${encodeURIComponent(id)}`)}>
            ✎ Edit
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
            data-testid="payment-view-delete" disabled={busy} onClick={remove}>
            {busy ? '…' : '🗑 Delete'}
          </button>
        </div>
      </div>

      {/* ── Payment details ── */}
      <div className="card" style={{ padding: 0, marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13.5 }}>
          Payment Details
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
          <Field label="Party Name" value={
            data.partyId ? (
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/accounting/parties')}
                style={{ padding: 0, fontWeight: 600, fontSize: 13.5, color: 'var(--primary, #2563EB)' }}>
                {data.partyName}
              </button>
            ) : data.partyName
          } />
          <Field label="Payment Date" value={pretty(data.date)} />
          <Field label={out ? 'Amount Paid' : 'Amount Received'} value={inr(data.amount)} />
          <Field label={`${out ? 'Payment Out' : 'Payment In'} Discount`} value={inr(data.discount)} />
          {/* Only shown when there is any — a TDS row reading ₹0 on every
              receipt is noise on the ones that never had it. */}
          {data.tdsTotal > 0 && <Field label="TDS Deducted" value={inr(data.tdsTotal)} />}
          <Field label="Payment Mode" value={data.mode} />
          <Field label={out ? 'Paid From' : 'Received In'} value={data.bankName || (data.mode || 'Cash')} />
          {data.reference && <Field label="Reference" value={data.reference} mono />}
          {data.onAccount > 0 && (
            <Field label="Held On Account" value={
              <span style={{ color: 'var(--amber)' }}>{inr(data.onAccount)}</span>
            } />
          )}
          {data.notes && <Field label="Notes" value={data.notes} />}
        </div>
      </div>

      {/* ── What it settled ── */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13.5 }}>
          Invoices settled with this payment
        </div>

        {!data.settled.length ? (
          <div style={{ padding: 34, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            This payment was not applied to any bill
            {data.onAccount > 0 && <> — the whole {inr(data.onAccount)} is held on account</>}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="crm-table" style={{ fontSize: 12.5, minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Date</th><th>Invoice Number</th>
                  <th style={{ textAlign: 'right' }}>Invoice Amount</th>
                  {data.tdsTotal > 0 && <th style={{ textAlign: 'right' }}>TDS</th>}
                  <th style={{ textAlign: 'right' }}>Discount</th>
                  <th style={{ textAlign: 'right' }}>{out ? 'Amount Paid' : 'Amount Received'}</th>
                  <th style={{ textAlign: 'right' }}>Balance Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.settled.map((r, i) => (
                  <tr key={r.invoiceId || i} data-testid="settled-row">
                    <td style={{ whiteSpace: 'nowrap' }}>{pretty(r.date)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                      {r.invoiceId && !r.missing ? (
                        <button type="button" className="btn btn-ghost"
                          onClick={() => navigate(`/${out ? 'purchase-view' : 'invoice-view'}?id=${encodeURIComponent(r.invoiceId)}`)}
                          style={{ padding: 0, color: 'var(--primary, #2563EB)', fontWeight: 600, fontSize: 11.5 }}>
                          {r.invoiceNo || '—'}
                        </button>
                      ) : (r.invoiceNo || '—')}
                      {/* The bill is gone but the receipt still names it, which
                          is more honest than an empty row. */}
                      {r.missing && <span style={{ color: 'var(--text3)' }}> · deleted</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{r.total == null ? '—' : inr(r.total)}</td>
                    {data.tdsTotal > 0 && (
                      <td style={{ textAlign: 'right' }}>{r.tds ? inr(r.tds) : '—'}</td>
                    )}
                    <td style={{ textAlign: 'right' }}>{r.discount ? inr(r.discount) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(r.received)}</td>
                    <td style={{ textAlign: 'right', color: r.balance > 0 ? 'var(--red)' : 'var(--text3)' }}>
                      {r.balance == null ? '—' : inr(r.balance)}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: 'right' }}>{inr(data.totals.invoiceAmount)}</td>
                  {data.tdsTotal > 0 && <td style={{ textAlign: 'right' }}>{inr(data.totals.tds)}</td>}
                  <td style={{ textAlign: 'right' }}>{inr(data.totals.discount)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(data.totals.received)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(data.totals.balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
