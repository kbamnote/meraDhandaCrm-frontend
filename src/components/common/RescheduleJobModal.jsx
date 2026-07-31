/**
 * RescheduleJobModal — re-route a held job to a department (Designer / Job Setter /
 * Production / QC / Dispatch), with an optional new delivery date and note. When
 * Production is chosen, the user also picks one-or-more production types (the same
 * tiles used in the Job Setter → Assign Production flow). Calls the backend
 * POST /orders/:id/reschedule via ordersApi.reschedule().
 */
import { useState, useEffect } from 'react';
import { ordersApi } from '../../services/api';
import { showToast } from './toast';
import { useT } from '../../i18n/LanguageContext';

const S = {
  title:        { en: 'Reschedule job', hi: 'जॉब री-शेड्यूल करें', hinglish: 'Job reschedule karein', gu: 'જોબ રી-શેડ્યૂલ કરો', mr: 'जॉब री-शेड्यूल करा', mwr: 'जॉब री-शेड्यूल करो' },
  routeTo:      { en: 'Send to department', hi: 'विभाग में भेजें', hinglish: 'Department mein bhejein', gu: 'વિભાગમાં મોકલો', mr: 'विभागात पाठवा', mwr: 'विभाग में भेजो' },
  designer:     { en: 'Designer', hi: 'डिज़ाइनर', hinglish: 'Designer', gu: 'ડિઝાઇનર', mr: 'डिझायनर', mwr: 'डिज़ाइनर' },
  jobsetter:    { en: 'Job Setter', hi: 'जॉब सेटर', hinglish: 'Job Setter', gu: 'જોબ સેટર', mr: 'जॉब सेटर', mwr: 'जॉब सेटर' },
  production:   { en: 'Production', hi: 'प्रोडक्शन', hinglish: 'Production', gu: 'પ્રોડક્શન', mr: 'प्रोडक्शन', mwr: 'प्रोडक्शन' },
  qc:           { en: 'QC', hi: 'क्यूसी', hinglish: 'QC', gu: 'QC', mr: 'QC', mwr: 'QC' },
  dispatch:     { en: 'Dispatch', hi: 'डिस्पैच', hinglish: 'Dispatch', gu: 'ડિસ્પેચ', mr: 'डिस्पॅच', mwr: 'डिस्पैच' },
  pickTypes:    { en: 'Pick at least one production type', hi: 'कम से कम एक प्रोडक्शन टाइप चुनें', hinglish: 'Kam se kam ek production type chunein', gu: 'ઓછામાં ઓછો એક પ્રોડક્શન ટાઇપ પસંદ કરો', mr: 'किमान एक प्रोडक्शन प्रकार निवडा', mwr: 'कम सूं कम एक प्रोडक्शन टाइप चुणो' },
  deliveryDate: { en: 'New delivery date', hi: 'नई डिलीवरी तारीख', hinglish: 'Nayi delivery date', gu: 'નવી ડિલિવરી તારીખ', mr: 'नवीन डिलिव्हरी तारीख', mwr: 'नई डिलीवरी तारीख' },
  reason:       { en: 'Reason (optional)', hi: 'कारण (वैकल्पिक)', hinglish: 'Reason (optional)', gu: 'કારણ (વૈકલ્પિક)', mr: 'कारण (पर्यायी)', mwr: 'कारण (वैकल्पिक)' },
  submit:       { en: '🔁 Reschedule job', hi: '🔁 जॉब री-शेड्यूल करें', hinglish: '🔁 Job reschedule karein', gu: '🔁 જોબ રી-શેડ્યૂલ કરો', mr: '🔁 जॉब री-शेड्यूल करा', mwr: '🔁 जॉब री-शेड्यूल करो' },
  submitting:   { en: 'Rescheduling…', hi: 'री-शेड्यूल हो रहा है…', hinglish: 'Reschedule ho raha hai…', gu: 'રી-શેડ્યૂલ થઈ રહ્યું છે…', mr: 'री-शेड्यूल होत आहे…', mwr: 'री-शेड्यूल हो रियो है…' },
  cancel:       { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  success:      { en: 'Job rescheduled', hi: 'जॉब री-शेड्यूल हो गई', hinglish: 'Job reschedule ho gayi', gu: 'જોબ રી-શેડ્યૂલ થઈ', mr: 'जॉब री-शेड्यूल झाली', mwr: 'जॉब री-शेड्यूल हो गी' },
  failed:       { en: 'Reschedule failed', hi: 'री-शेड्यूल नहीं हुआ', hinglish: 'Reschedule nahi hua', gu: 'રી-શેડ્યૂલ નિષ્ફળ', mr: 'री-शेड्यूल अयशस्वी', mwr: 'री-शेड्यूल कोनी हुयो' },
};

const DEPARTMENTS = [
  { value: 'designer',  emoji: '🎨', key: 'designer' },
  { value: 'jobsetter', emoji: '🛠', key: 'jobsetter' },
  { value: 'production', emoji: '🏭', key: 'production' },
  { value: 'qc',        emoji: '🔍', key: 'qc' },
  { value: 'dispatch',  emoji: '🚚', key: 'dispatch' },
];

export default function RescheduleJobModal({ job, onClose }) {
  const t = useT(S);
  const [to, setTo] = useState('');
  const [types, setTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Load production-type tiles the first time Production is chosen.
  useEffect(() => {
    if (to !== 'production' || types.length) return;
    let alive = true;
    ordersApi.departments()
      .then((d) => { if (alive) setTypes(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [to, types.length]);

  const toggleType = (key) =>
    setSelectedTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const disabled =
    busy || !to || (to === 'production' && selectedTypes.length === 0);

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    setBusy(true);
    try {
      await ordersApi.reschedule(job.id, {
        to,
        note: note || undefined,
        deliveryDate: deliveryDate || undefined,
        departments: to === 'production' ? selectedTypes : undefined,
      });
      showToast(t('success'), 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const tileBase = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '10px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    border: '1px solid var(--border)', background: 'var(--bg2, #fff)', textAlign: 'center',
  };
  const tileSelected = {
    border: '2px solid var(--blue)', background: 'var(--blue-soft, #EFF6FF)', fontWeight: 600,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 6 }}>🔁 {t('title')}</h3>

        {/* Job identity — read-only line */}
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          <span style={{ fontFamily: 'monospace' }}>{job.jobNo}</span>
          {job.clientName ? <> · {job.clientName}</> : null}
        </div>

        {/* Department picker (single-select) */}
        <div className="form-group">
          <label>{t('routeTo')}</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 8, marginTop: 4 }}>
            {DEPARTMENTS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setTo(d.value)}
                style={{ ...tileBase, ...(to === d.value ? tileSelected : {}) }}
              >
                <span style={{ fontSize: 22 }}>{d.emoji}</span>
                <span>{t(d.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Production-type multi-select — only when Production is chosen */}
        {to === 'production' && (
          <div className="form-group">
            <label>{t('production')}</label>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>{t('pickTypes')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8 }}>
              {types.map((ty) => (
                <button
                  key={ty.key || ty.id}
                  type="button"
                  onClick={() => toggleType(ty.key)}
                  style={{
                    ...tileBase,
                    ...(selectedTypes.includes(ty.key) ? tileSelected : {}),
                    ...(ty.color ? { borderColor: selectedTypes.includes(ty.key) ? ty.color : undefined } : {}),
                  }}
                >
                  {ty.emoji ? <span style={{ fontSize: 20 }}>{ty.emoji}</span> : null}
                  <span>{ty.name || ty.key}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Optional new delivery date */}
        <div className="form-group">
          <label>{t('deliveryDate')}</label>
          <input
            className="input"
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
          />
        </div>

        {/* Optional reason / note */}
        <div className="form-group">
          <label>{t('reason')}</label>
          <textarea
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={disabled}>
            {busy ? t('submitting') : t('submit')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
