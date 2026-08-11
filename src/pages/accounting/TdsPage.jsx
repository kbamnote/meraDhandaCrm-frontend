/**
 * Tax Deducted at Source (Phase 4A-4) — record contractor/rent/professional fee
 * payments with TDS withheld, and pull a challan-ready section×rate report.
 *
 * Reads  GET  /accounting/tds/sections (194C/194I/194J + default rates),
 *        GET  /accounting/tds         (voucher list),
 *        GET  /accounting/tds/report  (section×rate + party-wise totals).
 * Writes POST /accounting/tds         (voucher → posting.type 'tds',
 *              expense dr GROSS / tds_payable cr / cash|bank cr NET),
 *        DELETE /accounting/tds/:id   (delete-and-repost).
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, Section, inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

const S = {
  title:     { en: '🧾 TDS', hi: '🧾 टीडीएस', hinglish: '🧾 TDS' },
  vouchersTab:{ en: 'Vouchers', hi: 'वाउचर', hinglish: 'Vouchers' },
  reportTab: { en: 'Challan Report', hi: 'चालान रिपोर्ट', hinglish: 'Challan Report' },
  refresh:   { en: 'Refresh', hi: 'रिफ्रेश', hinglish: 'Refresh' },
  addTitle:  { en: 'New TDS Voucher', hi: 'नया टीडीएस वाउचर', hinglish: 'Naya TDS Voucher' },
  section:   { en: 'Section', hi: 'सेक्शन', hinglish: 'Section' },
  rate:      { en: 'Rate %', hi: 'दर %', hinglish: 'Rate %' },
  gross:     { en: 'Gross Amount', hi: 'कुल राशि', hinglish: 'Gross Amount' },
  tdsAmt:    { en: 'TDS', hi: 'टीडीएस', hinglish: 'TDS' },
  netPay:    { en: 'Net Payable', hi: 'शुद्ध देय', hinglish: 'Net Payable' },
  category:  { en: 'Category', hi: 'श्रेणी', hinglish: 'Category' },
  catPh:     { en: 'e.g. Contractor Charges', hi: 'जैसे ठेका शुल्क', hinglish: 'e.g. Contractor Charges' },
  party:     { en: 'Party Name', hi: 'पार्टी का नाम', hinglish: 'Party Name' },
  partyPh:   { en: 'e.g. Sharma Constructions', hi: 'जैसे शर्मा कंस्ट्रक्शन', hinglish: 'e.g. Sharma Constructions' },
  mode:      { en: 'Payment Mode', hi: 'भुगतान माध्यम', hinglish: 'Payment Mode' },
  cash:      { en: 'Cash', hi: 'नकद', hinglish: 'Cash' },
  bank:      { en: 'Bank', hi: 'बैंक', hinglish: 'Bank' },
  date:      { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  memo:      { en: 'Memo', hi: 'मेमो', hinglish: 'Memo' },
  memoPh:    { en: 'Optional note', hi: 'वैकल्पिक नोट', hinglish: 'Optional note' },
  save:      { en: 'Save Voucher', hi: 'वाउचर सेव करें', hinglish: 'Voucher Save Karo' },
  preview:   { en: 'Preview', hi: 'पूर्वावलोकन', hinglish: 'Preview' },
  tdsBadge:  { en: 'TDS', hi: 'टीडीएस', hinglish: 'TDS' },
  netBadge:  { en: 'Net', hi: 'नेट', hinglish: 'Net' },
  emptyRate: { en: 'Rate 0 — nothing withheld', hi: 'दर 0 — कोई कटौती नहीं', hinglish: 'Rate 0 - koi kati nahi' },
  fillReq:   { en: 'Choose a section, rate and gross amount.', hi: 'सेक्शन, दर और कुल राशि चुनें।', hinglish: 'Section, rate aur gross amount chuno.' },
  voucherList:{ en: 'TDS Vouchers', hi: 'टीडीएस वाउचर', hinglish: 'TDS Vouchers' },
  noVouchers:{ en: 'No TDS vouchers yet.', hi: 'अभी कोई टीडीएस वाउचर नहीं।', hinglish: 'Abhi koi TDS voucher nahi.' },
  delete:    { en: 'Delete', hi: 'हटाएं', hinglish: 'Delete' },
  confirmDel:{ en: 'Delete this TDS voucher? Its journal entry will be removed too.', hi: 'यह टीडीएस वाउचर हटाएं? जर्नल प्रविष्टि भी हटेगी।', hinglish: 'Ye TDS voucher delete? Journal entry bhi hat jayega.' },
  saved:     { en: 'TDS voucher saved', hi: 'टीडीएस वाउचर सेव हुआ', hinglish: 'TDS voucher saved' },
  deleted:   { en: 'TDS voucher deleted', hi: 'टीडीएस वाउचर हटाया गया', hinglish: 'TDS voucher deleted' },
  // report
  from:      { en: 'From', hi: 'से', hinglish: 'From' },
  to:        { en: 'To', hi: 'तक', hinglish: 'To' },
  branch:    { en: 'Branch', hi: 'शाखा', hinglish: 'Branch' },
  allBranches:{ en: 'All branches', hi: 'सभी शाखाएं', hinglish: 'All branches' },
  apply:     { en: 'Apply', hi: 'लागू करें', hinglish: 'Apply' },
  totalGross:{ en: 'Total Gross', hi: 'कुल राशि', hinglish: 'Total Gross' },
  totalTds:  { en: 'Total TDS', hi: 'कुल टीडीएस', hinglish: 'Total TDS' },
  totalNet:  { en: 'Total Net', hi: 'कुल शुद्ध', hinglish: 'Total Net' },
  vouchers:  { en: 'Vouchers', hi: 'वाउचर', hinglish: 'Vouchers' },
  bySection: { en: 'Section-wise (Challan-ready)', hi: 'सेक्शन अनुसार (चालान के लिए)', hinglish: 'Section-wise (Challan-ready)' },
  byParty:   { en: 'Party-wise', hi: 'पार्टी अनुसार', hinglish: 'Party-wise' },
  count:     { en: 'Count', hi: 'गिनती', hinglish: 'Count' },
  noReport:  { en: 'No vouchers in this period.', hi: 'इस अवधि में कोई वाउचर नहीं।', hinglish: 'Is period me koi voucher nahi.' },
  detail:    { en: 'Voucher Detail', hi: 'वाउचर विवरण', hinglish: 'Voucher Detail' },
  colRate:   { en: 'Rate', hi: 'दर', hinglish: 'Rate' },
};

const fmtAmt = (n) => inr(Number(n) || 0);
const MODE_BADGE = { cash: 'badge-green', bank: 'badge-blue' };

export default function TdsPage() {
  const t = useT(S);
  const [tab, setTab] = useState('vouchers'); // vouchers | report

  // catalog + list
  const [sections, setSections] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // form state
  const [f, setF] = useState({ date: today(), section: '194C', rate: '', gross: '', category: '', party: '', mode: 'cash', memo: '' });
  const [saving, setSaving] = useState(false);

  // report state
  const [rf, setRf] = useState({ from: monthStart(), to: today(), branchId: '' });
  const [report, setReport] = useState(null);

  const loadList = () => {
    accountingApi.tdsList().then(setVouchers).catch((e) => setErr(e.response?.data?.error || 'Failed to load'));
  };

  useEffect(() => {
    accountingApi.tdsSections().then((secs) => {
      setSections(secs || []);
      const c = (secs || [])[0];
      if (c) setF((p) => ({ ...p, section: c.code, rate: String(c.defaultRate) }));
    }).catch(() => {});
    loadList();
  }, []); // eslint-disable-line

  const loadReport = () => {
    setBusy(true); setErr(null);
    accountingApi.tdsReport(rf)
      .then(setReport)
      .catch((e) => { setErr(e.response?.data?.error || 'Failed to load'); setReport(null); })
      .finally(() => setBusy(false));
  };

  const pickSection = (code) => {
    const c = sections.find((s) => s.code === code);
    setF((p) => ({ ...p, section: code, rate: c ? String(c.defaultRate) : p.rate }));
  };

  // live preview
  const gross = Number(f.gross) || 0;
  const rate = Number(f.rate) || 0;
  const tdsAmt = round2((gross * rate) / 100);
  const netPay = round2(gross - tdsAmt);

  const setFk = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!f.section || !(gross > 0) || !(rate > 0)) return showToast(t('fillReq'), 'error');
    setSaving(true);
    try {
      await accountingApi.tdsCreate({
        date: f.date, section: f.section, rate, grossAmount: gross,
        category: f.category.trim() || undefined,
        partyName: f.party.trim() || undefined,
        paymentMode: f.mode, memo: f.memo.trim() || undefined,
      });
      showToast(t('saved'), 'success');
      setF((p) => ({ ...p, gross: '', category: '', party: '', memo: '' }));
      loadList();
    } catch (e) { showToast(e.response?.data?.error || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const del = async (v) => {
    if (!window.confirm(`${t('confirmDel')} (${v.date}, ${t('section')} ${v.section}, ${fmtAmt(v.grossAmount)})`)) return;
    try {
      await accountingApi.tdsDelete(v.id);
      showToast(t('deleted'), 'success');
      loadList();
      if (report) loadReport();
    } catch (e) { showToast(e.response?.data?.error || 'Delete failed', 'error'); }
  };

  const total = report?.total;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => { if (tab === 'report') loadReport(); else loadList(); }} disabled={busy}>{busy ? '…' : t('refresh')}</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {[['vouchers', `🧾 ${t('vouchersTab')}`], ['report', `📊 ${t('reportTab')}`]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '8px 16px', cursor: 'pointer', border: 'none', background: 'none',
              fontWeight: tab === k ? 600 : 400, fontSize: 13,
              color: tab === k ? 'var(--blue)' : 'var(--text2)',
              borderBottom: tab === k ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}

      {tab === 'vouchers' && (
        <>
          {/* New voucher */}
          <Section title={t('addTitle')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>{t('date')}</label>
                <input type="date" className="input" value={f.date} onChange={setFk('date')} />
              </div>
              <div>
                <label style={labelStyle}>{t('section')}</label>
                <select className="input" value={f.section} onChange={(e) => pickSection(e.target.value)}>
                  {sections.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('rate')}</label>
                <input type="number" min="0" max="100" step="any" className="input" value={f.rate} onChange={setFk('rate')} />
              </div>
              <div>
                <label style={labelStyle}>{t('gross')}</label>
                <input type="number" min="0" step="any" className="input" value={f.gross} onChange={setFk('gross')} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>{t('party')}</label>
                <input type="text" className="input" value={f.party} onChange={setFk('party')} placeholder={t('partyPh')} />
              </div>
              <div>
                <label style={labelStyle}>{t('category')}</label>
                <input type="text" className="input" value={f.category} onChange={setFk('category')} placeholder={t('catPh')} />
              </div>
              <div>
                <label style={labelStyle}>{t('mode')}</label>
                <select className="input" value={f.mode} onChange={setFk('mode')}>
                  <option value="cash">{t('cash')}</option>
                  <option value="bank">{t('bank')}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>{t('memo')}</label>
                <input type="text" className="input" value={f.memo} onChange={setFk('memo')} placeholder={t('memoPh')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '…' : t('save')}</button>
              </div>
            </div>

            {/* Live preview */}
            <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{t('preview')}:</span>
              <span className="badge" style={{ background: 'var(--border)' }}>{t('gross')} {fmtAmt(gross)}</span>
              <span className="badge badge-amber">{t('tdsBadge')} {fmtAmt(tdsAmt)}{rate > 0 ? ` @${rate}%` : ` (${t('emptyRate')})`}</span>
              <span className="badge badge-green">{t('netBadge')} {fmtAmt(netPay)}</span>
            </div>
          </Section>

          {/* Voucher list */}
          <Section title={`🧾 ${t('voucherList')}`}>
            {vouchers.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noVouchers')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={thStyle}>{t('date')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('section')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('party')}</th>
                      <th style={thStyle}>{t('gross')}</th>
                      <th style={thStyle}>{t('colRate')}</th>
                      <th style={thStyle}>{t('tdsAmt')}</th>
                      <th style={thStyle}>{t('netPay')}</th>
                      <th style={thStyle}>{t('mode')}</th>
                      <th style={thStyle}>{t('delete')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{v.date}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{v.section}{v.category ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.category}</div> : null}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{v.partyName || '—'}</td>
                        <td style={tdStyle}>{fmtAmt(v.grossAmount)}</td>
                        <td style={tdStyle}>{v.rate}%</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--amber)' }}>{fmtAmt(v.tdsAmount)}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--green)' }}>{fmtAmt(v.netAmount)}</td>
                        <td style={tdStyle}><span className={`badge ${MODE_BADGE[v.paymentMode] || 'badge'}`}>{v.paymentMode === 'bank' ? t('bank') : t('cash')}</span></td>
                        <td style={tdStyle}>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(v)}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {tab === 'report' && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>{t('from')}</label>
                <input type="date" className="input" value={rf.from} onChange={(e) => setRf((p) => ({ ...p, from: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('to')}</label>
                <input type="date" className="input" value={rf.to} onChange={(e) => setRf((p) => ({ ...p, to: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>{t('branch')}</label>
                <BranchSelect value={rf.branchId} onChange={(v) => setRf((p) => ({ ...p, branchId: v }))} allowAll allLabel={t('allBranches')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn" onClick={loadReport} disabled={busy}>{t('apply')}</button>
              </div>
            </div>
          </div>

          {!report ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
          ) : (
            <>
              {/* KPIs */}
              <KpiGrid>
                <Kpi label={t('totalGross')} value={fmtAmt(total.gross)} icon="💰" color="var(--text)" />
                <Kpi label={t('totalTds')} value={fmtAmt(total.tds)} icon="🧮" color="var(--amber)" />
                <Kpi label={t('totalNet')} value={fmtAmt(total.net)} icon="💵" color="var(--green)" />
                <Kpi label={t('vouchers')} value={String(total.count)} icon="🧾" color="var(--blue)" />
              </KpiGrid>

              {/* Section-wise (challan-ready) */}
              <Section title={`🧮 ${t('bySection')}`}>
                {report.bySection.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noReport')}</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>{t('section')}</th>
                          <th style={thStyle}>{t('colRate')}</th>
                          <th style={thStyle}>{t('count')}</th>
                          <th style={thStyle}>{t('gross')}</th>
                          <th style={thStyle}>{t('tdsAmt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.bySection.map((s) => (
                          <tr key={`${s.section}|${s.rate}`} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>
                              <span style={{ fontWeight: 600 }}>{s.section}</span>
                              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.name}</div>
                            </td>
                            <td style={tdStyle}>{s.rate}%</td>
                            <td style={tdStyle}>{s.count}</td>
                            <td style={tdStyle}>{fmtAmt(s.gross)}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--amber)' }}>{fmtAmt(s.tds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Party-wise */}
              <Section title={`🤝 ${t('byParty')}`}>
                {report.parties.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noReport')}</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={{ ...thStyle, textAlign: 'left' }}>{t('party')}</th>
                          <th style={thStyle}>{t('count')}</th>
                          <th style={thStyle}>{t('gross')}</th>
                          <th style={thStyle}>{t('tdsAmt')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.parties.map((p) => (
                          <tr key={p.name} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>{p.name}</td>
                            <td style={tdStyle}>{p.count}</td>
                            <td style={tdStyle}>{fmtAmt(p.gross)}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--amber)' }}>{fmtAmt(p.tds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Voucher detail */}
              <Section title={`🧾 ${t('detail')}`}>
                {report.vouchers.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noReport')}</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <th style={thStyle}>{t('date')}</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>{t('section')}</th>
                          <th style={{ ...thStyle, textAlign: 'left' }}>{t('party')}</th>
                          <th style={thStyle}>{t('gross')}</th>
                          <th style={thStyle}>{t('tdsAmt')}</th>
                          <th style={thStyle}>{t('netPay')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.vouchers.map((v) => (
                          <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{v.date}</td>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>{v.section}</td>
                            <td style={{ ...tdStyle, textAlign: 'left' }}>{v.partyName || '—'}</td>
                            <td style={tdStyle}>{fmtAmt(v.grossAmount)}</td>
                            <td style={{ ...tdStyle, color: 'var(--amber)' }}>{fmtAmt(v.tdsAmount)}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--green)' }}>{fmtAmt(v.netAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )}
        </>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 };
const thStyle = { textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const tdStyle = { padding: '6px 8px', textAlign: 'right', color: 'var(--text)' };
