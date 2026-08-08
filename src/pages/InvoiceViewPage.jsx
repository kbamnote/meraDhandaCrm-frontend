/**
 * Invoice View — master/detail single-record page (read-only).
 * Left: a selectable list of invoices. Right: a detail card for the
 * selected invoice plus a Print button (window.print()).
 *
 * Same realtime pattern as TasksPage: onValue(ref(db, 'mpw/invoices')).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import InvoiceDocument from '../components/common/InvoiceDocument';

const S = {
  invoiceView: { en: 'Invoice View', hi: 'इनवॉइस व्यू', hinglish: 'Invoice View', gu: 'ઇન્વોઇસ વ્યૂ', mr: 'इनव्हॉइस व्ह्यू', mwr: 'इनवॉइस व्यू' },
  invoice: { en: 'invoice', hi: 'इनवॉइस', hinglish: 'invoice', gu: 'ઇન્વોઇસ', mr: 'इनव्हॉइस', mwr: 'इनवॉइस' },
  invoices: { en: 'invoices', hi: 'इनवॉइस', hinglish: 'invoices', gu: 'ઇન્વોઇસ', mr: 'इनव्हॉइस', mwr: 'इनवॉइस' },
  print: { en: '🖨 Print', hi: '🖨 प्रिंट', hinglish: '🖨 Print', gu: '🖨 પ્રિન્ટ', mr: '🖨 प्रिंट', mwr: '🖨 प्रिंट' },
  noInvoices: { en: 'No invoices yet.', hi: 'अभी तक कोई इनवॉइस नहीं।', hinglish: 'Abhi tak koi invoice nahi.', gu: 'હજુ સુધી કોઈ ઇન્વોઇસ નથી.', mr: 'अद्याप कोणतेही इनव्हॉइस नाहीत.', mwr: 'अजे तांई कोई इनवॉइस कोनी।' },
  selectInvoice: { en: 'Select an invoice.', hi: 'कोई इनवॉइस चुनें।', hinglish: 'Koi invoice chunein.', gu: 'કોઈ ઇન્વોઇસ પસંદ કરો.', mr: 'एखादे इनव्हॉइस निवडा.', mwr: 'कोई इनवॉइस चुणो।' },
  invoiceWord: { en: 'Invoice', hi: 'इनवॉइस', hinglish: 'Invoice', gu: 'ઇન્વોઇસ', mr: 'इनव्हॉइस', mwr: 'इनवॉइस' },
  draft: { en: 'draft', hi: 'ड्राफ्ट', hinglish: 'draft', gu: 'ડ્રાફ્ટ', mr: 'मसुदा', mwr: 'ड्राफ्ट' },
  invoiceNo: { en: 'Invoice No', hi: 'इनवॉइस नंबर', hinglish: 'Invoice No', gu: 'ઇન્વોઇસ નંબર', mr: 'इनव्हॉइस क्रमांक', mwr: 'इनवॉइस नंबर' },
  client: { en: 'Client', hi: 'क्लाइंट', hinglish: 'Client', gu: 'ક્લાયન્ટ', mr: 'क्लायंट', mwr: 'क्लाइंट' },
  amount: { en: 'Amount', hi: 'राशि', hinglish: 'Amount', gu: 'રકમ', mr: 'रक्कम', mwr: 'रकम' },
  status: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  date: { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  dueDate: { en: 'Due date', hi: 'देय तारीख', hinglish: 'Due date', gu: 'નિયત તારીખ', mr: 'देय तारीख', mwr: 'देय तारीख' },
  otherDetails: { en: 'Other details', hi: 'अन्य विवरण', hinglish: 'Other details', gu: 'અન્ય વિગતો', mr: 'इतर तपशील', mwr: 'दूजा विवरण' },
};

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

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
  const t = useT(S);
  const [invoices, setInvoices] = useState({}); // { id: invoice }
  const [selectedId, setSelectedId] = useState(null);
  const [openId, setOpenId] = useState(null);   // non-null = full-page document view

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

  // Full-page document mode — the printable invoice on its own, with the app
  // chrome hidden by the document's own print CSS.
  if (openId) {
    const doc = list.find((inv) => inv.id === openId);
    if (!doc) { setOpenId(null); return null; }
    return (
      <div data-legacy-id="page-invoice-view">
        <div className="flex items-center justify-between mb-2 no-print" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>← Back to list</button>
          <div className="flex gap-2">
            <span className={`badge ${STATUS_BADGE[doc.status] || 'badge-blue'}`} style={{ alignSelf: 'center' }}>
              {doc.status || t('draft')}
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>{t('print')}</button>
          </div>
        </div>
        <InvoiceDocument invoice={doc} />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-invoice-view">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🧾 {t('invoiceView')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {list.length} {list.length === 1 ? t('invoice') : t('invoices')}
          </div>
        </div>
        {selected && (
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            {t('print')}
          </button>
        )}
      </div>

      {!list.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noInvoices')}
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
                  onClick={() => { setSelectedId(inv.id); setOpenId(inv.id); }}
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
                    {/* `clientName` is what the invoice actually stores; `client`
                        is only present on older//legacy rows. */}
                    {inv.clientName || inv.client || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {money(inv.total ?? inv.amount)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Summary card — the full document opens on click (or via Open). */}
          <div className="card flex-1" style={{ minWidth: 280 }}>
            {!selected ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                {t('selectInvoice')}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                    {selected.invoiceNo || `${t('invoiceWord')} #${selected.id}`}
                  </h3>
                  <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-blue'}`}>
                    {selected.status || t('draft')}
                  </span>
                </div>

                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                  {money(selected.total ?? selected.amount)}
                </div>
                {Number(selected.paidAmount) > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                    Paid {money(selected.paidAmount)} · Balance {money(round2((selected.total || 0) - (selected.paidAmount || 0)))}
                  </div>
                )}

                <table className="crm-table" style={{ width: '100%' }}>
                  <tbody>
                    <DetailRow label={t('invoiceNo')} value={selected.invoiceNo} />
                    <DetailRow label={t('client')} value={selected.clientName || selected.client} />
                    <DetailRow label={t('amount')} value={money(selected.total ?? selected.amount)} />
                    <DetailRow label={t('status')} value={selected.status} />
                    <DetailRow label={t('date')} value={selected.date} />
                    <DetailRow label={t('dueDate')} value={selected.dueDate} />
                  </tbody>
                </table>

                <div className="flex gap-2" style={{ marginTop: 14 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setOpenId(selected.id)}>
                    📄 Open invoice
                  </button>
                </div>
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
