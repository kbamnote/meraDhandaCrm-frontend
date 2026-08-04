/**
 * Create Credit Note modal — issues a credit note against an existing GST invoice.
 * Posts to POST /api/accounting/credit-note which reverses the original ledger
 * entries (Dr Sales Returns + Dr GST Payable, Cr AR).
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
  title:    { en: 'Create Credit Note', hi: 'क्रेडिट नोट बनाएं', hinglish: 'Credit Note banao' },
  against:  { en: 'Against Invoice', hi: 'इनवॉइस के विरुद्ध', hinglish: 'Against Invoice' },
  client:   { en: 'Client', hi: 'क्लाइंट', hinglish: 'Client' },
  amount:   { en: 'Credit Amount (₹)', hi: 'क्रेडिट राशि (₹)', hinglish: 'Credit Amount (₹)' },
  reason:   { en: 'Reason for credit note', hi: 'क्रेडिट नोट का कारण', hinglish: 'Credit note reason' },
  reasonPH: { en: 'e.g. Goods returned, price adjustment…', hi: 'जैसे माल वापस, मूल्य समायोजन…', hinglish: 'Goods returned, price adjustment…' },
  fullCred: { en: 'Full outstanding amount', hi: 'पूरा बकाया', hinglish: 'Full outstanding' },
  customAmt:{ en: 'Custom amount', hi: 'कस्टम राशि', hinglish: 'Custom amount' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel' },
  issue:    { en: 'Issue Credit Note', hi: 'क्रेडिट नोट जारी करें', hinglish: 'Issue Credit Note' },
  issuing:  { en: 'Issuing…', hi: 'जारी हो रहा है…', hinglish: 'Issuing…' },
  ok:       { en: 'Credit note issued', hi: 'क्रेडिट नोट जारी हो गया', hinglish: 'Credit note issued' },
  fail:     { en: 'Failed to issue credit note', hi: 'क्रेडिट नोट जारी नहीं हो सका', hinglish: 'Credit note fail hua' },
  outstanding:{ en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding' },
  items:    { en: 'Line Items', hi: 'लाइन आइटम', hinglish: 'Line Items' },
  qty:      { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  rate:     { en: 'Rate', hi: 'रेट', hinglish: 'Rate' },
  amt:      { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  tax:      { en: 'Tax', hi: 'टैक्स', hinglish: 'Tax' },
};

export default function CreditNoteModal({ invoice, onClose }) {
  const t = useT(S);
  const [mode, setMode] = useState('full'); // 'full' | 'custom'
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!invoice) return null;

  const outstanding = round2((invoice.total || 0) - (invoice.paidAmount || 0));
  const creditAmount = mode === 'full' ? outstanding : round2(Number(customAmount) || 0);

  const handleSubmit = async () => {
    if (creditAmount <= 0) {
      showToast(t('fail'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await accountingApi.creditNote({
        invoiceId: invoice.id,
        total: creditAmount,
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
            <span style={{ color: 'var(--text3)' }}>{t('outstanding')} </span>
            <span style={{ fontWeight: 700, color: 'var(--amber)' }}>{inr(outstanding)}</span>
            <span style={{ color: 'var(--text3)', marginLeft: 8 }}>of {inr(invoice.total)}</span>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('amount')}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setMode('full')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
                background: mode === 'full' ? 'var(--blue, #C05621)' : 'var(--surface2)',
                color: mode === 'full' ? '#fff' : 'var(--text2)', fontWeight: mode === 'full' ? 600 : 400,
              }}
            >
              {t('fullCred')} ({inr(outstanding)})
            </button>
            <button
              onClick={() => setMode('custom')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
                background: mode === 'custom' ? 'var(--blue, #C05621)' : 'var(--surface2)',
                color: mode === 'custom' ? '#fff' : 'var(--text2)', fontWeight: mode === 'custom' ? 600 : 400,
              }}
            >
              {t('customAmt')}
            </button>
          </div>
          {mode === 'custom' && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
          )}
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
            <span style={{ color: 'var(--text3)' }}>Credit Note Amount</span>
            <span style={{ fontWeight: 700, color: creditAmount > 0 ? 'var(--green)' : 'var(--red)' }}>{inr(creditAmount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>{t('cancel')}</button>
          <button
            onClick={handleSubmit}
            disabled={submitting || creditAmount <= 0}
            style={{ ...btnPrimary, opacity: submitting || creditAmount <= 0 ? 0.6 : 1 }}
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
