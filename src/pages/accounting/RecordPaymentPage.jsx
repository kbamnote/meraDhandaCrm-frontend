/**
 * Record Payment In / Payment Out.
 *
 * Choose the party, and their open bills appear; the money is applied to them
 * oldest-first as you type, which is what happens if you say nothing, and each
 * row can then be overridden.
 *
 * The amount and the discount are separate: a settlement discount is money
 * written off, not money received, so ₹9,800 with ₹200 discount clears a
 * ₹10,000 bill. Anything the bills do not absorb stays on account.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import BankAccountSelect from '../../components/common/BankAccountSelect';
import { PAY_MODES, isCashMode, modeOptions } from '../../config/payModes';

const R2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const todayStr = () => new Date().toISOString().slice(0, 10);
const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');

export default function RecordPaymentPage() {
  const { direction: dirParam } = useParams();
  const direction = dirParam === 'out' ? 'out' : 'in';
  const out = direction === 'out';
  const navigate = useNavigate();

  const [voucher, setVoucher] = useState(null);
  const [party, setParty] = useState(null);
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState([]);
  const [bills, setBills] = useState(null);
  const [alloc, setAlloc] = useState({});        // billId -> money typed on that row
  const [touched, setTouched] = useState(false); // has the user overridden?
  // Per-bill TDS and write-off: relief that is not money. billId -> amount.
  const [rowTds, setRowTds] = useState({});
  const [rowDisc, setRowDisc] = useState({});
  const [applying, setApplying] = useState(null); // { bill, kind: 'tds' | 'discount' }
  const [sections, setSections] = useState([]);
  const [form, setForm] = useState({
    amount: '', discount: '', date: todayStr(), mode: 'Cash', bankAccountId: '', reference: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    accountingApi.paymentNumber(direction).then(setVoucher).catch(() => setVoucher(null));
  }, [direction]);

  // The statutory rate table, for the Apply TDS picker. Only a receipt can
  // carry TDS withheld BY someone: on a payment out we are the one deducting,
  // which is the TDS voucher screen's job, not this one.
  useEffect(() => {
    if (out) return;
    accountingApi.tdsSections().then((r) => setSections(Array.isArray(r) ? r : [])).catch(() => setSections([]));
  }, [out]);

  // ── party search ────────────────────────────────────────────────────────
  // EVERY party, both customers and suppliers, on both screens. They live in
  // separate collections here, so searching only one hid every party filed on
  // the other — and a printing shop buys from and sells to the same people.
  // An empty query browses rather than returning nothing.
  useEffect(() => {
    if (party) { setMatches([]); return undefined; }
    const id = setTimeout(() => {
      accountingApi.searchParties(q.trim(), null)
        .then((r) => setMatches(Array.isArray(r) ? r : []))
        .catch(() => setMatches([]));
    }, q.trim() ? 250 : 0);
    return () => clearTimeout(id);
  }, [q, party]);

  // A payment settles bills only when the money flows the way bills are paid:
  // a customer paying in, or a supplier being paid out. The other two
  // combinations are refunds — real, but they move the party's balance and
  // settle nothing, so there is no bill list to show.
  const settlesBills = party && (out ? party.type === 'vendor' : party.type === 'client');

  const pickParty = async (p) => {
    setParty(p); setMatches([]); setBills(null);
    setAlloc({}); setTouched(false); setRowTds({}); setRowDisc({});
    const settles = out ? p.type === 'vendor' : p.type === 'client';
    if (!settles) { setBills([]); return; }
    try {
      const r = await accountingApi.openBills(p.id, p.type);
      setBills(r.rows || []);
    } catch (e) {
      setBills([]);
      showToast(describeError(e, 'Could not load this party’s bills'), 'error');
    }
  };

  // ── allocation ──────────────────────────────────────────────────────────
  const settleable = R2(Number(form.amount) + Number(form.discount));
  // TDS and write-offs settle a bill without being money, so they add to what
  // this payment can clear.
  const nonCash = R2((bills || []).reduce(
    (a, b) => a + Number(rowTds[b.id] || 0) + Number(rowDisc[b.id] || 0), 0,
  ));
  const capacity = R2(settleable + nonCash);

  /**
   * Oldest-first spread of whatever is available — the default behaviour.
   *
   * The map holds the MONEY on each row; the row's total relief is that plus
   * its own TDS and write-off, which is what the bill's Due is measured
   * against.
   */
  const autoAlloc = useMemo(() => {
    const outp = {};
    let left = capacity;
    for (const b of (bills || [])) {
      if (left <= 0) break;
      const relief = R2(Math.min(b.due, left));
      if (relief <= 0) continue;
      const nc = R2(Number(rowTds[b.id] || 0) + Number(rowDisc[b.id] || 0));
      outp[b.id] = R2(Math.max(0, relief - nc));
      left = R2(left - relief);
    }
    return outp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bills, capacity, JSON.stringify(rowTds), JSON.stringify(rowDisc)]);

  // Until the user edits a row, the allocation follows the amount as it is
  // typed. After that it is theirs and must not be rewritten underneath them.
  const effective = touched ? alloc : autoAlloc;
  // The money on the rows, which is what the Amount Received has to cover.
  const allocated = R2(Object.values(effective).reduce((a, n) => a + (Number(n) || 0), 0));
  const unapplied = R2(settleable - allocated);
  const over = allocated > settleable + 0.001;
  // Column totals, as the screenshot's footer shows them.
  const tdsTotal = R2((bills || []).reduce((a, b) => a + Number(rowTds[b.id] || 0), 0));
  const discTotal = R2((bills || []).reduce((a, b) => a + Number(rowDisc[b.id] || 0), 0));

  const setRow = (billId, value) => {
    setAlloc({ ...effective, [billId]: value });
    setTouched(true);
  };

  const cashSelected = isCashMode(form.mode);

  const save = async () => {
    if (!party) { showToast('Choose a party first', 'error'); return; }
    if (!(Number(form.amount) > 0)) { showToast('Enter the amount', 'error'); return; }
    if (over) { showToast('You have allocated more than the payment', 'error'); return; }
    setSaving(true);
    try {
      // `applied` is the MONEY on the row; the server adds the row's TDS and
      // write-off to get the relief the bill actually receives.
      const allocations = Object.entries(effective)
        .map(([invoiceId, applied]) => ({
          invoiceId,
          applied: R2(applied),
          tds: R2(rowTds[invoiceId]),
          discount: R2(rowDisc[invoiceId]),
        }))
        .filter((a) => a.applied > 0 || a.tds > 0 || a.discount > 0);
      const r = await accountingApi.partyPayment(party.id, {
        // The party's own side decides which head the money posts against;
        // the SCREEN decides which way it went. Sending the screen's side as
        // the party type would file a supplier's refund as money paid out.
        partyType: party.type,
        direction,
        amount: R2(form.amount),
        discount: R2(form.discount),
        date: form.date,
        mode: form.mode,
        bankAccountId: cashSelected ? null : (form.bankAccountId || null),
        reference: form.reference || null,
        notes: form.notes || null,
        // Sent when the user chose the split, or when any row carries TDS or
        // a write-off — those live nowhere else, so leaving them out would
        // silently drop them. Otherwise the server does its own oldest-first,
        // which is the same thing minus a round trip of numbers that could
        // disagree.
        ...(touched || tdsTotal > 0 || discTotal > 0 ? { allocations } : {}),
      });
      showToast(`${(r && r.payment && r.payment.paymentNo) || 'Payment'} saved`, 'success');
      navigate(`/payments/${direction}`);
    } catch (e) {
      showToast(describeError(e, 'Could not save this payment'), 'error');
      setSaving(false);
    }
  };

  const totalDue = R2((bills || []).reduce((a, b) => a + b.due, 0));

  return (
    <div data-legacy-id={`page-record-payment-${direction}`}>
      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/payments/${direction}`)}>←</button>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
            Record {out ? 'Payment Out' : 'Payment In'}
            {voucher && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> #{voucher.number}</span>}
          </h2>
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/payments/${direction}`)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !party} data-testid="payment-save">
            {saving ? '…' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 14, marginBottom: 14 }}>
        {/* ── who, and how much ── */}
        <div className="card">
          <div className="form-group">
            <label>Party Name</label>
            {party ? (
              <div className="flex items-center justify-between" style={{ gap: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{party.name}</span>
                  <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>
                    {' · '}{party.type === 'vendor' ? 'Supplier' : 'Customer'}
                  </span>
                </span>
                <button className="btn btn-xs btn-ghost" data-testid="payment-change-party"
                  onClick={() => {
                    setParty(null); setQ(''); setBills(null);
                    setAlloc({}); setTouched(false); setRowTds({}); setRowDisc({});
                  }}>
                  Change
                </button>
              </div>
            ) : (
              <input className="input" autoFocus data-testid="payment-party"
                placeholder="Search any party by name or number — or just pick one below"
                value={q} onChange={(e) => setQ(e.target.value)} />
            )}
          </div>

          {!party && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
              {!matches.length ? (
                <div style={{ padding: 14, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
                  {q.trim() ? 'No party matches that.' : 'Loading parties…'}
                </div>
              ) : matches.map((c) => (
                <button key={`${c.type}-${c.id}`} type="button" className="btn btn-ghost" data-testid="payment-party-match"
                  onClick={() => pickParty(c)}
                  style={{ display: 'flex', width: '100%', textAlign: 'left', borderRadius: 0, padding: '8px 10px', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                    {c.phone && <span style={{ color: 'var(--text3)', fontSize: 11.5 }}> · {c.phone}</span>}
                  </span>
                  {/* Which side they are filed on, because it decides whether
                      this payment can settle bills or is a refund. */}
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap', background: 'var(--surface2)', color: 'var(--text3)' }}>
                    {c.type === 'vendor' ? 'Supplier' : 'Customer'}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{out ? 'Amount Paid' : 'Amount Received'}</label>
              <input className="input" type="number" min="0" step="0.01" value={form.amount}
                data-testid="payment-amount"
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{out ? 'Payment Out' : 'Payment In'} Discount</label>
              <input className="input" type="number" min="0" step="0.01" value={form.discount}
                data-testid="payment-discount"
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                Written off, not received — it settles the bill alongside the money.
              </div>
            </div>
          </div>
        </div>

        {/* ── when, how, and the voucher ── */}
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Payment Date</label>
              <input className="input" type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Payment Mode</label>
              <select className="input" value={form.mode} data-testid="payment-mode"
                onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))}>
                {modeOptions(form.mode).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>{out ? 'Payment Out' : 'Payment In'} Number</label>
              <input className="input" readOnly value={voucher ? voucher.paymentNo : '…'}
                data-testid="payment-number"
                title="Taken when you save, so an abandoned form does not burn a number" />
            </div>
            {!cashSelected && (
              <div className="form-group" style={{ margin: 0 }}>
                <label>Bank Account</label>
                <BankAccountSelect value={form.bankAccountId}
                  onChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))} />
              </div>
            )}
            <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label>Reference</label>
              <input className="input" value={form.reference} placeholder="UTR, cheque no…"
                onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="input" rows={2} value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      {/* ── the bills this settles ── */}
      <div className="card" style={{ padding: 0 }}>
        {!party ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No party selected</div>
            <div style={{ fontSize: 13 }}>Choose a party above to see what they owe.</div>
          </div>
        ) : !settlesBills ? (
          // Money flowing against the party's usual side is a refund. Real,
          // and worth recording — it just settles nothing.
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              {out ? 'Refund to a customer' : 'Refund from a supplier'}
            </div>
            {party.name} is a {party.type === 'vendor' ? 'supplier' : 'customer'}, so money
            {out ? ' going out to them' : ' coming in from them'} is a refund rather than a
            settlement. It moves their balance and is not applied to any bill.
          </div>
        ) : bills === null ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading bills…</div>
        ) : !bills.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            {party.name} has nothing outstanding. The whole amount will be held on account.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                Outstanding bills · {inr(totalDue)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {touched
                  ? 'You are choosing the split.'
                  : 'Applied oldest first — edit any row to take over.'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="crm-table" style={{ fontSize: 12.5, minWidth: 620 }}>
                <thead>
                  <tr>
                    <th>Bill No</th><th>Date</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Due</th>
                    {!out && <th style={{ textAlign: 'right' }}>TDS</th>}
                    <th style={{ textAlign: 'right' }}>Discount</th>
                    <th style={{ textAlign: 'right', width: 150 }}>
                      {out ? 'Amount Paid' : 'Amount Received'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                    <tr key={b.id} data-testid="open-bill-row">
                      <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{b.no || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{pretty(b.date)}</td>
                      <td style={{ textAlign: 'right' }}>{inr(b.total)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(b.due)}</td>
                      {/* TDS is tax the CUSTOMER withheld, so it belongs on a
                          receipt only. On a payment out we are the deductor,
                          which is the TDS voucher screen's job. */}
                      {!out && (
                        <td style={{ textAlign: 'right' }}>
                          {Number(rowTds[b.id]) > 0 ? (
                            <button type="button" className="btn btn-ghost btn-xs" data-testid="bill-tds-set"
                              onClick={() => setApplying({ bill: b, kind: 'tds' })}
                              style={{ padding: 0, fontWeight: 600 }}>{inr(Number(rowTds[b.id]))}</button>
                          ) : (
                            <button type="button" className="btn btn-ghost btn-xs" data-testid="bill-tds"
                              onClick={() => setApplying({ bill: b, kind: 'tds' })}
                              style={{ padding: 0, color: 'var(--primary, #2563EB)' }}>Apply TDS</button>
                          )}
                        </td>
                      )}
                      <td style={{ textAlign: 'right' }}>
                        {Number(rowDisc[b.id]) > 0 ? (
                          <button type="button" className="btn btn-ghost btn-xs" data-testid="bill-discount-set"
                            onClick={() => setApplying({ bill: b, kind: 'discount' })}
                            style={{ padding: 0, fontWeight: 600 }}>{inr(Number(rowDisc[b.id]))}</button>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-xs" data-testid="bill-discount"
                            onClick={() => setApplying({ bill: b, kind: 'discount' })}
                            style={{ padding: 0, color: 'var(--primary, #2563EB)' }}>Apply Discount</button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input className="input" type="number" min="0" max={b.due} step="0.01"
                          data-testid="bill-allocation"
                          style={{ width: 130, textAlign: 'right' }}
                          value={effective[b.id] ?? ''}
                          onChange={(e) => setRow(b.id, e.target.value)} />
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4}>Total</td>
                    {!out && <td style={{ textAlign: 'right' }} data-testid="tds-total">{inr(tdsTotal)}</td>}
                    <td style={{ textAlign: 'right' }}>{inr(discTotal)}</td>
                    <td style={{ textAlign: 'right' }}>{inr(allocated)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}

        {party && (
          <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
              Settling <b style={{ color: 'var(--text)' }}>{inr(allocated)}</b>
              {Number(form.discount) > 0 && <> (incl. {inr(Number(form.discount))} discount)</>}
            </span>
            {over ? (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--red)' }} data-testid="payment-over">
                {inr(allocated - settleable)} more than the payment
              </span>
            ) : unapplied > 0 ? (
              <span style={{ fontSize: 12.5, color: 'var(--amber)' }} data-testid="payment-onaccount">
                {inr(unapplied)} will be held on account
              </span>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--green)' }}>Fully applied</span>
            )}
          </div>
        )}
      </div>

      {applying && (
        <ApplyToBillModal
          bill={applying.bill}
          kind={applying.kind}
          sections={sections}
          current={applying.kind === 'tds' ? rowTds[applying.bill.id] : rowDisc[applying.bill.id]}
          onClose={() => setApplying(null)}
          onApply={(value) => {
            const set = applying.kind === 'tds' ? setRowTds : setRowDisc;
            set((m) => ({ ...m, [applying.bill.id]: value }));
            setApplying(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Apply TDS, or a discount, to one bill.
 *
 * TDS is picked as a RATE and shown as an amount, because that is how it is
 * agreed and how the customer's certificate will read — but what is stored is
 * the rupees, since a rate on a part-paid bill is ambiguous about which figure
 * it applies to.
 */
function ApplyToBillModal({ bill, kind, sections, current, onClose, onApply }) {
  const isTds = kind === 'tds';
  const [rate, setRate] = useState('');
  const [amount, setAmount] = useState(current ? String(current) : '');

  // Rates on the bill's OUTSTANDING figure, which is what this payment is
  // settling — not the original total, which may be part paid already.
  const pick = (r) => {
    setRate(r);
    if (r === '') return;
    setAmount(String(R2((bill.due * Number(r)) / 100)));
  };

  const value = R2(amount);
  const tooMuch = value > bill.due + 0.001;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: 430, maxWidth: '100%', padding: 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {isTds ? 'Apply TDS' : 'Apply Discount'}
          </h3>
          <button className="btn btn-xs btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
          {bill.no || 'This bill'} · {inr(bill.due)} outstanding
        </div>

        {isTds && (
          <div className="form-group">
            <label>TDS Rate</label>
            <select className="input" value={rate} onChange={(e) => pick(e.target.value)} data-testid="tds-rate">
              <option value="">Select TDS rate</option>
              {sections.map((s) => (
                <option key={s.code} value={s.defaultRate}>
                  {s.code} · {s.name} · {s.defaultRate}%
                </option>
              ))}
              {/* The common flat rates, for anything the three sections above
                  do not cover. */}
              {[0.1, 1, 2, 5, 10].map((r) => (
                <option key={`flat-${r}`} value={r}>{r}%</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>{isTds ? 'TDS applicable on bill' : 'Discount on bill'}</label>
          <input className="input" type="number" min="0" step="0.01" autoFocus={!isTds}
            data-testid="apply-amount" value={amount}
            onChange={(e) => { setAmount(e.target.value); setRate(''); }} />
          {tooMuch && (
            <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 3 }}>
              More than the {inr(bill.due)} still owed on this bill.
            </div>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>
          {isTds
            ? 'Tax the customer keeps back and pays to the government. It settles the bill without reaching your account, and is held as TDS Receivable until you claim it.'
            : 'Written off. It settles the bill alongside the money received.'}
        </div>

        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" data-testid="apply-save"
            disabled={tooMuch} onClick={() => onApply(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}
