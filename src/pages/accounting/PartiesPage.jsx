/**
 * Parties — unified Customers + Suppliers on /accounting/parties. Reads the SAME
 * clients and vendors collections the rest of the CRM uses (no duplication), and
 * shows each party's outstanding/statement from the double-entry ledger.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi, ledgerApi, dbApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Parties', hi: 'पार्टी', hinglish: 'Parties' },
  all:      { en: 'All', hi: 'सभी', hinglish: 'All' },
  customers:{ en: 'Customers', hi: 'ग्राहक', hinglish: 'Customers' },
  suppliers:{ en: 'Suppliers', hi: 'आपूर्तिकर्ता', hinglish: 'Suppliers' },
  newCustomer: { en: '+ New customer', hi: '+ नया ग्राहक', hinglish: '+ Naya customer' },
  newSupplier: { en: '+ New supplier', hi: '+ नया आपूर्तिकर्ता', hinglish: '+ Naya supplier' },
  search:   { en: 'Search name / phone / GST…', hi: 'खोजें…', hinglish: 'Search…' },
  none:     { en: 'No parties yet.', hi: 'अभी कोई पार्टी नहीं।', hinglish: 'Abhi koi party nahi.' },
  balance:  { en: 'Balance', hi: 'बैलेंस', hinglish: 'Balance' },
  receivable: { en: 'Receivable', hi: 'प्राप्य', hinglish: 'Receivable' },
  payable:  { en: 'Payable', hi: 'देय', hinglish: 'Payable' },
  statement:{ en: 'Statement', hi: 'स्टेटमेंट', hinglish: 'Statement' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  type:     { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  ref:      { en: 'Reference', hi: 'रेफ', hinglish: 'Reference' },
  debit:    { en: 'Debit', hi: 'डेबिट', hinglish: 'Debit' },
  credit:   { en: 'Credit', hi: 'क्रेडिट', hinglish: 'Credit' },
  close:    { en: 'Close', hi: 'बंद करें', hinglish: 'Close' },
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  empty:    { en: 'No ledger activity yet.', hi: 'कोई लेन-देन नहीं।', hinglish: 'No activity yet.' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  name:     { en: 'Name', hi: 'नाम', hinglish: 'Name' },
  phone:    { en: 'Phone', hi: 'फोन', hinglish: 'Phone' },
};

const partyName = (p) => p.name || p.company || p.title || '—';
const partyPhone = (p) => p.phone || p.mobile || p.contact || p.email || '';

export default function PartiesPage() {
  const t = useT(S);
  const [clients, setClients] = useState({});
  const [vendors, setVendors] = useState({});
  const [pos, setPos] = useState({});
  const [clientLedger, setClientLedger] = useState([]);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null); // { type, id, name }

  useEffect(() => {
    const a = onValue(ref(db, 'mpw/clients'), (s) => setClients(s.val() || {}));
    const b = onValue(ref(db, 'mpw/vendors'), (s) => setVendors(s.val() || {}));
    const c = onValue(ref(db, 'mpw/purchaseOrders'), (s) => setPos(s.val() || {}));
    accountingApi.ledger().then(setClientLedger).catch(() => setClientLedger([]));
    return () => { a(); b(); c(); };
  }, []);

  // clientId → outstanding from the per-client invoice ledger (existing endpoint).
  const clientOut = useMemo(() => {
    const m = {};
    clientLedger.forEach((r) => { if (r.clientId) m[r.clientId] = r.outstanding; });
    return m;
  }, [clientLedger]);

  // vendor → payable = sum of received purchase orders (payments land in Phase 2).
  const vendorOut = useMemo(() => {
    const m = {};
    Object.entries(pos).forEach(([id, p]) => {
      if (String(p.status || '').toLowerCase() !== 'received') return;
      const key = p.vendorId || p.vendorName || '';
      if (key) m[key] = round2((m[key] || 0) + (p.total || 0));
    });
    return m;
  }, [pos]);

  const customerRows = useMemo(() => Object.entries(clients)
    .map(([id, c]) => ({ id, type: 'client', name: partyName(c), phone: partyPhone(c), gstNo: c.gstNo || c.gstin || '', balance: clientOut[id] || 0 }))
    .filter((r) => r.name !== '—')
    .sort((a, b) => b.balance - a.balance), [clients, clientOut]);

  const supplierRows = useMemo(() => Object.entries(vendors)
    .map(([id, v]) => ({ id, type: 'vendor', name: partyName(v), phone: partyPhone(v), gstNo: v.gstNo || v.gstin || '', balance: vendorOut[id] || vendorOut[v.name] || 0 }))
    .filter((r) => r.name !== '—')
    .sort((a, b) => b.balance - a.balance), [vendors, vendorOut]);

  const rows = tab === 'customers' ? customerRows : tab === 'suppliers' ? supplierRows : [...customerRows, ...supplierRows];

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(s) || r.phone.toLowerCase().includes(s) || r.gstNo.toLowerCase().includes(s));
  }, [rows, q]);

  const addParty = async (type) => {
    const name = window.prompt(t('name'));
    if (!name || !name.trim()) return;
    const phone = window.prompt(t('phone'), '') || '';
    try {
      await dbApi.create(type === 'client' ? 'clients' : 'vendors', { name: name.trim(), phone: phone.trim(), status: 'active', createdAt: Date.now() });
      showToast('✅ ' + (type === 'client' ? t('customers') : t('suppliers')), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => addParty('client')}>{t('newCustomer')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => addParty('vendor')}>{t('newSupplier')}</button>
        </div>
      </div>

      <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'customers', 'suppliers'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
            style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
            {t(k)}
          </button>
        ))}
        <input className="input" style={{ marginLeft: 'auto', maxWidth: 260 }} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!filtered.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 1fr 140px 110px', gap: 8, padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
          <div>{t('name')}</div><div>{t('phone')}</div><div>GST</div><div style={{ textAlign: 'right' }}>{t('balance')}</div>
        </div>
        {filtered.map((r) => (
          <button key={r.type + r.id} type="button" onClick={() => setSel(r)}
            style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 1fr 140px 110px', gap: 8, width: '100%', textAlign: 'left', alignItems: 'center', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span className={`badge ${r.type === 'client' ? 'badge-blue' : 'badge-amber'}`} style={{ marginLeft: 6, textTransform: 'uppercase' }}>{r.type === 'client' ? t('customers') : t('suppliers')}</span>
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>{r.phone}</div>
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>{r.gstNo}</div>
            <div style={{ textAlign: 'right', fontWeight: 700, color: r.balance > 0 ? (r.type === 'client' ? 'var(--red)' : 'var(--amber)') : 'var(--text2)' }}>
              {r.balance > 0 ? inr(r.balance) : '—'}
            </div>
          </button>
        ))}
      </div>

      {sel && <StatementModal party={sel} t={t} onClose={() => setSel(null)} />}
    </div>
  );
}

function StatementModal({ party, t, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    ledgerApi.party(party.id, party.type).then(setData).catch(() => setData(null));
  }, [party]);

  const label = data ? (party.type === 'client' ? t('receivable') : t('payable')) : '';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 680, width: '100%', maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{t('statement')} — {party.name}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>
        {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('loading')}</div>}
        {data && (
          <>
            <div className="flex" style={{ gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="card" style={{ padding: '10px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: data.balance > 0 ? 'var(--red)' : 'var(--text2)' }}>{inr(data.balance)}</div>
              </div>
            </div>
            {data.entries.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('empty')}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 90px 90px', gap: 8, padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <div>{t('date')}</div><div>{t('type')}</div><div>{t('ref')}</div>
              <div style={{ textAlign: 'right' }}>{t('debit')}</div><div style={{ textAlign: 'right' }}>{t('credit')}</div>
            </div>
            {data.entries.map((e, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 110px 1fr 90px 90px', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ color: 'var(--text2)' }}>{e.date}</div>
                <div>{e.type}</div>
                <div style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.ref ? `${e.ref.collection} ${e.ref.id}` : '—'}
                </div>
                <div style={{ textAlign: 'right', color: e.dr ? 'var(--text)' : 'var(--text3)' }}>{e.dr ? inr(e.dr) : ''}</div>
                <div style={{ textAlign: 'right', color: e.cr ? 'var(--green)' : 'var(--text3)' }}>{e.cr ? inr(e.cr) : ''}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
