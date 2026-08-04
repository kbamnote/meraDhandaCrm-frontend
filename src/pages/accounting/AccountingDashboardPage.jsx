/**
 * Accounting Dashboard — the /accounting home. Reads live documents (invoices,
 * purchase orders, expenses) for the operational cards and the ledger projection
 * for everything that must balance (receivables/payables/cash/GST/stock). All
 * numbers derive from the same double-entry engine the Reports read, so the
 * dashboard and the reports can't disagree.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi, ledgerApi, stockApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, Section, BarList, ColumnChart, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const sum = (arr, f) => round2(arr.reduce((s, x) => s + (f ? Number(f(x)) || 0 : Number(x) || 0), 0));

const S = {
  title:    { en: 'Accounting Dashboard', hi: 'अकाउंटिंग डैशबोर्ड', hinglish: 'Accounting Dashboard' },
  sales:    { en: 'Sales (invoiced)', hi: 'सेल्स', hinglish: 'Sales' },
  purchases:{ en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  expenses: { en: 'Expenses', hi: 'खर्च', hinglish: 'Expenses' },
  profit:   { en: 'Profit', hi: 'लाभ', hinglish: 'Profit' },
  receivables:{ en: 'Receivables', hi: 'प्राप्य', hinglish: 'Receivables' },
  payables: { en: 'Payables', hi: 'देय', hinglish: 'Payables' },
  cash:     { en: 'Cash in Hand', hi: 'नकदी', hinglish: 'Cash in Hand' },
  bank:     { en: 'Bank Balance', hi: 'बैंक', hinglish: 'Bank Balance' },
  stockValue:{ en: 'Stock Value', hi: 'स्टॉक मूल्य', hinglish: 'Stock Value' },
  gstPayable:{ en: 'GST Payable', hi: 'जीएसटी देय', hinglish: 'GST Payable' },
  gstInput: { en: 'GST Input', hi: 'जीएसटी इनपुट', hinglish: 'GST Input' },
  overdue:  { en: 'Overdue', hi: 'अतिदेय', hinglish: 'Overdue' },
  invoices: { en: 'Invoices', hi: 'इनवॉइस', hinglish: 'Invoices' },
  thisMonth:{ en: 'this month', hi: 'इस महीने', hinglish: 'is mahine' },
  salesVsPurchases: { en: 'Monthly Sales vs Purchases', hi: 'मासिक सेल्स बनाम खरीद', hinglish: 'Monthly Sales vs Purchases' },
  cashFlow: { en: 'Cash Flow (in/out)', hi: 'कैश फ्लो', hinglish: 'Cash Flow' },
  topClients: { en: 'Top Clients by Outstanding', hi: 'टॉप क्लाइंट', hinglish: 'Top Clients by Outstanding' },
  recent:   { en: 'Recent Journal Activity', hi: 'हालिया गतिविधि', hinglish: 'Recent Activity' },
  alerts:   { en: 'Alerts', hi: 'अलर्ट', hinglish: 'Alerts' },
  overdueInvoices: { en: 'Overdue invoices', hi: 'अतिदेय इनवॉइस', hinglish: 'Overdue invoices' },
  lowStock: { en: 'Low stock', hi: 'कम स्टॉक', hinglish: 'Low stock' },
  none:     { en: 'All clear', hi: 'सब ठीक है', hinglish: 'All clear' },
  payable:  { en: 'Payable', hi: 'देय', hinglish: 'Payable' },
  input:    { en: 'Input', hi: 'इनपुट', hinglish: 'Input' },
  netCash:  { en: 'Net', hi: 'नेट', hinglish: 'Net' },
  reminders:{ en: 'Automated Reminders', hi: 'स्वचालित रिमाइंडर', hinglish: 'Automated Reminders' },
  markRead: { en: '✓', hinglish: '✓' },
  noReminders: { en: 'No automated reminders yet — the hourly sweep flags overdue invoices & low stock.', hinglish: 'Abhi koi reminder nahi.' },
  dueOn:    { en: 'due', hinglish: 'due' },
  left:     { en: 'left (min', hinglish: 'left (min' },
};

export default function AccountingDashboardPage() {
  const t = useT(S);
  const nav = useNavigate();

  const [invoices, setInvoices] = useState({});
  const [pos, setPos] = useState({});
  const [expenses, setExpenses] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [cashFlow, setCashFlow] = useState({ series: [] });
  const [alerts, setAlerts] = useState({ overdue: [], lowStock: [], outstandingTotal: 0 });
  const [valuation, setValuation] = useState({ total: 0 });
  const [clientLedger, setClientLedger] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pnlData, setPnlData] = useState({ profit: 0 });
  const [reminders, setReminders] = useState([]);

  useEffect(() => {
    const a = onValue(ref(db, 'mpw/invoices'), (s) => setInvoices(s.val() || {}));
    const b = onValue(ref(db, 'mpw/purchaseOrders'), (s) => setPos(s.val() || {}));
    const c = onValue(ref(db, 'mpw/expenses'), (s) => setExpenses(s.val() || {}));
    return () => { a(); b(); c(); };
  }, []);

  useEffect(() => {
    ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    ledgerApi.cashFlow({ months: 12 }).then(setCashFlow).catch(() => setCashFlow({ series: [] }));
    accountingApi.alerts().then(setAlerts).catch(() => setAlerts({ overdue: [], lowStock: [], outstandingTotal: 0 }));
    stockApi.valuation().then(setValuation).catch(() => setValuation({ total: 0 }));
    accountingApi.ledger().then(setClientLedger).catch(() => setClientLedger([]));
    ledgerApi.entries().then((r) => setEntries((r.entries || []).slice(0, 8))).catch(() => setEntries([]));
    ledgerApi.pnl().then(setPnlData).catch(() => setPnlData({ profit: 0 }));
    accountingApi.reminders().then(setReminders).catch(() => setReminders([]));
  }, []);

  const unreadReminders = reminders.filter((r) => !r.read).length;
  const markRead = (id) => {
    accountingApi.markReminderRead(id).catch(() => {});
    setReminders((rs) => rs.map((r) => (r.id === id ? { ...r, read: true } : r)));
  };

  const docList = (obj) => Object.entries(obj).map(([id, v]) => ({ ...v, id }));
  const invList = useMemo(() => docList(invoices).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [invoices]);
  const salesInvoices = invList.filter((i) => i.type !== 'proforma' && i.status !== 'void');
  const poList = useMemo(() => docList(pos), [pos]);
  const expList = useMemo(() => docList(expenses), [expenses]);

  const sales = sum(salesInvoices, (i) => i.total);
  const purchases = sum(poList.filter((p) => String(p.status || '').toLowerCase() === 'received'), (p) => p.total);
  const expensesSum = sum(expList, (e) => e.amount);
  const outstanding = sum(salesInvoices, (i) => (i.total || 0) - (i.paidAmount || 0));

  const acct = (key) => accounts.find((a) => a.key === key)?.balance || 0;
  const cash = acct('cash'); const bank = acct('bank');
  const payables = acct('ap');
  const gstPayable = round2(acct('cgst_payable') + acct('sgst_payable') + acct('igst_payable'));
  const gstInput = round2(acct('cgst_input') + acct('sgst_input') + acct('igst_input'));

  const profit = pnlData.profit || 0;
  const overdueSum = sum(alerts.overdue, (o) => o.outstanding);

  // Monthly sales vs purchases for the last 8 months (documents are the source).
  const monthSeries = useMemo(() => {
    const buckets = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`, sales: 0, purchases: 0 });
    }
    for (const i of salesInvoices) {
      const k = (i.date || '').slice(0, 7); const b = buckets.find((x) => x.key === k);
      if (b) b.sales = round2(b.sales + (i.total || 0));
    }
    for (const p of poList) {
      if (String(p.status || '').toLowerCase() !== 'received') continue;
      const k = (p.date || '').slice(0, 7); const b = buckets.find((x) => x.key === k);
      if (b) b.purchases = round2(b.purchases + (p.total || 0));
    }
    return buckets;
  }, [salesInvoices, poList]);

  const topClients = useMemo(() => [...clientLedger]
    .sort((a, b) => b.outstanding - a.outstanding).slice(0, 6)
    .map((r) => ({ label: r.clientName || '—', value: r.outstanding })), [clientLedger]);

  const cashSeries = cashFlow.series.map((r) => ({ label: r.month.slice(5), value: r.net }));

  const acctName = (k) => accounts.find((a) => a.key === k)?.name || k;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => nav('/accounting/sales')}>+ {t('invoices')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('sales')} value={inr(sales)} icon="📈" color="var(--green)" onClick={() => nav('/accounting/sales')} />
        <Kpi label={t('purchases')} value={inr(purchases)} icon="🛒" color="var(--blue)" onClick={() => nav('/purchase-orders')} />
        <Kpi label={t('expenses')} value={inr(expensesSum)} icon="🧾" color="var(--red)" onClick={() => nav('/expenses')} />
        <Kpi label={t('profit')} value={inr(profit)} icon="💹" color={profit >= 0 ? 'var(--green)' : 'var(--red)'} onClick={() => nav('/accounting/reports')} />
        <Kpi label={t('receivables')} value={inr(outstanding)} icon="🤝" color="var(--amber)" onClick={() => nav('/accounting/parties')} />
        <Kpi label={t('payables')} value={inr(payables)} icon="🏢" color="var(--amber)" onClick={() => nav('/accounting/parties')} />
        <Kpi label={t('cash')} value={inr(cash)} icon="💵" color="var(--green)" onClick={() => nav('/accounting/reports')} />
        <Kpi label={t('bank')} value={inr(bank)} icon="🏦" color="var(--green)" onClick={() => nav('/accounting/reports')} />
        <Kpi label={t('stockValue')} value={inr(valuation.total)} icon="📦" color="var(--blue)" onClick={() => nav('/stock')} />
        <Kpi label={t('gstPayable')} value={inr(gstPayable)} icon="🧮" color="var(--red)" onClick={() => nav('/accounting/gst')} />
        <Kpi label={t('gstInput')} value={inr(gstInput)} icon="🧮" color="var(--green)" onClick={() => nav('/accounting/gst')} />
        <Kpi label={t('overdue')} value={inr(overdueSum)} icon="⏰" color="var(--red)" onClick={() => nav('/accounting/parties')} />
        <Kpi label={t('invoices')} value={salesInvoices.length} icon="🧾" color="var(--text)" onClick={() => nav('/accounting/sales')} />
      </KpiGrid>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Section title={t('salesVsPurchases')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
            <ColumnChart data={monthSeries.map((m) => ({ label: m.label, value: m.sales }))} color="var(--green)" money height={140} />
            <ColumnChart data={monthSeries.map((m) => ({ label: m.label, value: m.purchases }))} color="var(--blue)" money height={140} />
          </div>
        </Section>

        <Section title={t('topClients')}>
          <BarList items={topClients} money />
        </Section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Section title={t('cashFlow')}>
          <ColumnChart data={cashSeries} color="var(--blue)" money height={140} />
        </Section>

        <Section title={t('recent')}>
          {entries.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>…</div>}
          {entries.map((e) => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600 }}>{e.type}</span>
                <div style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.lines.filter((l) => l.dr > 0).map((l) => acctName(l.account)).join(', ') || acctName(e.lines[0]?.account || '')}
                </div>
              </div>
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div>{e.date}</div>
                <div style={{ color: 'var(--text2)', fontWeight: 600 }}>{inr(sum(e.lines, (l) => l.dr))}</div>
              </div>
            </div>
          ))}
        </Section>
      </div>

      <Section title={t('reminders')} action={unreadReminders > 0 ? (
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'var(--blue)', color: '#fff' }}>{unreadReminders} new</span>
      ) : null}>
        {reminders.length === 0
          ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>🔕 {t('noReminders')}</div>
          : reminders.slice(0, 12).map((r) => (
              <div key={r.id} style={{
                display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0',
                borderBottom: '1px solid var(--border)', fontSize: 12,
                background: !r.read ? 'rgba(59,130,246,0.05)' : 'none',
              }}>
                <span style={{ fontSize: 14, opacity: r.read ? 0.35 : 1 }}>{r.kind === 'low_stock' ? '📦' : '⏰'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: !r.read ? 'var(--text)' : 'var(--text2)' }}>{r.message}</div>
                  <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                    {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {!r.read && (
                  <button className="btn btn-xs btn-ghost" style={{ color: 'var(--blue)' }} onClick={() => markRead(r.id)} title={t('markRead')}>
                    {t('markRead')}
                  </button>
                )}
              </div>
            ))}
      </Section>

      <Section title={t('alerts')}>
        {alerts.overdue.length === 0 && alerts.lowStock.length === 0
          ? <div style={{ color: 'var(--green)', fontSize: 13 }}>✅ {t('none')}</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⏰ {t('overdueInvoices')} ({alerts.overdue.length})</div>
                {alerts.overdue.map((o) => (
                  <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.invoiceNo} · {o.clientName}</span>
                    <span style={{ color: 'var(--red)', whiteSpace: 'nowrap' }}>{inr(o.outstanding)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📦 {t('lowStock')} ({alerts.lowStock.length})</div>
                {alerts.lowStock.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ color: 'var(--amber)', whiteSpace: 'nowrap' }}>{p.stock} ≤ {p.lowStock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </Section>
    </div>
  );
}
