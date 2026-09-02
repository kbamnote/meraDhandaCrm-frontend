/**
 * "Which account did the money go through?" — one control, used by every form
 * that moves money, so the question is asked the same way everywhere.
 *
 * Before named accounts existed, a payment recorded only a MODE ('UPI',
 * 'Cheque'), which says how the money moved but not where it landed. This is
 * what makes a bank statement reconcilable.
 *
 * Deliberately NOT auto-selected. Picking the first account for the user would
 * silently attribute real money to an account nobody chose, and a wrong bank on
 * a receipt is worse than a blank one — the blank is visibly unfinished, the
 * wrong one looks settled. Left empty, the server files it under Unlinked
 * Transactions, which is the honest record of "we don't know".
 *
 * Props:
 *   value      — bank account id, or '' / 'cash'
 *   onChange(id)
 *   mode?      — the payment mode, used only to pre-narrow the hint text
 *   allowCash? — include the cash drawer (default true)
 *   label?     — override the field label
 */
import { useEffect, useState } from 'react';
import { accountingApi } from '../../services/api';

// Module-level cache: several of these can mount at once (an invoice form has
// one, its payment row another) and the list changes rarely.
let cache = null;
let inflight = null;

export function loadFundingAccounts(force = false) {
  if (!force && cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = accountingApi.bankAccounts()
      .then((r) => {
        cache = (r && r.accounts) || [];
        return cache;
      })
      .catch(() => [])
      .finally(() => { inflight = null; });
  }
  return inflight;
}
export function invalidateFundingAccounts() { cache = null; }

export default function BankAccountSelect({
  value, onChange, mode, allowCash = true, label = 'Received in', style,
}) {
  const [accounts, setAccounts] = useState(cache || []);

  useEffect(() => {
    let dead = false;
    loadFundingAccounts().then((a) => { if (!dead) setAccounts(a); });
    return () => { dead = true; };
  }, []);

  // The unlinked head is a record of the past, not somewhere to file new money.
  const options = accounts.filter((a) => a.type !== 'unlinked' && (allowCash || a.type !== 'cash'));
  const isCashMode = String(mode || '').toLowerCase() === 'cash';

  return (
    <div className="form-group" style={style}>
      <label>{label}</label>
      <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{isCashMode ? 'Cash in hand' : '— not specified —'}</option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.accountNumber ? ` · ${String(a.accountNumber).slice(-4).padStart(4, '•')}` : ''}
          </option>
        ))}
      </select>
      {!value && !isCashMode && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
          Without an account this is filed under Unlinked Transactions.
        </div>
      )}
    </div>
  );
}
