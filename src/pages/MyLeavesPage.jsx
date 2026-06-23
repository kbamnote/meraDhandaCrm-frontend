/**
 * My Leaves — personal self-service page.
 * Lists the caller's own leave requests via meApi.leaves() and lets them
 * file a new request via meApi.requestLeave().
 */
import { useEffect, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  myLeaves: { en: 'My Leaves', hi: 'मेरी छुट्टियाँ', hinglish: 'My Leaves', gu: 'મારી રજાઓ', mr: 'माझ्या रजा', mwr: 'म्हारी छुट्टियाँ' },
  request: { en: 'request', hi: 'अनुरोध', hinglish: 'request', gu: 'વિનંતી', mr: 'विनंती', mwr: 'अरज' },
  requests: { en: 'requests', hi: 'अनुरोध', hinglish: 'requests', gu: 'વિનંતીઓ', mr: 'विनंत्या', mwr: 'अरज' },
  requestLeaveBtn: { en: '+ Request Leave', hi: '+ छुट्टी के लिए अनुरोध', hinglish: '+ Request Leave', gu: '+ રજાની વિનંતી', mr: '+ रजेची विनंती', mwr: '+ छुट्टी री अरज' },
  noLeaves: { en: 'No leave requests yet.', hi: 'अभी तक कोई छुट्टी अनुरोध नहीं।', hinglish: 'Abhi tak koi leave request nahi.', gu: 'હજુ સુધી કોઈ રજાની વિનંતી નથી.', mr: 'अद्याप कोणतीही रजा विनंती नाही.', mwr: 'अजे तांई कोई छुट्टी री अरज कोनी।' },
  type: { en: 'Type', hi: 'प्रकार', hinglish: 'Type', gu: 'પ્રકાર', mr: 'प्रकार', mwr: 'किसम' },
  from: { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to: { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  status: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  reason: { en: 'Reason', hi: 'कारण', hinglish: 'Reason', gu: 'કારણ', mr: 'कारण', mwr: 'कारण' },
  pending: { en: 'pending', hi: 'लंबित', hinglish: 'pending', gu: 'બાકી', mr: 'प्रलंबित', mwr: 'बाकी' },
  casual: { en: 'Casual', hi: 'कैजुअल', hinglish: 'Casual', gu: 'કેઝ્યુઅલ', mr: 'कॅज्युअल', mwr: 'कैजुअल' },
  sick: { en: 'Sick', hi: 'बीमारी', hinglish: 'Sick', gu: 'બીમારી', mr: 'आजारपण', mwr: 'बीमारी' },
  earned: { en: 'Earned', hi: 'अर्जित', hinglish: 'Earned', gu: 'કમાયેલી', mr: 'अर्जित', mwr: 'कमाई' },
  unpaid: { en: 'Unpaid', hi: 'अवैतनिक', hinglish: 'Unpaid', gu: 'પગાર વગરની', mr: 'विनावेतन', mwr: 'बिना पगार' },
  fromDate: { en: 'From date *', hi: 'से तारीख *', hinglish: 'From date *', gu: 'થી તારીખ *', mr: 'पासून तारीख *', mwr: 'सूं तारीख *' },
  toDate: { en: 'To date *', hi: 'तक तारीख *', hinglish: 'To date *', gu: 'સુધી તારીખ *', mr: 'पर्यंत तारीख *', mwr: 'तांई तारीख *' },
  failedLoad: { en: 'Failed to load leaves', hi: 'छुट्टियाँ लोड नहीं हुईं', hinglish: 'Leaves load nahi huin', gu: 'રજાઓ લોડ કરવામાં નિષ્ફળ', mr: 'रजा लोड करता आल्या नाहीत', mwr: 'छुट्टियाँ लोड कोनी हुई' },
  fromRequired: { en: 'From date is required', hi: 'से तारीख ज़रूरी है', hinglish: 'From date zaroori hai', gu: 'થી તારીખ જરૂરી છે', mr: 'पासून तारीख आवश्यक आहे', mwr: 'सूं तारीख जरूरी है' },
  toRequired: { en: 'To date is required', hi: 'तक तारीख ज़रूरी है', hinglish: 'To date zaroori hai', gu: 'સુધી તારીખ જરૂરી છે', mr: 'पर्यंत तारीख आवश्यक आहे', mwr: 'तांई तारीख जरूरी है' },
  submitted: { en: 'Leave request submitted', hi: 'छुट्टी अनुरोध भेजा गया', hinglish: 'Leave request submit ho gaya', gu: 'રજાની વિનંતી સબમિટ થઈ', mr: 'रजा विनंती सबमिट झाली', mwr: 'छुट्टी री अरज भेज दी' },
  failedSubmit: { en: 'Failed to submit leave', hi: 'छुट्टी अनुरोध नहीं भेजा गया', hinglish: 'Leave submit nahi hua', gu: 'રજા સબમિટ કરવામાં નિષ્ફળ', mr: 'रजा सबमिट करता आली नाही', mwr: 'छुट्टी कोनी भेजी' },
  submitting: { en: 'Submitting…', hi: 'भेजा जा रहा है…', hinglish: 'Submit ho raha hai…', gu: 'સબમિટ થઈ રહ્યું છે…', mr: 'सबमिट होत आहे…', mwr: 'भेजी जा री है…' },
  submitRequest: { en: 'Submit request', hi: 'अनुरोध भेजें', hinglish: 'Request submit karein', gu: 'વિનંતી સબમિટ કરો', mr: 'विनंती सबमिट करा', mwr: 'अरज भेजो' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
};

const STATUS_BADGE = {
  pending: 'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

export default function MyLeavesPage() {
  const t = useT(S);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    try {
      const data = await meApi.leaves();
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.response?.data?.error || t('failedLoad'), 'error');
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div data-legacy-id="page-my-leaves" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-leaves">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🌴 {t('myLeaves')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {leaves.length} {leaves.length === 1 ? t('request') : t('requests')}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
          {t('requestLeaveBtn')}
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!leaves.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noLeaves')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('type')}</th>
                <th>{t('from')}</th>
                <th>{t('to')}</th>
                <th>{t('status')}</th>
                <th>{t('reason')}</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l, i) => (
                <tr key={l.id || `${l.fromDate || ''}-${i}`}>
                  <td style={{ textTransform: 'capitalize' }}>{l.type || '—'}</td>
                  <td>{l.fromDate || '—'}</td>
                  <td>{l.toDate || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[l.status] || 'badge-amber'}`}>
                      {l.status || t('pending')}
                    </span>
                  </td>
                  <td>{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <RequestLeaveModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
    </div>
  );
}

function RequestLeaveModal({ onClose, onSaved }) {
  const t = useT(S);
  const [type, setType] = useState('casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!fromDate) return showToast(t('fromRequired'), 'error');
    if (!toDate) return showToast(t('toRequired'), 'error');

    setBusy(true);
    try {
      await meApi.requestLeave({
        type,
        fromDate,
        toDate,
        reason: reason.trim(),
      });
      showToast(t('submitted'), 'success');
      onSaved();
    } catch (err) {
      showToast(err.response?.data?.error || t('failedSubmit'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>{t('requestLeaveBtn')}</h3>

        <div className="form-group">
          <label>{t('type')}</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="casual">{t('casual')}</option>
            <option value="sick">{t('sick')}</option>
            <option value="earned">{t('earned')}</option>
            <option value="unpaid">{t('unpaid')}</option>
          </select>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('fromDate')}</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('toDate')}</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
          </div>
        </div>

        <div className="form-group">
          <label>{t('reason')}</label>
          <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? t('submitting') : t('submitRequest')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
