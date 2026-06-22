/**
 * Invoice View — master/detail single-record page (read-only).
 * Left: a selectable list of invoices. Right: a detail card for the
 * selected invoice plus a Print button (window.print()).
 *
 * Same realtime pattern as TasksPage: onValue(ref(db, 'mpw/invoices')).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';

const STATUS_BADGE = {
  paid: 'badge-green',
  unpaid: 'badge-red',
  overdue: 'badge-red',
  pending: 'badge-amber',
  partial: 'badge-amber',
  draft: 'badge-blue',
};

// Fields we render with a friendly label / dedicated row. Anything else on the
// record is shown generically under "Other details".
const KNOWN = new Set([
  'id', 'invoiceNo', 'client', 'amount', 'status', 'date', 'dueDate',
]);

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toLocaleString('en-IN')}`;
}

function cellText(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
  return String(value);
}

export default function InvoiceViewPage() {
  const [invoices, setInvoices] = useState({}); // { id: invoice }
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const r = ref(db, 'mpw/invoices');
    const u = onValue(r, (snap) => setInvoices(snap.val() || {}));
    return u;
  }, []);

  const list = useMemo(
    () => Object.entries(invoices).map(([id, inv]) => ({ ...inv, id })),
    [invoices]
  );

  // Default-select the first invoice once data arrives (or if the selected one
  // disappears).
  useEffect(() => {
    if (!list.length) { setSelectedId(null); return; }
    if (!selectedId || !list.some((inv) => inv.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const selected = useMemo(
    () => list.find((inv) => inv.id === selectedId) || null,
    [list, selectedId]
  );

  const extraEntries = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected).filter(([k]) => !KNOWN.has(k));
  }, [selected]);

  return (
    <div data-legacy-id="page-invoice-view">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🧾 Invoice View</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {list.length} {list.length === 1 ? 'invoice' : 'invoices'}
          </div>
        </div>
        {selected && (
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            🖨 Print
          </button>
        )}
      </div>

      {!list.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No invoices yet.
        </div>
      ) : (
        <div className="flex gap-3" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Master list */}
          <div className="card" style={{ padding: 6, width: 280, maxWidth: '100%', maxHeight: '70vh', overflow: 'auto' }}>
            {list.map((inv) => {
              const active = inv.id === selectedId;
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedId(inv.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    background: active ? 'var(--blue-light)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--blue)' : 'transparent'}`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {inv.invoiceNo || `#${inv.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {inv.client || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {money(inv.amount)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail card */}
          <div className="card flex-1" style={{ minWidth: 280 }}>
            {!selected ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                Select an invoice.
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                    {selected.invoiceNo || `Invoice #${selected.id}`}
                  </h3>
                  <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-blue'}`}>
                    {selected.status || 'draft'}
                  </span>
                </div>

                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
                  {money(selected.amount)}
                </div>

                <table className="crm-table" style={{ width: '100%' }}>
                  <tbody>
                    <DetailRow label="Invoice No" value={selected.invoiceNo} />
                    <DetailRow label="Client" value={selected.client} />
                    <DetailRow label="Amount" value={money(selected.amount)} />
                    <DetailRow label="Status" value={selected.status} />
                    <DetailRow label="Date" value={selected.date} />
                    <DetailRow label="Due date" value={selected.dueDate} />
                  </tbody>
                </table>

                {!!extraEntries.length && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 6px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Other details
                    </div>
                    <table className="crm-table" style={{ width: '100%' }}>
                      <tbody>
                        {extraEntries.map(([k, v]) => (
                          <DetailRow key={k} label={k} value={cellText(v)} />
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <tr>
      <td style={{ width: 140, color: 'var(--text2)', textTransform: 'capitalize' }}>{label}</td>
      <td style={{ fontWeight: 500 }}>{cellText(value)}</td>
    </tr>
  );
}
