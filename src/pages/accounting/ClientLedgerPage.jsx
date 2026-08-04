/**
 * Client Ledger — /client-ledger. Per-client statement with invoice-wise
 * breakdown, payment history, credit notes, age-wise outstanding analysis,
 * and a party statement from the double-entry ledger.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi, ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;

const S = {
  title:    { en: 'Client Ledger', hi: 'क्लाइंट लेजर', hinglish: 'Client Ledger' },
  select:   { en: 'Select Client', hi: 'क्लाइंट चुनें', hinglish: 'Select Client' },
  totalInvoiced: { en: 'Total Invoiced', hinglish: 'Total Invoiced' },
  totalPaid:{ en: 'Total Paid', hinglish: 'Total Paid' },
  credited: { en: 'Credit Notes', hinglish: 'Credit Notes' },
  outstanding: { en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding' },
  invoices: { en: 'Invoices', hinglish: 'Invoices' },
  payments: { en: 'Payments', hinglish: 'Payments' },
  creditNotes: { en: 'Credit Notes', hinglish: 'Credit Notes' },
  ageWise:  { en: 'Age-wise Outstanding', hinglish: 'Age-wise Outstanding' },
  current:  { en: 'Current', hinglish: 'Current' },
  '1-30':   { en: '1–30 days', hinglish: '1–30 days' },
  '31-60':  { en: '31–60 days', hinglish: '31–60 days' },
  '61-90':  { en: '61–90 days', hinglish: '61–90 days' },
  '90+':    { en: '90+ days', hinglish: '90+ days' },
  invoiceNo:{ en: 'Invoice No', hinglish: 'Invoice No' },
  date:     { en: 'Date', hinglish: 'Date' },
  dueDate:  { en: 'Due Date', hinglish: 'Due Date' },
  total:    { en: 'Total', hinglish: 'Total' },
  paid:     { en: 'Paid', hinglish: 'Paid' },
  amount:   { en: 'Amount', hinglish: 'Amount' },
  mode:     { en: 'Mode', hinglish: 'Mode' },
  reason:   { en: 'Reason', hinglish: 'Reason' },
  creditNo: { en: 'Credit No', hinglish: 'Credit No' },
  status:   { en: 'Status', hinglish: 'Status' },
  ageDays:  { en: 'Age (days)', hinglish: 'Age' },
  noClient: { en: 'Select a client to view their ledger.', hinglish: 'Select a client.' },
  noData:   { en: 'No transactions found.', hinglish: 'No transactions.' },
  search:   { en: 'Search clients…', hinglish: 'Search…' },
  party:    { en: 'Party', hinglish: 'Party' },
  dr:       { en: 'Debit', hinglish: 'Debit' },
  cr:       { en: 'Credit', hinglish: 'Credit' },
  running:  { en: 'Balance', hinglish: 'Balance' },
  type:     { en: 'Type', hinglish: 'Type' },
  reference:{ en: 'Reference', hinglish: 'Reference' },
};

export default function ClientLedgerPage() {
  const t = useT(S);
  const [clients, setClients] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [ledger, setLedger] = useState(null);
  const [partyStmt, setPartyStmt] = useState(null);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('invoices');

  useEffect(() => {
    accountingApi.ledger().then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    if (!selectedId) { setLedger(null); setPartyStmt(null); return; }
    accountingApi.clientLedger(selectedId).then(setLedger).catch(() => setLedger(null));
    ledgerApi.party(selectedId, 'client').then(setPartyStmt).catch(() => setPartyStmt(null));
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!q) return clients;
    const s = q.toLowerCase();
    return clients.filter((c) => (c.clientName || '').toLowerCase().includes(s));
  }, [clients, q]);

  const ageColor = (bucket) => {
    if (bucket === 'current') return 'var(--green)';
    if (bucket === '1-30') return 'var(--amber)';
    return 'var(--red)';
  };

  const selectedClient = clients.find((c) => c.clientId === selectedId);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>{t('title')}</h2>

      {/* Client selector */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>{t('search')}</label>
          <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4, display: 'block' }}>{t('select')}</label>
          <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            style={{ width: '100%' }}>
            <option value="">— {t('select')} —</option>
            {filtered.map((c) => (
              <option key={c.clientId || c.clientName} value={c.clientId || c.clientName}>
                {c.clientName} {c.outstanding > 0 ? `(${inr(c.outstanding)} due)` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedId && (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>{t('noClient')}</div>
      )}

      {selectedId && !ledger && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>}

      {ledger && (
        <>
          {/* KPIs */}
          <KpiGrid>
            <Kpi label={t('totalInvoiced')} value={inr(ledger.totalInvoiced)} icon="🧾" color="var(--blue)" />
            <Kpi label={t('totalPaid')} value={inr(ledger.totalPaid)} icon="✅" color="var(--green)" />
            <Kpi label={t('credited')} value={inr(ledger.totalCredited)} icon="📝" color="var(--amber)" />
            <Kpi label={t('outstanding')} value={inr(ledger.outstanding)} icon="💰" color={ledger.outstanding > 0 ? 'var(--red)' : 'var(--green)'} />
          </KpiGrid>

          {/* Age-wise breakdown */}
          {ledger.ageBuckets && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('ageWise')}</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(ledger.ageBuckets).map(([bucket, amt]) => (
                  <div key={bucket} style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface2)', textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{t(bucket)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: ageColor(bucket) }}>{inr(amt)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
            {['invoices', 'payments', 'creditNotes', 'party'].map((k) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ padding: '8px 16px', cursor: 'pointer', border: 'none', background: 'none', fontWeight: tab === k ? 600 : 400, fontSize: 13, color: tab === k ? 'var(--blue)' : 'var(--text2)', borderBottom: tab === k ? '2px solid var(--blue)' : '2px solid transparent', marginBottom: -2 }}>
                {t(k)}
              </button>
            ))}
          </div>

          {/* Invoices tab */}
          {tab === 'invoices' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              {ledger.invoices.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('noData')}</div> : (
                <table className="table table-sm" style={{ minWidth: 600, margin: 0 }}>
                  <thead>
                    <tr>
                      <th>{t('invoiceNo')}</th><th>{t('date')}</th><th>{t('dueDate')}</th>
                      <th style={{ textAlign: 'right' }}>{t('total')}</th><th style={{ textAlign: 'right' }}>{t('paid')}</th>
                      <th style={{ textAlign: 'right' }}>{t('outstanding')}</th><th>{t('ageDays')}</th><th>{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNo}</td>
                        <td style={{ fontSize: 12 }}>{inv.date}</td>
                        <td style={{ fontSize: 12 }}>{inv.dueDate || '—'}</td>
                        <td style={{ textAlign: 'right' }}>{inr(inv.total)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)' }}>{inr(inv.paidAmount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: inv.outstanding > 0 ? 'var(--red)' : 'var(--text)' }}>{inr(inv.outstanding)}</td>
                        <td style={{ fontSize: 12 }}>{inv.ageDays}</td>
                        <td>
                          <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: inv.status === 'paid' ? 'var(--green)' : inv.status === 'partial' ? 'var(--amber)' : 'var(--red)', color: '#fff' }}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Payments tab */}
          {tab === 'payments' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              {ledger.payments.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('noData')}</div> : (
                <table className="table table-sm" style={{ minWidth: 400, margin: 0 }}>
                  <thead><tr><th>{t('date')}</th><th>{t('invoiceNo')}</th><th>{t('mode')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th></tr></thead>
                  <tbody>
                    {ledger.payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: 12 }}>{p.date}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.invoiceNo}</td>
                        <td><span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: p.mode === 'bank' ? 'var(--green)' : 'var(--amber)', color: '#fff' }}>{p.mode}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{inr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Credit Notes tab */}
          {tab === 'creditNotes' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              {ledger.creditNotes.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('noData')}</div> : (
                <table className="table table-sm" style={{ minWidth: 400, margin: 0 }}>
                  <thead><tr><th>{t('creditNo')}</th><th>{t('date')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th><th>{t('reason')}</th></tr></thead>
                  <tbody>
                    {ledger.creditNotes.map((cn) => (
                      <tr key={cn.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{cn.creditNo}</td>
                        <td style={{ fontSize: 12 }}>{cn.date}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--amber)' }}>{inr(cn.total)}</td>
                        <td style={{ fontSize: 12 }}>{cn.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Party statement (from double-entry ledger) */}
          {tab === 'party' && (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              {!partyStmt ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>…</div> : (
                <>
                  {partyStmt.entries && partyStmt.entries.length > 0 ? (
                    <table className="table table-sm" style={{ minWidth: 500, margin: 0 }}>
                      <thead><tr><th>{t('date')}</th><th>{t('type')}</th><th>{t('reference')}</th><th style={{ textAlign: 'right' }}>{t('dr')}</th><th style={{ textAlign: 'right' }}>{t('cr')}</th><th style={{ textAlign: 'right' }}>{t('running')}</th></tr></thead>
                      <tbody>
                        {partyStmt.entries.map((e, i) => (
                          <tr key={i}>
                            <td style={{ fontSize: 12 }}>{e.date}</td>
                            <td>{e.type}</td>
                            <td style={{ fontSize: 11 }}>{e.ref ? `${e.ref.collection} ${String(e.ref.id).slice(0, 8)}` : '—'}</td>
                            <td style={{ textAlign: 'right' }}>{e.dr ? inr(e.dr) : ''}</td>
                            <td style={{ textAlign: 'right' }}>{e.cr ? inr(e.cr) : ''}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(e.running)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{t('noData')}</div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
