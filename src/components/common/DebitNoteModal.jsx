/**
 * Create Debit Note modal — raises a debit note against an existing GST invoice.
 * Posts to POST /api/accounting/debit-note which posts the mirror of a credit
 * note (Dr AR, Cr Sales + Cr GST Payable) — the customer owes MORE than the
 * original invoice (undercharge, rate difference, extra charges).
 *
 * Props: { invoice, onClose }
 * invoice: the full invoice object from realtime.
 */
import { useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from './toast';
import { useT } from '../../i18n/LanguageContext';
import { inr } from './DashboardCharts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Create Debit Note', hi: 'डेबिट नोट बनाएं', hinglish: 'Debit Note banao' },
  against:  { en: 'Against Invoice', hi: 'इनवॉइस के विरुद्ध', hinglish: 'Against Invoice' },
  client:   { en: 'Client', hi: 'क्लाइंट', hinglish: 'Client' },
  invoiceTotal: { en: 'Invoice Total', hi: 'इनवॉइस कुल', hinglish: 'Invoice Total' },
  amount:   { en: 'Debit Amount (₹)', hi: 'डेबिट राशि (₹)', hinglish: 'Debit Amount (₹)' },
  amountNote: { en: 'In addition to the invoice total — the customer owes this extra.', hi: 'इनवॉइस कुल के अतिरिक्त', hinglish: 'Invoice total ke upar extra' },
  reason:   { en: 'Reason for debit note', hi: 'डेबिट नोट का कारण', hinglish: 'Debit note reason' },
  reasonPH: { en: 'e.g. Undercharge, rate difference, extra charges…', hi: 'जैसे कम चार्ज, रेट अंतर, अतिरिक्त शुल्क…', hinglish: 'Undercharge, rate difference, extra charges…' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel' },
  issue:    { en: 'Raise Debit Note', hi: 'डेबिट नोट जारी करें', hinglish: 'Debit Note jari karein' },
  issuing:  { en: 'Raising…', hi: 'जारी हो रहा है…', hinglish: 'Jari ho raha hai…' },
  ok:       { en: 'Debit note issued', hi: 'डेबिट नोट जारी हो गया', hinglish: 'Debit note jari ho gaya' },
  fail:     { en: 'Failed to raise debit note', hi: 'डेबिट नोट जारी नहीं हो सका', hinglish: 'Debit note fail hua' },
  gstTip:   { en: 'Tax is inherited from the original invoice.', hi: 'टैक्स मूल इनवॉइस से लिया जाएगा।', hinglish: 'Tax original invoice se lega.' },
};

export default function DebitNoteModal({ invoice, onClose }) {
  const t = useT(S);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!invoice) return null;

  const debitAmount = round2(Number(amount) || 0);

  const handleSubmit = async () => {
    if (debitAmount <= 0) {
      showToast(t('fail'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await accountingApi.debitNote({
        invoiceId: invoice.id,
        total: debitAmount,
        reason: reason || null,
        date: new Date().toISOString().slice(0, 10),
      });
      showToast(t('ok'), 'success');
      onClose();
    } catch (e) {
      showToast(e.response?.data?.error || t('fail'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{t('title')}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
        </div>

        {/* Invoice summary */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', marginBottom: 14, fontSize: 13 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--text3)' }}>{t('against')} </span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{invoice.invoiceNo}</span>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--text3)' }}>{t('client')} </span>
            <span style={{ fontWeight: 600 }}>{invoice.clientName}</span>
          </div>
          <div>
            <span style={{ color: 'var(--text3)' }}>{t('invoiceTotal')} </span>
            <span style={{ fontWeight: 700 }}>{inr(invoice.total)}</span>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('amount')}</div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            style={inputStyle}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{t('amountNote')}</div>
        </div>

        {/* Reason */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('reason')}</div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPH')}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* Preview */}
        <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px dashed var(--border)', marginBottom: 14, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text3)' }}>{t('amount')}</span>
            <span style={{ fontWeight: 700, color: debitAmount > 0 ? 'var(--amber)' : 'var(--red)' }}>{inr(debitAmount)}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('gstTip')}</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>{t('cancel')}</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || debitAmount <= 0}
            style={{ ...btnPrimary, opacity: submitting || debitAmount <= 0 ? 0.6 : 1 }}
          >
            {submitting ? t('issuing') : t('issue')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── styles ──
const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
};
const modalStyle = {
  background: 'var(--surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 480,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
};
const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
};
const btnGhost = {
  padding: '7px 14px', borderRadius: 6, border: 'none', background: 'none',
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
};
const btnPrimary = {
  padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--blue, #C05621)',
  color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600,
};
