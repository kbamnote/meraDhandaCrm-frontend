/**
 * Assign Production modal — the Job Setter action. Build an ordered department
 * sequence (single or multi-department, e.g. Offset → Lamination → UV) and start
 * production. The job's steps are snapshotted server-side from the chosen depts.
 */
import { useEffect, useState } from 'react';
import { ordersApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const S = {
  assign:    { en: '🏭 Assign production', hi: '🏭 प्रोडक्शन सौंपें', hinglish: '🏭 Production assign', gu: '🏭 પ્રોડક્શન સોંપો', mr: '🏭 प्रोडक्शन नेमा', mwr: '🏭 प्रोडक्शन सौंपो' },
  pick:      { en: 'Tap departments in order (multi-department supported):', hi: 'विभाग क्रम में चुनें (मल्टी-डिपार्टमेंट सपोर्टेड):', hinglish: 'Departments order mein chunein (multi-department supported):', gu: 'વિભાગો ક્રમમાં પસંદ કરો:', mr: 'विभाग क्रमाने निवडा:', mwr: 'विभाग क्रम मांय चुणो:' },
  sequence:  { en: 'Sequence', hi: 'क्रम', hinglish: 'Sequence', gu: 'ક્રમ', mr: 'क्रम', mwr: 'क्रम' },
  vendor:    { en: 'Vendor name (outsource)', hi: 'वेंडर का नाम (आउटसोर्स)', hinglish: 'Vendor naam (outsource)', gu: 'વેન્ડર નામ (આઉટસોર્સ)', mr: 'व्हेंडर नाव (आउटसोर्स)', mwr: 'वेंडर नाम (आउटसोर्स)' },
  returnDate:{ en: 'Expected return date', hi: 'वापसी की तारीख', hinglish: 'Return date', gu: 'પરત તારીખ', mr: 'परतीची तारीख', mwr: 'वापसी री तारीख' },
  start:     { en: 'Start production', hi: 'प्रोडक्शन शुरू करें', hinglish: 'Production shuru karein', gu: 'પ્રોડક્શન શરૂ કરો', mr: 'प्रोडक्शन सुरू करा', mwr: 'प्रोडक्शन चालू करो' },
  cancel:    { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  pickOne:   { en: 'Pick at least one department', hi: 'कम से कम एक विभाग चुनें', hinglish: 'Kam se kam ek department chunein', gu: 'ઓછામાં ઓછો એક વિભાગ પસંદ કરો', mr: 'किमान एक विभाग निवडा', mwr: 'कम सूं कम एक विभाग चुणो' },
  started:   { en: 'Production started', hi: 'प्रोडक्शन शुरू', hinglish: 'Production shuru', gu: 'પ્રોડક્શન શરૂ', mr: 'प्रोडक्शन सुरू', mwr: 'प्रोडक्शन चालू' },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function AssignProductionModal({ jobId, jobNo, onClose, onDone }) {
  const t = useT(S);
  const [depts, setDepts] = useState([]);
  const [seq, setSeq] = useState([]);          // ordered dept keys
  const [vendorName, setVendorName] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ordersApi.departments().then(setDepts).catch(() => setDepts([])); }, []);

  const byKey = Object.fromEntries(depts.map((d) => [d.key, d]));
  const hasOutsource = seq.some((k) => byKey[k]?.outsource);

  const add = (k) => setSeq((s) => [...s, k]);
  const removeAt = (i) => setSeq((s) => s.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!seq.length) return showToast(t('pickOne'), 'error');
    setBusy(true);
    try {
      await ordersApi.assignProduction(jobId, { departments: seq, vendorName: vendorName || null, returnDate: returnDate || null });
      showToast(t('started'), 'success');
      onDone?.();
      onClose();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 2 }}>{t('assign')}</h3>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 12 }}>{jobNo}</div>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{t('pick')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {depts.map((d) => (
            <button key={d.key} className="btn btn-xs" onClick={() => add(d.key)}
              style={{ background: 'var(--surface2)', border: 'none', borderRadius: 10 }}>
              {d.emoji} {d.name}
            </button>
          ))}
        </div>

        {!!seq.length && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>{t('sequence')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {seq.map((k, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: byKey[k]?.color || '#888', color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {i + 1}. {byKey[k]?.emoji} {byKey[k]?.name}
                  <button onClick={() => removeAt(i)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {hasOutsource && (
          <div className="flex gap-2">
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('vendor')}</label>
              <input className="input" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{t('returnDate')}</label>
              <input className="input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? '…' : t('start')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
