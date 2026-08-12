/**
 * Public Payment Page (Phase 4B-1) — the customer-facing half of a payment link.
 *
 * Served at /pay/:token with NO authentication. Resolves the invoice through the
 * unauthenticated GET /api/public/pay/:token and shows only the safe subset the
 * server returns: seller name/logo + UPI id, the line items, and the amount due.
 * The "Pay" button fires the standard upi://pay intent that every Indian UPI app
 * understands; the QR carries the same intent for scanning.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { accountingApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const money = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN')}`;

const S = {
  loading:   { en: 'Loading invoice…', hi: 'इनवॉइस लोड हो रहा है…', hinglish: 'Invoice load ho raha hai…' },
  notFound:  { en: 'Payment link not found or expired.', hi: 'भुगतान लिंक नहीं मिला या समाप्त हो गया।', hinglish: 'Payment link nahi mila ya khatam ho gaya.' },
  invoiceNo: { en: 'Invoice', hi: 'इनवॉइस', hinglish: 'Invoice' },
  date:      { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  dueDate:   { en: 'Due date', hi: 'देय तारीख', hinglish: 'Due date' },
  qty:       { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  rate:      { en: 'Rate', hi: 'दर', hinglish: 'Rate' },
  name:      { en: 'Item', hi: 'वस्तु', hinglish: 'Item' },
  amount:    { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  total:     { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  paid:      { en: 'Paid', hi: 'भुगतान हुआ', hinglish: 'Paid' },
  due:       { en: 'Amount Due', hi: 'देय राशि', hinglish: 'Amount Due' },
  payNow:    { en: 'Pay now via UPI', hi: 'UPI से अभी भुगतान करें', hinglish: 'UPI se abhi pay karo' },
  scan:      { en: 'or scan with any UPI app', hi: 'या किसी भी UPI ऐप से स्कैन करें', hinglish: 'ya kisi bhi UPI app se scan karo' },
  fullyPaid: { en: 'Fully paid ✓', hi: 'पूरा भुगतान हो गया ✓', hinglish: 'Fully paid ✓' },
  noUpi:     { en: 'This invoice is ready. Contact the seller to complete the payment.', hi: 'यह इनवॉइस तैयार है। भुगतान के लिए विक्रेता से संपर्क करें।', hinglish: 'Invoice ready hai. Payment ke liye seller se contact karo.' },
  thanks:    { en: 'Thank you!', hi: 'धन्यवाद!', hinglish: 'Thank you!' },
  footer:    { en: 'Powered by MeraDhanda', hi: 'MeraDhanda द्वारा', hinglish: 'Powered by MeraDhanda' },
};

const STATUS_TONE = { paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red', overdue: 'badge-red' };

export default function PublicPayPage() {
  const t = useT(S);
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); return; }
    accountingApi.publicPay(token)
      .then(setData)
      .catch(() => setNotFound(true));
  }, [token]);

  if (notFound) {
    return <Shell footer={t('footer')}><div style={centered}>{t('notFound')}</div></Shell>;
  }
  if (!data) {
    return <Shell footer={t('footer')}><div style={centered}>{t('loading')}</div></Shell>;
  }

  const inv = data.invoice || {};
  const seller = data.seller || {};
  const items = data.items || [];
  const due = round2(Math.max(0, inv.due));
  const fullyPaid = due <= 0;
  const intent = seller.upiId && !fullyPaid
    ? `upi://pay?pa=${encodeURIComponent(seller.upiId)}&pn=${encodeURIComponent(seller.holderName || seller.name)}&am=${due.toFixed(2)}&cu=INR`
    : null;
  const qr = intent
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(intent)}`
    : null;

  return (
    <Shell footer={t('footer')}>
      {/* Seller header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        {seller.logo && (
          <img src={seller.logo} alt="" style={{ height: 44, maxWidth: 180, objectFit: 'contain', marginBottom: 6 }} />
        )}
        <div style={{ fontSize: 18, fontWeight: 700 }}>{seller.name || ''}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('invoiceNo')} {inv.invoiceNo}
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2)', marginBottom: 12 }}>
        <div>
          <div>{t('date')}: {inv.date}</div>
          {inv.dueDate && <div>{t('dueDate')}: {inv.dueDate}</div>}
        </div>
        <span className={`badge ${STATUS_TONE[inv.status] || 'badge-blue'}`}>{inv.status || ''}</span>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ ...th, textAlign: 'left' }}>{t('name')}</th>
                <th style={th}>{t('qty')}</th>
                <th style={th}>{t('rate')}</th>
                <th style={th}>{t('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...td, textAlign: 'left' }}>{it.name}</td>
                  <td style={td}>{it.qty}</td>
                  <td style={td}>{money(it.rate)}</td>
                  <td style={td}>{money(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div style={{ fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={row}><span>{t('total')}</span><span>{money(inv.total)}</span></div>
        {inv.paidAmount > 0 && <div style={row}><span>{t('paid')}</span><span>{money(inv.paidAmount)}</span></div>}
        <div style={{ ...row, fontSize: 16, fontWeight: 700, color: fullyPaid ? 'var(--green)' : 'var(--red)' }}>
          <span>{fullyPaid ? t('fullyPaid') : t('due')}</span>
          <span>{fullyPaid ? t('thanks') : money(due)}</span>
        </div>
      </div>

      {/* Pay block */}
      {fullyPaid ? (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span className="badge badge-green" style={{ fontSize: 14 }}>✓ {t('fullyPaid')}</span>
        </div>
      ) : intent ? (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href={intent}
            style={{
              display: 'inline-block', padding: '12px 24px', borderRadius: 8,
              background: 'var(--green, #16A34A)', color: '#fff', fontSize: 15, fontWeight: 700,
              textDecoration: 'none',
            }}>
            {t('payNow')} · {money(due)}
          </a>
          {qr && (
            <div style={{ marginTop: 14 }}>
              <img src={qr} alt="UPI QR" width={150} height={150} style={{ borderRadius: 8, border: '1px solid var(--border)' }} />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>{t('scan')}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--text2)' }}>
          {t('noUpi')}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, footer }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 460,
        boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      }}>
        {children}
        {footer && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text3)', marginTop: 22 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const centered = { textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 14 };
const th = { textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const td = { padding: '6px 8px', textAlign: 'right', color: 'var(--text)' };
const row = { display: 'flex', justifyContent: 'space-between', padding: '3px 0' };
