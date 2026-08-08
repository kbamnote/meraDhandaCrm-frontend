/**
 * Debit Notes — lists all debit notes and allows raising new ones against
 * existing GST invoices. Posts the mirror of a credit note's ledger entries
 * (Dr AR, Cr Sales + Cr GST Payable) — the customer owes MORE than invoiced.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:    { en: 'Debit Notes', hi: 'डेबिट नोट', hinglish: 'Debit Notes' },
  newDN:    { en: 'New Debit Note', hi: 'नया डेबिट नोट', hinglish: 'Naya Debit Note' },
  debitNo:  { en: 'Debit No', hi: 'डेबिट नंबर', hinglish: 'Debit No' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  invoice:  { en: 'Invoice', hi: 'इनवॉइस', hinglish: 'Invoice' },
  client:   { en: 'Client', hi: 'क्लाइंट', hinglish: 'Client' },
  amount:   { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  reason:   { en: 'Reason', hi: 'कारण', hinglish: 'Reason' },
  total:    { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  count:    { en: 'Notes', hi: 'नोट', hinglish: 'Notes' },
  save:     { en: 'Raise Debit Note', hi: 'डेबिट नोट जारी करें', hinglish: 'Debit Note jari karein' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel' },
  noDN:     { en: 'No debit notes issued yet.', hi: 'अभी कोई डेबिट नोट नहीं।', hinglish: 'Abhi koi debit note nahi.' },
  selectInvoice: { en: 'Select Invoice', hi: 'इनवॉइस चुनें', hinglish: 'Invoice chunein' },
  debitAmount:   { en: 'Debit Amount (₹)', hi: 'डेबिट राशि (₹)', hinglish: 'Debit Amount (₹)' },
  search:   { en: 'Search…', hi: 'खोजें…', hinglish: 'Search…' },
  reasonPH: { en: 'e.g. Undercharge, rate difference, extra charges…', hi: 'जैसे कम चार्ज, रेट अंतर…', hinglish: 'Undercharge, rate difference…' },
};

export default function DebitNotesPage() {
  const t = useT(S);
  const [notes, setNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ invoiceId: '', total: '', reason: '', date: today() });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    accountingApi.debitNotes().then(setNotes).catch(() => setNotes([]));
    // Non-proforma, non-void invoices can have a debit note raised against them.
    const unsub = onValue(ref(db, 'mpw/invoices'), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v }))
        .filter((i) => i.type !== 'proforma' && i.status !== 'void');
      setInvoices(list);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    if (!q) return notes;
    const s = q.toLowerCase();
    return notes.filter((n) => (n.debitNo || '').toLowerCase().includes(s) || (n.clientName || '').toLowerCase().includes(s) || (n.invoiceNo || '').toLowerCase().includes(s));
  }, [notes, q]);

  const totalAll = round2(notes.reduce((s, n) => s + (Number(n.total) || 0), 0));

  const selectedInv = invoices.find((i) => i.id === form.invoiceId);

  const save = async () => {
    if (!form.invoiceId || !form.total || Number(form.total) <= 0) return;
    setSaving(true);
    try {
      await accountingApi.debitNote({
        invoiceId: form.invoiceId,
        total: Number(form.total),
        reason: form.reason,
        date: form.date,
      });
      setShowForm(false);
      setForm({ invoiceId: '', total: '', reason: '', date: today() });
      accountingApi.debitNotes().then(setNotes).catch(() => setNotes([]));
    } catch (e) { alert(e?.response?.data?.error || 'Failed'); }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ {t('newDN')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('count')} value={notes.length} icon="📝" color="var(--text)" />
        <Kpi label={t('total')} value={inr(totalAll)} icon="💰" color="var(--amber)" />
      </KpiGrid>

      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noDN')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 600, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('debitNo')}</th>
                <th>{t('date')}</th>
                <th>{t('invoice')}</th>
                <th>{t('client')}</th>
                <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                <th>{t('reason')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((dn) => (
                <tr key={dn.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{dn.debitNo}</td>
                  <td style={{ fontSize: 12 }}>{dn.date}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dn.invoiceNo}</td>
                  <td>{dn.clientName || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>+{inr(dn.total)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{dn.reason || '—'}</td>
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

      {/* Raise Debit Note Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t('newDN')}</h3>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>{t('selectInvoice')}</label>
              <select className="input" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })}>
                <option value="">— {t('selectInvoice')} —</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNo} — {inv.clientName} — {inr(inv.total)} total
                  </option>
                ))}
              </select>
            </div>

            {selectedInv && (
              <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--surface2)', marginBottom: 10, fontSize: 12 }}>
                <div>Invoice Total: <b>{inr(selectedInv.total)}</b> | Paid: <b>{inr(selectedInv.paidAmount)}</b></div>
                <div style={{ color: 'var(--text3)', marginTop: 2 }}>Amount is <b>in addition to</b> the invoice total.</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group">
                <label>{t('debitAmount')}</label>
                <input className="input" type="number" step="0.01" min="0" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
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
