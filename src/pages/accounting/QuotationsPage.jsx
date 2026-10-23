/**
 * Quotation / Estimate — the list.
 *
 * Opens on the OPEN quotes of the last year, because a quote nobody has
 * answered is the only kind that still needs doing. "Due In" is the honest
 * column: a quote that has run past its validity says how far past, in red,
 * rather than sitting there looking live.
 *
 * Everything money-shaped comes from the invoice machinery (same items, tax,
 * charges and rounding a bill uses), so a quote can never add up differently
 * from the invoice it becomes. What this page owns is the answer — accepted,
 * rejected — and turning a yes into a real bill.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import CreateInvoiceFlow from '../../components/common/CreateInvoiceFlow';

const S = {
  title:     { en: 'Quotation / Estimate', hi: 'कोटेशन / अनुमान', hinglish: 'Quotation / Estimate', gu: 'ક્વોટેશન / અંદાજ', mr: 'कोटेशन / अंदाज', mwr: 'कोटेशन / अंदाज' },
  create:    { en: 'Create Quotation', hi: 'कोटेशन बनाएं', hinglish: 'Quotation banayein', gu: 'ક્વોટેશન બનાવો', mr: 'कोटेशन तयार करा', mwr: 'कोटेशन बणाओ' },
  search:    { en: 'Search party or number', hi: 'पार्टी या नंबर खोजें', hinglish: 'Party ya number dhundein', gu: 'પાર્ટી કે નંબર શોધો', mr: 'पार्टी किंवा नंबर शोधा', mwr: 'पार्टी या नंबर ढूंढो' },
  date:      { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  number:    { en: 'Quotation Number', hi: 'कोटेशन नंबर', hinglish: 'Quotation Number', gu: 'ક્વોટેશન નંબર', mr: 'कोटेशन नंबर', mwr: 'कोटेशन नंबर' },
  party:     { en: 'Party Name', hi: 'पार्टी का नाम', hinglish: 'Party Name', gu: 'પાર્ટીનું નામ', mr: 'पार्टीचे नाव', mwr: 'पार्टी रो नाम' },
  dueIn:     { en: 'Due In', hi: 'कब तक', hinglish: 'Due In', gu: 'ક્યાં સુધી', mr: 'कधीपर्यंत', mwr: 'कद ताईं' },
  amount:    { en: 'Amount', hi: 'राशि', hinglish: 'Amount', gu: 'રકમ', mr: 'रक्कम', mwr: 'रकम' },
  status:    { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  none:      { en: 'No quotations here yet.', hi: 'अभी कोई कोटेशन नहीं।', hinglish: 'Abhi koi quotation nahi.', gu: 'હજી કોઈ ક્વોટેશન નથી.', mr: 'अजून कोटेशन नाही.', mwr: 'अबै कोई कोटेशन कोनी।' },
  overdueBy: { en: 'Overdue by', hi: 'देर', hinglish: 'Overdue by', gu: 'મોડું', mr: 'उशीर', mwr: 'देर' },
  days:      { en: 'days', hi: 'दिन', hinglish: 'days', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  today:     { en: 'Expires today', hi: 'आज खत्म', hinglish: 'Aaj khatam', gu: 'આજે પૂરું', mr: 'आज संपेल', mwr: 'आज खतम' },
  inDays:    { en: 'in', hi: 'में', hinglish: 'in', gu: 'માં', mr: 'मध्ये', mwr: 'में' },
  accept:    { en: 'Mark accepted', hi: 'स्वीकृत करें', hinglish: 'Accepted karein', gu: 'સ્વીકાર્યું', mr: 'स्वीकारले', mwr: 'मंजूर करो' },
  reject:    { en: 'Mark rejected', hi: 'अस्वीकृत करें', hinglish: 'Rejected karein', gu: 'નકાર્યું', mr: 'नाकारले', mwr: 'नामंजूर करो' },
  convert:   { en: 'Convert to Invoice', hi: 'इनवॉइस बनाएं', hinglish: 'Invoice banayein', gu: 'ઇન્વોઇસ બનાવો', mr: 'इनव्हॉइस करा', mwr: 'इनवॉइस बणाओ' },
  reopen:    { en: 'Reopen', hi: 'फिर खोलें', hinglish: 'Reopen', gu: 'ફરી ખોલો', mr: 'पुन्हा उघडा', mwr: 'फेरूं खोलो' },
  becameInv: { en: 'Invoiced as', hi: 'इनवॉइस', hinglish: 'Invoiced as', gu: 'ઇન્વોઇસ', mr: 'इनव्हॉइस', mwr: 'इनवॉइस' },
  failed:    { en: 'Something went wrong', hi: 'कुछ गलत हो गया', hinglish: 'Kuch galat ho gaya', gu: 'કંઈક ખોટું થયું', mr: 'काहीतरी चुकले', mwr: 'कीं गलत हो ग्यो' },
  done:      { en: 'Updated', hi: 'अपडेट हुआ', hinglish: 'Update ho gaya', gu: 'અપડેટ થયું', mr: 'अपडेट झाले', mwr: 'अपडेट हुयो' },
  last365:   { en: 'Last 365 Days', hi: 'पिछले 365 दिन', hinglish: 'Last 365 Days', gu: 'છેલ્લા 365 દિવસ', mr: 'मागील 365 दिवस', mwr: 'पाछला 365 दिन' },
};

const STATUS_LABEL = {
  open: 'Open', accepted: 'Accepted', rejected: 'Rejected',
  expired: 'Expired', converted: 'Invoiced', all: 'All',
};
const STATUS_TONE = {
  open: 'badge-amber', accepted: 'badge-green', rejected: 'badge-red',
  expired: 'badge-red', converted: 'badge-blue',
};

const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');
const pretty = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${MON[Number(m) - 1] || ''} ${y}`;
};

export default function QuotationsPage() {
  const t = useT(S);
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  // The quote being turned into a bill: its priced body, handed to the normal
  // invoice form so nothing about the money is recomputed differently here.
  const [converting, setConverting] = useState(null);
  const [menu, setMenu] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await accountingApi.quotations({ status })); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  }, [status, t]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data && data.rows) || [];
    if (!needle) return list;
    return list.filter((r) => `${r.clientName || ''} ${r.invoiceNo || ''}`.toLowerCase().includes(needle));
  }, [data, q]);

  const setStatusOf = async (row, next) => {
    try {
      await accountingApi.setQuotationStatus(row.id, { status: next });
      showToast(t('done'), 'success');
      setMenu(null);
      await load();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  /**
   * Fetch the quote's priced body and open the ordinary invoice form with it.
   * The form POSTs to the usual create route, which is what links the two and
   * closes the quote — so there is no second copy of invoice creation here.
   */
  const convert = async (row) => {
    setMenu(null);
    try {
      setConverting(await accountingApi.quotationDraft(row.id));
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    }
  };

  // "Overdue by 161 days" / "in 5 days" / "Expires today".
  const dueIn = (r) => {
    if (r.daysLeft === null || r.daysLeft === undefined) return <span style={{ color: 'var(--text3)' }}>—</span>;
    if (r.daysLeft < 0) {
      return <span style={{ color: 'var(--red)' }}>{t('overdueBy')} {Math.abs(r.daysLeft)} {t('days')}</span>;
    }
    if (r.daysLeft === 0) return <span style={{ color: 'var(--amber)' }}>{t('today')}</span>;
    return <span style={{ color: 'var(--text2)' }}>{t('inDays')} {r.daysLeft} {t('days')}</span>;
  };

  return (
    <div data-legacy-id="page-quotations">
      <div className="flex items-center justify-between mb-4" style={{ gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" data-testid="quote-create"
          onClick={() => setCreating(true)}>{t('create')}</button>
      </div>

      <div className="flex items-center mb-4" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder={`🔍 ${t('search')}`}
          value={q} onChange={(e) => setQ(e.target.value)} />
        <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>📅 {t('last365')}</span>
        <select className="input" style={{ maxWidth: 220 }} value={status} data-testid="quote-status-filter"
          onChange={(e) => setStatus(e.target.value)}>
          {['open', 'accepted', 'rejected', 'expired', 'converted', 'all'].map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}{data && data.counts && data.counts[k] !== undefined ? ` (${data.counts[k]})` : ''}
            </option>
          ))}
        </select>
        {busy ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>…</span> : null}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!rows.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
        ) : (
          <table className="crm-table">
            <thead><tr>
              <th>{t('date')}</th><th>{t('number')}</th><th>{t('party')}</th>
              <th>{t('dueIn')}</th><th>{t('amount')}</th><th>{t('status')}</th><th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="quote-row">
                  <td style={{ whiteSpace: 'nowrap' }}>{pretty(r.date)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{r.invoiceNo}</td>
                  <td>{r.clientName || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {/* Once invoiced, how long it was valid for stops mattering. */}
                    {r.status === 'converted'
                      ? <span style={{ color: 'var(--text3)' }}>{t('becameInv')} {r.convertedToInvoiceNo}</span>
                      : dueIn(r)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{inr(r.total)}</td>
                  <td><span className={`badge ${STATUS_TONE[r.status] || 'badge-blue'}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ position: 'relative', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-xs" data-testid="quote-menu"
                      onClick={() => setMenu(menu === r.id ? null : r.id)}>⋮</button>
                    {menu === r.id && (
                      <>
                        <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
                        <div className="card" style={{
                          position: 'absolute', right: 8, top: '100%', zIndex: 6,
                          padding: 4, minWidth: 190, textAlign: 'left',
                        }}>
                          {r.status === 'converted' ? (
                            <div style={{ padding: 8, fontSize: 12.5, color: 'var(--text3)' }}>
                              {t('becameInv')} <b>{r.convertedToInvoiceNo}</b>
                            </div>
                          ) : (
                            <>
                              {/* An expired quote can still be accepted — the
                                  customer saying yes late is a yes. */}
                              {r.status !== 'accepted' && (
                                <button className="btn btn-ghost btn-xs" style={{ width: '100%', textAlign: 'left' }}
                                  onClick={() => setStatusOf(r, 'accepted')}>✅ {t('accept')}</button>
                              )}
                              {r.status !== 'rejected' && (
                                <button className="btn btn-ghost btn-xs" style={{ width: '100%', textAlign: 'left' }}
                                  onClick={() => setStatusOf(r, 'rejected')}>✖ {t('reject')}</button>
                              )}
                              {['accepted', 'rejected'].includes(r.status) && (
                                <button className="btn btn-ghost btn-xs" style={{ width: '100%', textAlign: 'left' }}
                                  onClick={() => setStatusOf(r, 'open')}>↩ {t('reopen')}</button>
                              )}
                              <button className="btn btn-ghost btn-xs" data-testid="quote-convert"
                                style={{ width: '100%', textAlign: 'left', color: 'var(--green)' }}
                                onClick={() => convert(r)}>🧾 {t('convert')}</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CreateInvoiceFlow
          forceType="quotation"
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load(); }}
        />
      )}

      {converting && (
        <CreateInvoiceFlow
          forceType="invoice"
          prefill={converting}
          onClose={() => setConverting(null)}
          onCreated={(inv) => {
            setConverting(null);
            load();
            if (inv && inv.id) navigate(`/invoice-view?id=${encodeURIComponent(inv.id)}`);
          }}
        />
      )}
    </div>
  );
}
