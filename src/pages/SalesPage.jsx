/**
 * Sales / Leads CRM — manage leads (assign, deal outcome, Excel import), a
 * salesperson leaderboard (with monthly targets), and a deal-outcome report.
 * Raw lead CRUD still lives on /leads-crm; this is the sales workflow surface.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { salesApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

const S = {
  title:    { en: '💼 Sales & Leads', hi: '💼 सेल्स और लीड्स', hinglish: '💼 Sales & Leads', gu: '💼 સેલ્સ અને લીડ્સ', mr: '💼 सेल्स व लीड्स', mwr: '💼 सेल्स अर लीड्स' },
  leads:    { en: 'Leads', hi: 'लीड्स', hinglish: 'Leads', gu: 'લીડ્સ', mr: 'लीड्स', mwr: 'लीड्स' },
  board:    { en: 'Leaderboard', hi: 'लीडरबोर्ड', hinglish: 'Leaderboard', gu: 'લીડરબોર્ડ', mr: 'लीडरबोर्ड', mwr: 'लीडरबोर्ड' },
  report:   { en: 'Report', hi: 'रिपोर्ट', hinglish: 'Report', gu: 'રિપોર્ટ', mr: 'अहवाल', mwr: 'रिपोर्ट' },
  import:   { en: '📥 Import Excel', hi: '📥 एक्सेल इम्पोर्ट', hinglish: '📥 Import Excel', gu: '📥 એક્સેલ ઇમ્પોર્ટ', mr: '📥 एक्सेल इम्पोर्ट', mwr: '📥 एक्सेल इम्पोर्ट' },
  none:     { en: 'No leads yet.', hi: 'अभी कोई लीड नहीं।', hinglish: 'Abhi koi lead nahi.', gu: 'હજુ કોઈ લીડ નથી.', mr: 'अद्याप लीड नाही.', mwr: 'अजे कोई लीड कोनी।' },
  assignTo: { en: 'Assign…', hi: 'सौंपें…', hinglish: 'Assign…', gu: 'સોંપો…', mr: 'नेमा…', mwr: 'सौंपो…' },
  won:      { en: 'Won', hi: 'जीता', hinglish: 'Won', gu: 'જીત્યું', mr: 'जिंकले', mwr: 'जीत्यो' },
  lost:     { en: 'Lost', hi: 'हारा', hinglish: 'Lost', gu: 'હાર્યું', mr: 'हरले', mwr: 'हार्यो' },
  pending:  { en: 'Pending', hi: 'पेंडिंग', hinglish: 'Pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
  dealValue:{ en: 'Deal value (₹)?', hi: 'डील वैल्यू (₹)?', hinglish: 'Deal value (₹)?', gu: 'ડીલ વેલ્યુ (₹)?', mr: 'डील व्हॅल्यू (₹)?', mwr: 'डील वैल्यू (₹)?' },
  imported: { en: 'Imported', hi: 'इम्पोर्ट हो गया', hinglish: 'Import ho gaya', gu: 'ઇમ્પોર્ટ થયું', mr: 'इम्पोर्ट झाले', mwr: 'इम्पोर्ट हो ग्यो' },
  setTarget:{ en: 'Set target', hi: 'टारगेट सेट करें', hinglish: 'Target set karein', gu: 'ટાર્ગેટ સેટ કરો', mr: 'टार्गेट सेट करा', mwr: 'टारगेट सेट करो' },
  targetQ:  { en: 'Monthly target (₹)?', hi: 'मासिक टारगेट (₹)?', hinglish: 'Monthly target (₹)?', gu: 'માસિક ટાર્ગેટ (₹)?', mr: 'मासिक टार्गेट (₹)?', mwr: 'मासिक टारगेट (₹)?' },
  totalLeads:{ en: 'Total leads', hi: 'कुल लीड्स', hinglish: 'Total leads', gu: 'કુલ લીડ્સ', mr: 'एकूण लीड्स', mwr: 'कुल लीड्स' },
  revenue:  { en: 'Revenue', hi: 'रेवेन्यू', hinglish: 'Revenue', gu: 'આવક', mr: 'महसूल', mwr: 'रेवेन्यू' },
  conversion:{ en: 'Conversion', hi: 'कन्वर्ज़न', hinglish: 'Conversion', gu: 'કન્વર્ઝન', mr: 'रूपांतर', mwr: 'कन्वर्ज़न' },
  done:     { en: 'Done', hi: 'हो गया', hinglish: 'Done', gu: 'થયું', mr: 'झाले', mwr: 'हो ग्यो' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};
const OUTCOME_TONE = { won: 'badge-green', lost: 'badge-red' };

export default function SalesPage() {
  const t = useT(S);
  const [tab, setTab] = useState('leads');
  const [leads, setLeads] = useState({});
  const [users, setUsers] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/leads'), (s) => setLeads(s.val() || {}));
    const u2 = onValue(ref(db, 'mpw/users'), (s) => setUsers(s.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const leadList = useMemo(() => Object.entries(leads).map(([id, v]) => ({ ...v, id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [leads]);
  const salespeople = useMemo(() => Object.entries(users).map(([id, u]) => ({ ...u, id })).filter((u) => u.role === 'sales' || u.customRole === 'sales' || ['admin', 'owner', 'manager'].includes(u.role)), [users]);

  const assign = async (lead, uid) => {
    const u = users[uid];
    try { await salesApi.assignLead(lead.id, { assignedTo: uid || null, assignedToName: u ? (u.name || u.email) : null }); showToast(t('done'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };
  const outcome = async (lead, o) => {
    let value = 0;
    if (o === 'won') { const v = window.prompt(t('dealValue'), String(lead.dealValue || '')); if (v === null) return; value = Number(v) || 0; }
    try { await salesApi.setOutcome(lead.id, { outcome: o, value }); showToast(t('done'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { const r = await salesApi.importLeads(file); showToast(`${t('imported')}: ${r.created}/${r.totalRows}`, 'success'); }
    catch (err) { showToast(err.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        {tab === 'leads' && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>{t('import')}</button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['leads', 'board', 'report'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
            style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>{t(k)}</button>
        ))}
      </div>

      {tab === 'leads' && (
        <>
          {!leadList.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
          {leadList.map((lead) => (
            <div key={lead.id} className="card" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {lead.name || '—'} {lead.outcome && <span className={`badge ${OUTCOME_TONE[lead.outcome] || 'badge-amber'}`}>{t(lead.outcome)}{lead.outcome === 'won' && lead.dealValue ? ` ${inr(lead.dealValue)}` : ''}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.phone ? `📱 ${lead.phone} · ` : ''}{lead.source || '—'}{lead.city ? ` · ${lead.city}` : ''}</div>
                  {lead.assignedToName && <div style={{ fontSize: 11, color: 'var(--text3)' }}>👤 {lead.assignedToName}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <select className="input" style={{ width: 'auto', padding: '4px 8px' }} value={lead.assignedTo || ''} onChange={(e) => assign(lead, e.target.value)}>
                    <option value="">{t('assignTo')}</option>
                    {salespeople.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button className="btn btn-success btn-xs" onClick={() => outcome(lead, 'won')}>{t('won')}</button>
                    <button className="btn btn-danger btn-xs" onClick={() => outcome(lead, 'lost')}>{t('lost')}</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => outcome(lead, 'pending')}>{t('pending')}</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === 'board' && <Leaderboard t={t} users={users} />}
      {tab === 'report' && <ReportTab t={t} />}
    </div>
  );
}

function Leaderboard({ t, users }) {
  const month = new Date().toISOString().slice(0, 7);
  const [rows, setRows] = useState(null);
  const [targets, setTargets] = useState({});
  const load = () => {
    salesApi.leaderboard({}).then(setRows).catch(() => setRows([]));
    salesApi.targets(month).then((tg) => { const m = {}; (tg || []).forEach((x) => { m[x.userId] = x.target; }); setTargets(m); }).catch(() => {});
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  const setTgt = async (r) => {
    if (r.userId === 'unassigned') return;
    const v = window.prompt(t('targetQ'), String(targets[r.userId] || ''));
    if (v === null) return;
    try { await salesApi.setTarget({ userId: r.userId, month, target: Number(v) || 0 }); load(); } catch { /* ignore */ }
  };

  if (!rows) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>;
  return rows.map((r, i) => (
    <div key={i} className="card" style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{i + 1}. {r.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.leads} {t('leads')} · {r.won} {t('won')} · {r.conversion}% {t('conversion')}{targets[r.userId] ? ` · 🎯 ${inr(targets[r.userId])}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>{inr(r.revenue)}</div>
          {r.userId !== 'unassigned' && <button className="btn btn-ghost btn-xs" onClick={() => setTgt(r)}>{t('setTarget')}</button>}
        </div>
      </div>
    </div>
  ));
}

function ReportTab({ t }) {
  const [d, setD] = useState(null);
  useEffect(() => { salesApi.report({}).then(setD).catch(() => {}); }, []);
  if (!d) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>;
  const Cell = ({ label, value, color }) => (
    <div className="card" style={{ flex: 1, textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
    </div>
  );
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <Cell label={t('totalLeads')} value={d.total} />
        <Cell label={t('won')} value={d.won} color="var(--green)" />
        <Cell label={t('lost')} value={d.lost} color="var(--red)" />
        <Cell label={t('pending')} value={d.pending} color="var(--amber)" />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Cell label={t('revenue')} value={inr(d.revenue)} color="var(--green)" />
        <Cell label={t('conversion')} value={`${d.conversion}%`} />
      </div>
    </>
  );
}
