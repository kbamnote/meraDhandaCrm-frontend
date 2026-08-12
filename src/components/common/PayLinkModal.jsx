/**
 * Payment Link (Phase 4B-1) — mint/read the invoice's public pay link, copy it,
 * show the QR, track link-opened / paid-via-link status, share on WhatsApp, and
 * record a payment explicitly "via the link".
 *
 * The token already exists on invoices created after 4B-1; older invoices get
 * one minted the first time this modal opens (POST /invoice/:id/pay-link).
 */
import { useEffect, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';
import { inr } from './DashboardCharts';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;

const S = {
  title:     { en: '🔗 Payment Link', hi: '🔗 भुगतान लिंक', hinglish: '🔗 Payment Link' },
  link:      { en: 'Share this link — the customer opens it, sees the invoice and pays via UPI.', hi: 'यह लिंक शेयर करें — ग्राहक इसे खोलकर इनवॉइस देखेगा और UPI से भुगतान करेगा।', hinglish: 'Ye link share karo - customer ise khol ke invoice dekhega aur UPI se pay karega.' },
  copy:      { en: 'Copy', hi: 'कॉपी', hinglish: 'Copy' },
  copied:    { en: 'Link copied', hi: 'लिंक कॉपी हुआ', hinglish: 'Link copied' },
  scan:      { en: 'Scan to open', hi: 'खोलने के लिए स्कैन करें', hinglish: 'Scan to open' },
  linkOpened:{ en: 'Link opened', hi: 'लिंक खोला गया', hinglish: 'Link opened' },
  notOpened: { en: 'Not opened yet', hi: 'अभी नहीं खोला गया', hinglish: 'Abhi nahi khula' },
  paidVia:   { en: 'Paid via link', hi: 'लिंक से भुगतान', hinglish: 'Link se paid' },
  notPaidVia:{ en: 'Not via link', hi: 'लिंक से नहीं', hinglish: 'Link se nahi' },
  clicks:    { en: 'clicks', hi: 'क्लिक', hinglish: 'clicks' },
  sendWa:    { en: '📲 Send on WhatsApp', hi: '📲 व्हाट्सएप पर भेजें', hinglish: '📲 WhatsApp par bhejo' },
  markPaid:  { en: '✓ Mark paid via link', hi: '✓ लिंक से भुगतान चिह्नित करें', hinglish: '✓ Link se paid mark karo' },
  outstanding:{ en: 'outstanding', hi: 'बकाया', hinglish: 'outstanding' },
  recorded:  { en: 'Payment recorded', hi: 'भुगतान दर्ज हुआ', hinglish: 'Payment recorded' },
  emptyPhone:{ en: 'No customer phone on this invoice', hi: 'इस इनवॉइस पर ग्राहक का फोन नहीं है', hinglish: 'Is invoice pe customer ka phone nahi hai' },
  failed:    { en: 'Something went wrong', hi: 'कुछ गलत हुआ', hinglish: 'Kuch galat hua' },
  close:     { en: 'Close', hi: 'बंद करें', hinglish: 'Close' },
};

function phoneDigits(p) {
  return String(p || '').replace(/\D/g, '');
}

export default function PayLinkModal({ invoice, onClose }) {
  const t = useT(S);
  const [pl, setPl] = useState(null); // { token, url, linkClicked, paidViaLink, clickedCount, ... }
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState(false);

  const due = round2(Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0)));

  const load = () => {
    setBusy(true);
    accountingApi.payLinkStatus(invoice.id)
      .then((r) => {
        if (!r.token) return accountingApi.payLinkMint(invoice.id);
        return r;
      })
      .then(setPl)
      .catch(() => showToast(t('failed'), 'error'))
      .finally(() => setBusy(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const copy = async () => {
    if (!pl?.url) return;
    try {
      await navigator.clipboard.writeText(pl.url);
      showToast(t('copied'), 'success');
    } catch {
      // Fallback: select the input so the user can Ctrl-C.
      document.getElementById('paylink-url')?.select();
    }
  };

  const waMessage = `Hi ${invoice.clientName || 'there'}, your invoice ${invoice.invoiceNo} of ₹${due.toLocaleString('en-IN')} is ready. Please pay securely here: ${pl?.url || ''}`;

  const sendWa = () => {
    const digits = phoneDigits(invoice.clientPhone);
    if (!digits) return showToast(t('emptyPhone'), 'error');
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`, '_blank');
  };

  const markPaidViaLink = async () => {
    if (marking) return;
    const v = window.prompt(`${t('markPaid')} (${t('outstanding')}: ${inr(due)})`, String(due));
    if (v === null) return;
    const amount = Number(v);
    if (!amount || amount <= 0) return;
    setMarking(true);
    try {
      await accountingApi.recordPayment(invoice.id, { amount, viaLink: true });
      showToast(t('recorded'), 'success');
      load();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setMarking(false); }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>{t('title')}</h3>
          <button style={btnGhost} onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
          {invoice.invoiceNo} · {invoice.clientName || '—'}
        </div>

        {busy && !pl ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>…</div>
        ) : pl?.url ? (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 6 }}>{t('link')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="paylink-url"
                readOnly
                value={pl.url}
                onFocus={(e) => e.target.select()}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button style={btnPrimary} onClick={copy}>{t('copy')}</button>
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 14, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(pl.url)}`}
                  alt="Payment link QR" width={120} height={120}
                  style={{ borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('scan')}</div>
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ marginBottom: 6 }}>
                  <span className={`badge ${pl.linkClicked ? 'badge-green' : 'badge-amber'}`}>
                    {pl.linkClicked ? t('linkOpened') : t('notOpened')}
                  </span>
                  {pl.clickedCount > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 6 }}>{pl.clickedCount} {t('clicks')}</span>
                  )}
                </div>
                <span className={`badge ${pl.paidViaLink ? 'badge-green' : 'badge'}`}>
                  {pl.paidViaLink ? t('paidVia') : t('notPaidVia')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" style={{ fontWeight: 600 }} onClick={sendWa}>{t('sendWa')}</button>
              {due > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={markPaidViaLink} disabled={marking}>
                  {marking ? '…' : t('markPaid')}
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>…</div>
        )}
      </div>
    </div>
  );
}

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
  padding: '6px 10px', borderRadius: 6, border: 'none', background: 'none',
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
};
const btnPrimary = {
  padding: '8px 16px', borderRadius: 6, border: 'none', background: 'var(--blue, #C05621)',
  color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
};
