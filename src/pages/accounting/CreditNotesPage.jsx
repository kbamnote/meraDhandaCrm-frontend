/**
 * Credit Notes — lists all credit notes and allows issuing new ones against
 * existing GST invoices. Posts reverse ledger entries automatically.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:    { en: 'Credit Notes', hi: 'क्रेडिट नोट', hinglish: 'Credit Notes' },
  newCN:    { en: 'New Credit Note', hinglish: 'New Credit Note' },
  creditNo: { en: 'Credit No', hinglish: 'Credit No' },
  date:     { en: 'Date', hinglish: 'Date' },
  invoice:  { en: 'Invoice', hinglish: 'Invoice' },
  client:   { en: 'Client', hinglish: 'Client' },
  amount:   { en: 'Amount', hinglish: 'Amount' },
  reason:   { en: 'Reason', hinglish: 'Reason' },
  total:    { en: 'Total', hinglish: 'Total' },
  count:    { en: 'Notes', hinglish: 'Notes' },
  save:     { en: 'Issue Credit Note', hinglish: 'Issue Credit Note' },
  cancel:   { en: 'Cancel', hinglish: 'Cancel' },
  close:    { en: 'Close', hinglish: 'Close' },
  noCN:     { en: 'No credit notes issued yet.', hinglish: 'No credit notes yet.' },
  selectInvoice: { en: 'Select Invoice', hinglish: 'Select Invoice' },
  creditAmount:  { en: 'Credit Amount (₹)', hinglish: 'Credit Amount' },
  search:   { en: 'Search…', hinglish: 'Search…' },
  reasonPH: { en: 'e.g. Goods returned, pricing error', hinglish: 'Reason' },
  taxable:  { en: 'Taxable', hinglish: 'Taxable' },
  cgst:     { en: 'CGST', hinglish: 'CGST' },
  sgst:     { en: 'SGST', hinglish: 'SGST' },
  igst:     { en: 'IGST', hinglish: 'IGST' },
};

export default function CreditNotesPage() {
  const t = useT(S);
  const [notes, setNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ invoiceId: '', total: '', reason: '', date: today() });
  const [saving, setSaving] = useState(false);

  const load = () => {
    accountingApi.creditNotes().then(setNotes).catch(() => setNotes([]));
    accountingApi.ledger().then((list) => {
      // Get unpaid/partial invoices
      accountingApi.gstReport({}).then((r) => {
        const paid = new Set();
        (r.rows || []).forEach(() => {}); // we need full invoice list
      }).catch(() => {});
    }).catch(() => {});
    // Fetch invoices for the dropdown
    import('../../services/api').then(({ default: api }) => {});
  };

  useEffect(() => {
    accountingApi.creditNotes().then(setNotes).catch(() => setNotes([]));
    // We need invoice list — use the ledger endpoint which has all clients/invoices
    // Actually, let's fetch from a lightweight endpoint. The gst-report has invoice data.
    accountingApi.gstReport({}).then((r) => {
      // Build invoice list from GST report rows — but we need invoice IDs too.
      // Let's use the realtime db directly for the invoice list.
    }).catch(() => {});
    // Simplest: read invoices from the realtime db
    import('../../services/realtime').then(({ ref, onValue, db }) => {
      const unsub = onValue(ref(db, 'mpw/invoices'), (snap) => {
        const data = snap.val() || {};
        const list = Object.entries(data).map(([id, v]) => ({ id, ...v }))
          .filter((i) => i.type !== 'proforma' && i.status !== 'void');
        setInvoices(list);
      });
      return unsub;
    }).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!q) return notes;
    const s = q.toLowerCase();
    return notes.filter((n) => (n.creditNo || '').toLowerCase().includes(s) || (n.clientName || '').toLowerCase().includes(s) || (n.invoiceNo || '').toLowerCase().includes(s));
  }, [notes, q]);

  const totalAll = round2(notes.reduce((s, n) => s + (Number(n.total) || 0), 0));

  const selectedInv = invoices.find((i) => i.id === form.invoiceId);
  const maxCredit = selectedInv ? round2((selectedInv.total || 0) - (selectedInv.paidAmount || 0)) : 0;

  const save = async () => {
    if (!form.invoiceId || !form.total || Number(form.total) <= 0) return;
    setSaving(true);
    try {
      await accountingApi.creditNote({
        invoiceId: form.invoiceId,
        total: Number(form.total),
        reason: form.reason,
        date: form.date,
      });
      setShowForm(false);
      setForm({ invoiceId: '', total: '', reason: '', date: today() });
      accountingApi.creditNotes().then(setNotes).catch(() => setNotes([]));
    } catch (e) { alert(e?.response?.data?.error || 'Failed'); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('newCN')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('count')} value={notes.length} icon="📝" color="var(--text)" />
        <Kpi label={t('total')} value={inr(totalAll)} icon="💰" color="var(--amber)" />
      </KpiGrid>

      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noCN')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 600, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('creditNo')}</th>
                <th>{t('date')}</th>
                <th>{t('invoice')}</th>
                <th>{t('client')}</th>
                <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                <th>{t('reason')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cn) => (
                <tr key={cn.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{cn.creditNo}</td>
                  <td style={{ fontSize: 12 }}>{cn.date}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{cn.invoiceNo}</td>
                  <td>{cn.clientName || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>{inr(cn.total)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{cn.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={4}>{t('total')}</td>
                <td style={{ textAlign: 'right', color: 'var(--amber)' }}>{inr(totalAll)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Issue Credit Note Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t('newCN')}</h3>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>{t('selectInvoice')}</label>
              <select className="input" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
                <option value="">— {t('selectInvoice')} —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo} — {inv.clientName} — {inr((inv.total || 0) - (inv.paidAmount || 0))} due
                  </option>
                ))}
              </select>
            </div>

            {selectedInv && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--surface2)', marginBottom: 10, fontSize: 12 }}>
                <div>Invoice Total: <b>{inr(selectedInv.total)}</b> | Paid: <b>{inr(selectedInv.paidAmount)}</b></div>
                <div>Outstanding: <b style={{ color: 'var(--red)' }}>{inr(maxCredit)}</b></div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label>{t('creditAmount')} (max {inr(maxCredit)})</label>
                <input className="input" type="number" step="0.01" min="0" max={maxCredit} value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('date')}</label>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>{t('reason')}</label>
              <input className="input" placeholder={t('reasonPH')} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving || !form.invoiceId || !form.total} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
