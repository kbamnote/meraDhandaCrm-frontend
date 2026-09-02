/**
 * Parties — unified Customers + Suppliers on /accounting/parties.
 *
 * Master–detail: the left rail lists every party with its running balance; the
 * right pane is the party's full record, opened by selecting one from the list
 * OR automatically right after you create one. Four tabs:
 *
 *   Transactions      — document feed (invoices, receipts, notes / POs, expenses)
 *   Profile           — the stored party record
 *   Ledger (Statement)— the double-entry view from /api/ledger/party/:id
 *   Item Wise Report  — what this party actually buys, rolled up
 *
 * Reads the SAME clients and vendors collections the rest of the CRM uses (no
 * duplication). Balances come from the ledger, not from re-adding invoices here.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi, describeError } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import CreateInvoiceFlow from '../../components/common/CreateInvoiceFlow';
import PartyBulkUpload from '../../components/common/PartyBulkUpload';
import CreatePurchaseFlow from '../../components/common/CreatePurchaseFlow';
import BankAccountSelect from '../../components/common/BankAccountSelect';
// Reuse the report exporters so a party statement downloads in the same shapes
// as every other report, instead of a second CSV/PDF implementation.
import { downloadCsv, downloadExcel, downloadPdf, printReport } from './ReportsPage';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Parties', hi: 'पार्टी', hinglish: 'Parties' },
  all:      { en: 'All', hi: 'सभी', hinglish: 'All' },
  customers:{ en: 'Customers', hi: 'ग्राहक', hinglish: 'Customers' },
  suppliers:{ en: 'Suppliers', hi: 'आपूर्तिकर्ता', hinglish: 'Suppliers' },
  customer: { en: 'Customer', hi: 'ग्राहक', hinglish: 'Customer' },
  supplier: { en: 'Supplier', hi: 'आपूर्तिकर्ता', hinglish: 'Supplier' },
  newCustomer: { en: '+ New customer', hi: '+ नया ग्राहक', hinglish: '+ Naya customer' },
  newSupplier: { en: '+ New supplier', hi: '+ नया आपूर्तिकर्ता', hinglish: '+ Naya supplier' },
  importExcel: { en: '⬆️ Import from Excel', hi: 'Excel से इम्पोर्ट', hinglish: 'Excel se import' },
  searchParty: { en: 'Search Party', hi: 'पार्टी खोजें', hinglish: 'Search Party' },
  none:     { en: 'No parties yet.', hi: 'अभी कोई पार्टी नहीं।', hinglish: 'Abhi koi party nahi.' },
  pickOne:  { en: 'Select a party to see its details', hi: 'विवरण देखने के लिए पार्टी चुनें', hinglish: 'Details dekhne ke liye party chunein' },
  // Detail header
  sendReminder: { en: 'Send Reminder', hi: 'रिमाइंडर भेजें', hinglish: 'Send Reminder' },
  createInvoice:{ en: 'Create Sales Invoice', hi: 'सेल्स इनवॉइस बनाएं', hinglish: 'Create Sales Invoice' },
  createPurchase:{ en: 'Create Purchase', hi: 'खरीद दर्ज करें', hinglish: 'Purchase banayein' },
  paymentIn:    { en: 'Payment In', hi: 'भुगतान प्राप्त', hinglish: 'Payment In' },
  onAccountTile:{ en: 'On Account', hi: 'खाते में जमा', hinglish: 'On Account' },
  paymentOut:   { en: 'Payment Out', hi: 'भुगतान किया', hinglish: 'Payment Out' },
  recordPayment:{ en: 'Record Payment', hi: 'भुगतान दर्ज करें', hinglish: 'Payment record karein' },
  amountRecv:   { en: 'Amount received', hi: 'प्राप्त राशि', hinglish: 'Amount received' },
  amountPaid:   { en: 'Amount paid', hi: 'दी गई राशि', hinglish: 'Amount paid' },
  payMode:      { en: 'Payment mode', hi: 'भुगतान माध्यम', hinglish: 'Payment mode' },
  reference:    { en: 'Reference / UTR', hi: 'रेफरेंस / UTR', hinglish: 'Reference / UTR' },
  againstInv:   { en: 'Settle against', hi: 'किसके विरुद्ध', hinglish: 'Settle against' },
  oldestFirst:  { en: 'Oldest unpaid invoices (recommended)', hi: 'सबसे पुराने बिल पहले', hinglish: 'Sabse purane bill pehle' },
  currentDue:   { en: 'Currently outstanding', hi: 'अभी बकाया', hinglish: 'Currently outstanding' },
  willSettle:   { en: 'This will settle', hi: 'यह निपटाएगा', hinglish: 'Yeh settle karega' },
  onAccount:    { en: 'held on account', hi: 'खाते में जमा', hinglish: 'account mein jama' },
  saveReceipt:  { en: 'Save', hi: 'सेव', hinglish: 'Save' },
  amountGt0:    { en: 'Enter an amount greater than 0', hi: '0 से बड़ी राशि दें', hinglish: 'Amount 0 se bada dein' },
  // Tabs
  tabTxns:   { en: 'Transactions', hi: 'लेन-देन', hinglish: 'Transactions' },
  tabProfile:{ en: 'Profile', hi: 'प्रोफ़ाइल', hinglish: 'Profile' },
  tabLedger: { en: 'Ledger (Statement)', hi: 'लेजर (स्टेटमेंट)', hinglish: 'Ledger (Statement)' },
  tabItems:  { en: 'Item Wise Report', hi: 'आइटम वाइज रिपोर्ट', hinglish: 'Item Wise Report' },
  // Filters
  dateRange:{ en: 'Select Date Range', hi: 'तारीख सीमा चुनें', hinglish: 'Select Date Range' },
  txnType:  { en: 'Select Transaction Type', hi: 'लेन-देन प्रकार', hinglish: 'Select Transaction Type' },
  status:   { en: 'Select Status', hi: 'स्थिति चुनें', hinglish: 'Select Status' },
  thisMonth:{ en: 'This Month', hi: 'इस महीने', hinglish: 'This Month' },
  lastMonth:{ en: 'Last Month', hi: 'पिछले महीने', hinglish: 'Last Month' },
  thisFy:   { en: 'This Financial Year', hi: 'इस वित्त वर्ष', hinglish: 'This Financial Year' },
  allTime:  { en: 'All Time', hi: 'सभी समय', hinglish: 'All Time' },
  // Table
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  type:     { en: 'Transaction Type', hi: 'लेन-देन प्रकार', hinglish: 'Transaction Type' },
  number:   { en: 'Transaction Number', hi: 'नंबर', hinglish: 'Transaction Number' },
  amount:   { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  statusCol:{ en: 'Status', hi: 'स्थिति', hinglish: 'Status' },
  unpaid:   { en: 'unpaid', hi: 'बकाया', hinglish: 'unpaid' },
  noTxns:   { en: 'No transactions in this range.', hi: 'इस अवधि में कोई लेन-देन नहीं।', hinglish: 'Is range mein koi transaction nahi.' },
  // Profile fields
  name:     { en: 'Name', hi: 'नाम', hinglish: 'Name' },
  phone:    { en: 'Phone', hi: 'फोन', hinglish: 'Phone' },
  email:    { en: 'Email', hi: 'ईमेल', hinglish: 'Email' },
  address:  { en: 'Address', hi: 'पता', hinglish: 'Address' },
  gst:      { en: 'GST No', hi: 'GST नंबर', hinglish: 'GST No' },
  pan:      { en: 'PAN', hi: 'पैन', hinglish: 'PAN' },
  partyType:{ en: 'Party Type', hi: 'पार्टी प्रकार', hinglish: 'Party Type' },
  openingBal:{ en: 'Opening Balance', hi: 'शुरुआती बैलेंस', hinglish: 'Opening Balance' },
  createdOn:{ en: 'Created On', hi: 'बनाया गया', hinglish: 'Created On' },
  notField: { en: 'Not set', hi: 'नहीं दिया', hinglish: 'Not set' },
  // Summary tiles
  balance:  { en: 'Balance', hi: 'बैलेंस', hinglish: 'Balance' },
  receivable:{ en: 'You will get', hi: 'आपको मिलेंगे', hinglish: 'Aapko milenge' },
  payable:  { en: 'You will pay', hi: 'आपको देने हैं', hinglish: 'Aapko dene hain' },
  settled:  { en: 'Settled', hi: 'निपटा', hinglish: 'Settled' },
  totalSales:{ en: 'Total Sales', hi: 'कुल बिक्री', hinglish: 'Total Sales' },
  totalPaid:{ en: 'Received', hi: 'प्राप्त', hinglish: 'Received' },
  totalPurchased:{ en: 'Total Purchases', hi: 'कुल खरीद', hinglish: 'Total Purchases' },
  totalExpensed:{ en: 'Paid', hi: 'भुगतान', hinglish: 'Paid' },
  // Ledger tab
  ref:      { en: 'Reference', hi: 'रेफ', hinglish: 'Reference' },
  debit:    { en: 'Debit', hi: 'डेबिट', hinglish: 'Debit' },
  credit:   { en: 'Credit', hi: 'क्रेडिट', hinglish: 'Credit' },
  empty:    { en: 'No ledger activity yet.', hi: 'कोई लेन-देन नहीं।', hinglish: 'No activity yet.' },
  statement:      { en: 'Statement', hi: 'स्टेटमेंट', hinglish: 'Statement' },
  voucher:        { en: 'Voucher', hi: 'वाउचर', hinglish: 'Voucher' },
  vchNo:          { en: 'Voucher No', hi: 'वाउचर नं', hinglish: 'Voucher No' },
  mode:           { en: 'Mode', hi: 'माध्यम', hinglish: 'Mode' },
  dueDate:        { en: 'Due Date', hi: 'देय तिथि', hinglish: 'Due Date' },
  overdue:        { en: 'overdue', hi: 'विलंबित', hinglish: 'overdue' },
  closingBalance: { en: 'Closing Balance', hi: 'अंतिम बैलेंस', hinglish: 'Closing Balance' },
  totalReceivable:{ en: 'Total Receivable', hi: 'कुल प्राप्य', hinglish: 'Total Receivable' },
  totalPayable:   { en: 'Total Payable', hi: 'कुल देय', hinglish: 'Total Payable' },
  overdueAmount:  { en: 'Overdue Amount', hi: 'विलंबित राशि', hinglish: 'Overdue Amount' },
  totalInvoiced:  { en: 'Total Invoiced', hi: 'कुल इनवॉइस', hinglish: 'Total Invoiced' },
  totalReceived:  { en: 'Total Received', hi: 'कुल प्राप्त', hinglish: 'Total Received' },
  last365:        { en: 'Last 365 days', hi: 'पिछले 365 दिन', hinglish: 'Last 365 days' },
  print:          { en: 'Print', hi: 'प्रिंट', hinglish: 'Print' },
  // Item wise
  item:     { en: 'Item', hi: 'आइटम', hinglish: 'Item' },
  qty:      { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  times:    { en: 'Times', hi: 'बार', hinglish: 'Times' },
  lastOn:   { en: 'Last On', hi: 'अंतिम', hinglish: 'Last On' },
  noItems:  { en: 'No items billed to this party yet.', hi: 'अभी कोई आइटम नहीं।', hinglish: 'Abhi koi item nahi.' },
  itemName:       { en: 'Item Name', hi: 'आइटम नाम', hinglish: 'Item Name' },
  itemCode:       { en: 'Item Code', hi: 'आइटम कोड', hinglish: 'Item Code' },
  salesQty:       { en: 'Sales Quantity', hi: 'बिक्री मात्रा', hinglish: 'Sales Quantity' },
  salesAmount:    { en: 'Sales Amount', hi: 'बिक्री राशि', hinglish: 'Sales Amount' },
  purchaseQty:    { en: 'Purchase Quantity', hi: 'खरीद मात्रा', hinglish: 'Purchase Quantity' },
  purchaseAmount: { en: 'Purchase Amount', hi: 'खरीद राशि', hinglish: 'Purchase Amount' },
  total:          { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  // Misc
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  save:     { en: 'Save', hi: 'सेव', hinglish: 'Save' },
  cancel:   { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel' },
  adding:   { en: 'Saving…', hi: '…', hinglish: 'Saving…' },
  nameReq:  { en: 'Name is required', hi: 'नाम जरूरी है', hinglish: 'Naam required' },
  addCustomer: { en: 'New Customer', hi: 'नया ग्राहक', hinglish: 'Naya Customer' },
  addSupplier: { en: 'New Supplier', hi: 'नया आपूर्तिकर्ता', hinglish: 'Naya Supplier' },
  back:     { en: 'Back', hi: 'वापस', hinglish: 'Back' },
  // ── Create Party form ──
  createParty:  { en: 'Create Party', hi: 'पार्टी बनाएं', hinglish: 'Create Party' },
  editParty:    { en: 'Edit Party', hi: 'पार्टी संपादित करें', hinglish: 'Party Edit karein' },
  editDetails:  { en: 'Edit details', hi: 'विवरण बदलें', hinglish: 'Edit details' },
  partySaved:   { en: 'Party updated', hi: 'पार्टी अपडेट हुई', hinglish: 'Party update hui' },
  getDetails:   { en: 'Get Details', hi: 'विवरण लाएं', hinglish: 'Get Details' },
  fetching:     { en: 'Fetching…', hi: 'ला रहे हैं…', hinglish: 'Fetching…' },
  generalDetails:{ en: 'General Details', hi: 'सामान्य विवरण', hinglish: 'General Details' },
  partyName:    { en: 'Party Name', hi: 'पार्टी का नाम', hinglish: 'Party Name' },
  mobile:       { en: 'Mobile Number', hi: 'मोबाइल नंबर', hinglish: 'Mobile Number' },
  openingBalance:{ en: 'Opening Balance', hi: 'शुरुआती बैलेंस', hinglish: 'Opening Balance' },
  toCollect:    { en: 'To Collect', hi: 'लेने हैं', hinglish: 'To Collect' },
  toPay:        { en: 'To Pay', hi: 'देने हैं', hinglish: 'To Pay' },
  gstin:        { en: 'GSTIN', hi: 'GSTIN', hinglish: 'GSTIN' },
  panNumber:    { en: 'PAN Number', hi: 'पैन नंबर', hinglish: 'PAN Number' },
  category:     { en: 'Party Category', hi: 'पार्टी श्रेणी', hinglish: 'Party Category' },
  accountGroup: { en: 'Account Group', hi: 'खाता समूह', hinglish: 'Account Group' },
  groupHint:    {
    en: 'Decides where this party sits on the Balance Sheet. Leave as Sundry Debtors/Creditors for ordinary customers and suppliers.',
    hi: 'यह तय करता है कि पार्टी बैलेंस शीट में कहाँ दिखेगी।',
    hinglish: 'Yeh decide karta hai ki party Balance Sheet mein kahan dikhegi.',
  },
  categoryHint: { en: 'e.g. Wholesale, Retail, Corporate', hi: 'जैसे थोक, खुदरा', hinglish: 'e.g. Wholesale, Retail' },
  addressSec:   { en: 'Address', hi: 'पता', hinglish: 'Address' },
  billingAddress:{ en: 'Billing Address', hi: 'बिलिंग पता', hinglish: 'Billing Address' },
  shippingAddress:{ en: 'Shipping Address', hi: 'शिपिंग पता', hinglish: 'Shipping Address' },
  sameAsBilling:{ en: 'Same as billing address', hi: 'बिलिंग पते जैसा', hinglish: 'Same as billing address' },
  creditPeriod: { en: 'Credit Period', hi: 'क्रेडिट अवधि', hinglish: 'Credit Period' },
  days:         { en: 'Days', hi: 'दिन', hinglish: 'Days' },
  creditLimit:  { en: 'Credit Limit', hi: 'क्रेडिट सीमा', hinglish: 'Credit Limit' },
  contactSec:   { en: 'Contact Person Details', hi: 'संपर्क व्यक्ति', hinglish: 'Contact Person Details' },
  contactName:  { en: 'Contact Person Name', hi: 'संपर्क व्यक्ति का नाम', hinglish: 'Contact Person Name' },
  dob:          { en: 'Date of Birth', hi: 'जन्म तिथि', hinglish: 'Date of Birth' },
  bankSec:      { en: 'Party Bank Account', hi: 'पार्टी बैंक खाता', hinglish: 'Party Bank Account' },
  bankHint:     { en: 'Add party bank information to manage transactions', hi: 'लेन-देन के लिए बैंक जानकारी जोड़ें', hinglish: 'Bank info add karein' },
  addBank:      { en: '+ Add Bank Account', hi: '+ बैंक खाता जोड़ें', hinglish: '+ Add Bank Account' },
  holderName:   { en: 'Account Holder Name', hi: 'खाताधारक का नाम', hinglish: 'Account Holder Name' },
  accountNumber:{ en: 'Account Number', hi: 'खाता संख्या', hinglish: 'Account Number' },
  ifsc:         { en: 'IFSC Code', hi: 'IFSC कोड', hinglish: 'IFSC Code' },
  bankName:     { en: 'Bank Name', hi: 'बैंक का नाम', hinglish: 'Bank Name' },
  branch:       { en: 'Branch', hi: 'शाखा', hinglish: 'Branch' },
  customSec:    { en: 'Custom Field', hi: 'कस्टम फ़ील्ड', hinglish: 'Custom Field' },
  customHint:   { en: 'Store more information about your parties by adding custom fields', hi: 'अतिरिक्त जानकारी के लिए कस्टम फ़ील्ड जोड़ें', hinglish: 'Extra info ke liye custom fields add karein' },
  addCustom:    { en: '+ Add Custom Field', hi: '+ कस्टम फ़ील्ड जोड़ें', hinglish: '+ Add Custom Field' },
  fieldName:    { en: 'Field Name', hi: 'फ़ील्ड नाम', hinglish: 'Field Name' },
  fieldValue:   { en: 'Field Value', hi: 'फ़ील्ड मान', hinglish: 'Field Value' },
  saveAndNew:   { en: 'Save & New', hi: 'सेव और नया', hinglish: 'Save & New' },
  remove:       { en: 'Remove', hi: 'हटाएं', hinglish: 'Remove' },
  stateFromGst: { en: 'State', hi: 'राज्य', hinglish: 'State' },
  savedNew:     { en: 'Saved — add the next one', hi: 'सेव हुआ — अगला जोड़ें', hinglish: 'Save hua — agla add karein' },
};

const isoDate = (d) => d.toISOString().slice(0, 10);
const fyStartDate = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };

const partyName = (p) => p.name || p.company || p.title || '—';
const partyPhone = (p) => p.phone || p.mobile || p.contact || p.email || '';
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Status pill colours, keyed by the label the API returns.
const STATUS_STYLE = {
  'Paid':         { bg: 'rgba(16,185,129,.14)', fg: 'var(--green, #059669)' },
  'Partial Paid': { bg: 'rgba(245,158,11,.16)', fg: 'var(--amber, #B45309)' },
  'Unpaid':       { bg: 'rgba(239,68,68,.14)',  fg: 'var(--red, #DC2626)' },
};

export default function PartiesPage() {
  const t = useT(S);
  const [clients, setClients] = useState({});
  const [vendors, setVendors] = useState({});
  const [pos, setPos] = useState({});
  const [clientLedger, setClientLedger] = useState([]);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);        // { type, id, name }
  const [partyForm, setPartyForm] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    const a = onValue(ref(db, 'mpw/clients'), (s) => setClients(s.val() || {}));
    const b = onValue(ref(db, 'mpw/vendors'), (s) => setVendors(s.val() || {}));
    const c = onValue(ref(db, 'mpw/purchaseOrders'), (s) => setPos(s.val() || {}));
    accountingApi.ledger().then(setClientLedger).catch(() => setClientLedger([]));
    return () => { a(); b(); c(); };
  }, []);

  const clientOut = useMemo(() => {
    const m = {};
    clientLedger.forEach((r) => { if (r.clientId) m[r.clientId] = r.outstanding; });
    return m;
  }, [clientLedger]);

  const vendorOut = useMemo(() => {
    const m = {};
    Object.entries(pos).forEach(([, p]) => {
      if (String(p.status || '').toLowerCase() !== 'received') return;
      const key = p.vendorId || p.vendorName || '';
      if (key) m[key] = round2((m[key] || 0) + (p.total || 0));
    });
    return m;
  }, [pos]);

  const customerRows = useMemo(() => Object.entries(clients)
    .map(([id, c]) => ({ id, type: 'client', name: partyName(c), phone: partyPhone(c), gstNo: c.gstNo || c.gstin || '', balance: clientOut[id] || 0 }))
    .filter((r) => r.name !== '—')
    .sort((a, b) => a.name.localeCompare(b.name)), [clients, clientOut]);

  const supplierRows = useMemo(() => Object.entries(vendors)
    .map(([id, v]) => ({ id, type: 'vendor', name: partyName(v), phone: partyPhone(v), gstNo: v.gstNo || v.gstin || '', balance: vendorOut[id] || vendorOut[v.name] || 0 }))
    .filter((r) => r.name !== '—')
    .sort((a, b) => a.name.localeCompare(b.name)), [vendors, vendorOut]);

  const rows = tab === 'customers' ? customerRows : tab === 'suppliers' ? supplierRows : [...customerRows, ...supplierRows];

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(s) || r.phone.toLowerCase().includes(s) || r.gstNo.toLowerCase().includes(s));
  }, [rows, q]);

  // Creating a party drops you straight into its detail pane — the whole point
  // of the request: "after creating any party it should show its details".
  const onPartyCreated = (created, type) => {
    setPartyForm(null);
    setSel({ id: created.id, type, name: created.name });
    setTab(type === 'client' ? 'customers' : 'suppliers');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex" style={{ gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setPartyForm({ type: 'client' })}>{t('newCustomer')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPartyForm({ type: 'vendor' })}>{t('newSupplier')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport((v) => !v)}>{t('importExcel')}</button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{t('importExcel')}</h3>
            <button className="btn btn-xs btn-ghost" onClick={() => setShowImport(false)}>✕</button>
          </div>
          <PartyBulkUpload onImported={() => setShowImport(false)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }} className="parties-split">
        {/* ── Left rail: party list ─────────────────────────────────────── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', display: sel ? undefined : undefined }}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <input className="input" style={{ width: '100%' }} placeholder={'🔍  ' + t('searchParty')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {['all', 'customers', 'suppliers'].map((k) => (
                <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
                  style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
            {!filtered.length && <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)', fontSize: 13 }}>{t('none')}</div>}
            {filtered.map((r) => {
              const active = sel && sel.id === r.id && sel.type === r.type;
              const owes = r.balance > 0;
              return (
                <button key={r.type + r.id} type="button" onClick={() => setSel(r)}
                  style={{
                    display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: active ? 'var(--surface2)' : 'none',
                    borderLeft: active ? '3px solid var(--blue, #C05621)' : '3px solid transparent',
                  }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{r.type === 'client' ? t('customer') : t('supplier')}</span>
                  </span>
                  <span style={{ whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700, color: owes ? (r.type === 'client' ? 'var(--green, #059669)' : 'var(--red, #DC2626)') : 'var(--text3)' }}>
                    {inr(r.balance)} {owes ? (r.type === 'client' ? '↓' : '↑') : '↑'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: party detail ───────────────────────────────────────── */}
        {sel
          ? <PartyDetail key={sel.type + sel.id} party={sel} t={t} onBack={() => setSel(null)} />
          : (
            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              👈 {t('pickOne')}
            </div>
          )}
      </div>

      {partyForm && <PartyFormModal type={partyForm.type} t={t} onClose={() => setPartyForm(null)} onCreated={onPartyCreated} />}
    </div>
  );
}

/* ─────────────────────────── Party detail pane ─────────────────────────── */

function PartyDetail({ party, t, onBack }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('txns');
  const [invoiceFor, setInvoiceFor] = useState(null);
  const [editingParty, setEditingParty] = useState(null);
  const [paying, setPaying] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  // Advance held by this party, surfaced so an unapplied receipt is visible
  // rather than just quietly lowering the balance.
  const advance = useMemo(
    () => round2((data?.transactions || []).reduce((s, r) => s + (Number(r.onAccount) || 0), 0)),
    [data]
  );

  // NOTE: `t` is a fresh reference on every render (useT), so it must never be a
  // dependency here — that turns this into an infinite fetch loop.
  const load = () => {
    setErr('');
    accountingApi.party(party.id, party.type)
      .then(setData)
      .catch((e) => { setData(null); setErr(describeError(e, t('failed'))); });
  };
  useEffect(load, [party.id, party.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = data?.party;
  const sum = data?.summary;
  const isClient = party.type === 'client';
  const balance = sum ? sum.outstanding : 0;

  const remind = () => {
    const phone = String(p?.phone || '').replace(/\D/g, '');
    const due = inr(balance);
    const msg = `Hello ${p?.name || ''}, a gentle reminder: ${due} is outstanding on your account. Please arrange the payment. Thank you.`;
    const url = phone
      ? `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`
      : null;
    if (!url) return showToast('No phone number on this party', 'error');
    window.open(url, '_blank', 'noopener');
  };

  const TABS = [
    ['txns', '📄 ' + t('tabTxns')],
    ['profile', '👤 ' + t('tabProfile')],
    ['ledger', '📊 ' + t('tabLedger')],
    ['items', '🧾 ' + t('tabItems')],
  ];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap' }}>
          <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={onBack} title={t('back')} style={{ padding: '2px 8px' }}>←</button>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p?.name || party.name}
            </h3>
          </div>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            {isClient && balance > 0 && (
              <button className="btn btn-sm" onClick={remind}
                style={{ background: 'rgba(16,185,129,.12)', color: 'var(--green, #059669)', border: '1px solid rgba(16,185,129,.35)' }}>
                💬 {t('sendReminder')}
              </button>
            )}
            <button className="btn btn-sm" onClick={() => setPaying(true)}
              style={{ background: 'rgba(37,99,235,.12)', color: 'var(--blue, #2563EB)', border: '1px solid rgba(37,99,235,.35)' }}>
              💰 {isClient ? t('paymentIn') : t('paymentOut')}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEditingParty(p)}>
              ✏️ {t('editDetails')}
            </button>
            {isClient ? (
              <button className="btn btn-primary btn-sm" onClick={() => setInvoiceFor(p)}>
                🧾 {t('createInvoice')}
              </button>
            ) : (
              // A supplier gets a PURCHASE, not a sales invoice — you don't
              // invoice the people you buy from. The button was simply absent
              // before, which read as a missing feature rather than a
              // deliberate distinction.
              <button className="btn btn-primary btn-sm" onClick={() => setPurchasing(true)}>
                📦 {t('createPurchase')}
              </button>
            )}
          </div>
        </div>

        {/* Summary tiles */}
        {sum && (
          <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
            <Tile
              label={balance > 0 ? (isClient ? t('receivable') : t('payable')) : t('settled')}
              value={inr(Math.abs(balance))}
              color={balance > 0 ? (isClient ? 'var(--green, #059669)' : 'var(--red, #DC2626)') : 'var(--text2)'}
            />
            <Tile label={isClient ? t('totalSales') : t('totalPurchased')} value={inr(isClient ? sum.invoiced : sum.purchased)} />
            <Tile label={isClient ? t('totalPaid') : t('totalExpensed')} value={inr(isClient ? sum.paid : sum.expensed)} />
            {isClient && advance > 0 && (
              <Tile label={t('onAccountTile')} value={inr(advance)} color="var(--blue, #2563EB)" />
            )}
            {isClient && sum.credited > 0 && <Tile label="Credit Notes" value={inr(sum.credited)} />}
            {isClient && sum.debited > 0 && <Tile label="Debit Notes" value={inr(sum.debited)} />}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex" style={{ gap: 2, borderBottom: '1px solid var(--border)', padding: '0 8px', overflowX: 'auto' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '11px 12px', fontSize: 13,
              whiteSpace: 'nowrap',
              fontWeight: tab === k ? 700 : 500,
              color: tab === k ? 'var(--blue, #C05621)' : 'var(--text2)',
              borderBottom: tab === k ? '2px solid var(--blue, #C05621)' : '2px solid transparent',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 14 }}>
        {err && <div style={{ color: 'var(--red)', fontSize: 13, padding: 10 }}>{err}</div>}
        {!data && !err && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 24 }}>{t('loading')}</div>}
        {data && tab === 'txns' && <TransactionsTab rows={data.transactions} t={t} />}
        {data && tab === 'profile' && <ProfileTab p={p} t={t} />}
        {data && tab === 'ledger' && (
          <LedgerTab
            party={party} t={t}
            feed={data.transactions}
            openingBalance={p && p.openingBalanceType === 'to_pay'
              ? -round2(p.openingBalance || 0)
              : round2((p && p.openingBalance) || 0)}
          />
        )}
        {data && tab === 'items' && <ItemsTab party={party} t={t} />}
      </div>

      {purchasing && p && (
        <CreatePurchaseFlow
          vendor={{
            id: p.id, name: p.name, phone: p.phone,
            address: p.billingAddress || p.address, gstNo: p.gstNo,
          }}
          onClose={() => { setPurchasing(false); load(); }}
        />
      )}
      {paying && (
        <PartyPaymentModal
          t={t} party={party} isClient={isClient}
          outstanding={sum ? sum.outstanding : 0}
          unpaidInvoices={(data.transactions || []).filter((r) => r.unpaid > 0)}
          onClose={() => setPaying(false)}
          onDone={() => { setPaying(false); load(); }}
        />
      )}
      {editingParty && (
        <PartyFormModal
          t={t}
          type={editingParty.type === 'vendor' ? 'vendor' : 'client'}
          party={editingParty}
          onClose={() => setEditingParty(null)}
          onCreated={() => { setEditingParty(null); load(); }}
        />
      )}
      {invoiceFor && (
        <CreateInvoiceFlow
          party={invoiceFor}
          onClose={() => setInvoiceFor(null)}
          onCreated={() => { setInvoiceFor(null); load(); }}
        />
      )}
    </div>
  );
}

function Tile({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: .3, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

/* ───────────────────────────── Transactions ───────────────────────────── */

// Financial year starts 1 April in India.
function fyStart(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-04-01`;
}
function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return [iso(from), iso(to)];
}

// Which feed rows lead somewhere. Only the `invoices` collection has a
// single-document view (/invoice-view deep-links by id) — payments, notes,
// purchases and expenses have list pages but no per-record page, so their rows
// stay static rather than becoming links that go nowhere. A row that looks
// clickable and does nothing is worse than one that never invited the click.
export const canOpenTxn = (r) => !!r && r.collectionName === 'invoices' && !!r.id;

// Exported for the regression test — clicking a bill here was dead, and a
// source-level check could not tell a live handler from a commented-out one.
export function TransactionsTab({ rows, t }) {
  const navigate = useNavigate();
  const [range, setRange] = useState('all');
  const [docType, setDocType] = useState('all');
  const [status, setStatus] = useState('all');

  // The full standard list, in the order a shopkeeper thinks about them, with a
  // count beside each. Types the party has no history of are shown DISABLED
  // rather than hidden: "Payment Out (0)" answers "did I pay them?" in one
  // glance, where a missing option leaves you wondering if the filter is broken.
  const typeOptions = useMemo(() => {
    const counts = new Map();
    rows.forEach((r) => counts.set(r.docType, (counts.get(r.docType) || 0) + 1));
    return [
      ['invoice', 'Sales'],
      ['purchase_order', 'Purchase'],
      ['payment_in', 'Payment In'],
      ['payment_out', 'Payment Out'],
      ['proforma', 'Quotation'],
      ['credit_note', 'Sales Return / Credit Note'],
      ['debit_note', 'Debit Note'],
      ['cash', 'Cash Bill'],
      ['expense', 'Expense'],
    ].map(([k, label]) => ({ key: k, label, count: counts.get(k) || 0 }));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const seen = new Set();
    rows.forEach((r) => { if (r.status) seen.add(r.status); });
    return [...seen];
  }, [rows]);

  const filtered = useMemo(() => {
    let from = null; let to = null;
    if (range === 'thisMonth') [from, to] = monthRange(0);
    else if (range === 'lastMonth') [from, to] = monthRange(-1);
    else if (range === 'thisFy') { from = fyStart(); to = null; }
    return rows.filter((r) => {
      if (docType !== 'all' && r.docType !== docType) return false;
      if (status !== 'all' && r.status !== status) return false;
      if (from && (!r.date || r.date < from)) return false;
      if (to && (!r.date || r.date > to)) return false;
      return true;
    });
  }, [rows, range, docType, status]);

  const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const COLS = '110px minmax(120px, 1fr) minmax(140px, 1.2fr) minmax(120px, 1fr) 120px';

  return (
    <>
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select style={sel} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="all">📅 {t('allTime')}</option>
          <option value="thisMonth">{t('thisMonth')}</option>
          <option value="lastMonth">{t('lastMonth')}</option>
          <option value="thisFy">{t('thisFy')}</option>
        </select>
        <select style={sel} value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="all">{t('txnType')}</option>
          {typeOptions.map((o) => (
            <option key={o.key} value={o.key} disabled={!o.count}>
              {o.label}{o.count ? ` (${o.count})` : ' (0)'}
            </option>
          ))}
        </select>
        <select style={sel} value={status} onChange={(e) => setStatus(e.target.value)} disabled={!statusOptions.length}>
          <option value="all">{t('status')}</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 660 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            <div>{t('date')}</div><div>{t('type')}</div><div>{t('number')}</div>
            <div style={{ textAlign: 'right' }}>{t('amount')}</div><div>{t('statusCol')}</div>
          </div>
          {!filtered.length && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('noTxns')}</div>}
          {filtered.map((r) => {
            const st = r.status ? STATUS_STYLE[r.status] : null;
            const openable = canOpenTxn(r);
            const open = () => navigate(`/invoice-view?id=${encodeURIComponent(r.id)}`);
            return (
              <div
                key={r.collectionName + r.id}
                {...(openable ? {
                  role: 'button',
                  tabIndex: 0,
                  title: `Open ${r.number || 'invoice'}`,
                  onClick: open,
                  // Reachable without a mouse: the row is the control, so it
                  // has to answer Enter and Space like a button would.
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                  },
                } : {})}
                style={{
                  display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px',
                  borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center',
                  cursor: openable ? 'pointer' : 'default',
                }}
                onMouseEnter={openable ? (e) => { e.currentTarget.style.background = 'var(--surface2)'; } : undefined}
                onMouseLeave={openable ? (e) => { e.currentTarget.style.background = 'transparent'; } : undefined}
              >
                <div style={{ color: 'var(--text2)' }}>{fmtDate(r.date)}</div>
                <div style={{ fontWeight: 600 }}>
                  {r.label}
                  {r.mode && <span style={{ color: 'var(--text3)', fontWeight: 400 }}> · {r.mode}</span>}
                </div>
                <div style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={openable ? { color: 'var(--primary, #2563EB)', fontWeight: 600 } : undefined}>
                    {r.number || '—'}
                  </span>
                  {r.againstInvoiceNo && r.number !== r.againstInvoiceNo && (
                    <span style={{ color: 'var(--text3)' }}> ({r.againstInvoiceNo})</span>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700 }}>
                  {inr(r.amount)}
                  {r.unpaid > 0 && (
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--red, #DC2626)' }}>
                      ({inr(r.unpaid)} {t('unpaid')})
                    </span>
                  )}
                </div>
                <div>
                  {r.status && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st ? st.bg : 'var(--surface2)', color: st ? st.fg : 'var(--text2)' }}>
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────── Profile ─────────────────────────────── */

function ProfileTab({ p, t }) {
  if (!p) return null;
  const openingBal = p.openingBalance
    ? `${inr(p.openingBalance)}${p.openingBalanceType ? ` · ${p.openingBalanceType === 'to_pay' ? t('toPay') : t('toCollect')}` : ''}`
    : null;
  const groups = [
    [t('generalDetails'), [
      [t('partyName'), p.name],
      [t('partyType'), p.type === 'client' ? t('customer') : t('supplier')],
      [t('category'), p.category],
      [t('accountGroup'), p.accountGroup ? p.accountGroup.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()) : null],
      [t('mobile'), p.phone],
      [t('email'), p.email],
      [t('gstin'), p.gstNo],
      [t('stateFromGst'), p.gstState],
      [t('panNumber'), p.pan],
      [t('openingBalance'), openingBal],
      [t('createdOn'), p.createdAt ? fmtDate(p.createdAt) : null],
    ]],
    [t('addressSec'), [
      [t('billingAddress'), p.billingAddress],
      [t('shippingAddress'), p.shippingAddress],
      [t('creditPeriod'), p.creditPeriodDays != null ? `${p.creditPeriodDays} ${t('days')}` : null],
      [t('creditLimit'), p.creditLimit != null ? inr(p.creditLimit) : null],
    ]],
    [t('contactSec'), [
      [t('contactName'), p.contactPersonName],
      [t('dob'), p.dateOfBirth ? fmtDate(p.dateOfBirth) : null],
    ]],
  ];

  const Field = ({ label, val }) => (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .3 }}>{label}</div>
      <div style={{ fontSize: 13.5, marginTop: 3, color: val ? 'var(--text)' : 'var(--text3)', whiteSpace: 'pre-wrap' }}>{val || t('notField')}</div>
    </div>
  );

  return (
    <div>
      {groups.map(([title, fields], gi) => (
        <div key={title} style={gi ? { borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 16 } : undefined}>
          <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text2)' }}>{title}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {fields.map(([label, val]) => <Field key={label} label={label} val={val} />)}
          </div>
        </div>
      ))}

      {!!(p.bankAccounts || []).length && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 16 }}>
          <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text2)' }}>{t('bankSec')}</h4>
          {p.bankAccounts.map((b, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Field label={t('holderName')} val={b.holderName} />
              <Field label={t('accountNumber')} val={b.accountNumber} />
              <Field label={t('ifsc')} val={b.ifsc} />
              <Field label={t('bankName')} val={b.bankName} />
              <Field label={t('branch')} val={b.branch} />
            </div>
          ))}
        </div>
      )}

      {!!(p.customFields || []).length && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 16 }}>
          <h4 style={{ fontSize: 12.5, fontWeight: 700, margin: '0 0 10px', color: 'var(--text2)' }}>{t('customSec')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {p.customFields.map((c, i) => <Field key={i} label={c.name} val={c.value} />)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Ledger (double entry) ──────────────────────── */

function LedgerTab({ party, t, feed, openingBalance }) {
  const [range, setRange] = useState('all');

  // Built from the DOCUMENT feed rather than the journal, because a customer
  // statement has to show voucher numbers and payment modes — a journal line
  // knows only which account it hit. The double-entry view of the same facts is
  // the Reports > Ledger page; this is what you hand a customer who asks
  // "what do I owe you?".
  const isClient = party.type !== 'vendor';

  const rows = useMemo(() => {
    let from = null;
    if (range === 'thisMonth') { const d = new Date(); from = isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); }
    else if (range === 'thisFy') from = fyStartDate();
    else if (range === 'last365') { const d = new Date(); d.setDate(d.getDate() - 365); from = isoDate(d); }

    // Oldest first — a running balance only reads correctly forwards.
    const list = [...(feed || [])]
      .filter((r) => !from || (r.date && r.date >= from))
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

    // For a customer an invoice or debit note DEBITS them (they owe more) and a
    // receipt or credit note CREDITS them. A supplier is the mirror.
    const debitTypes = isClient ? ['invoice', 'cash', 'debit_note'] : ['payment_in', 'expense'];
    const today = isoDate(new Date());

    let balance = round2(openingBalance || 0);
    const out = list.map((r) => {
      const isDebit = debitTypes.includes(r.docType);
      const amt = round2(r.amount || 0);
      balance = round2(balance + (isDebit ? amt : -amt));
      const overdueBy = r.dueDate && r.unpaid > 0 && r.dueDate < today
        ? Math.floor((new Date(today) - new Date(r.dueDate)) / 86400000)
        : 0;
      return { ...r, debit: isDebit ? amt : 0, credit: isDebit ? 0 : amt, balance, overdueBy };
    });
    return { list: out, closing: balance };
  }, [feed, range, openingBalance, isClient]);

  const totals = useMemo(() => ({
    invoiced: round2(rows.list.filter((r) => ['invoice', 'cash'].includes(r.docType)).reduce((s, r) => s + r.amount, 0)),
    received: round2(rows.list.filter((r) => r.docType === 'payment_in').reduce((s, r) => s + r.amount, 0)),
    overdue: round2(rows.list.reduce((s, r) => s + (r.overdueBy > 0 ? r.unpaid : 0), 0)),
    receivable: round2(Math.max(0, rows.closing)),
  }), [rows]);

  // The exact grid handed to the export helpers, so what downloads is what is on
  // screen rather than a second implementation that can drift from it.
  const grid = useMemo(() => ({
    headers: [t('date'), t('voucher'), t('vchNo'), t('mode'), t('debit'), t('credit'), t('balance'), t('dueDate')],
    rows: [
      ['', t('openingBalance'), '', '', '', '', inr(openingBalance || 0), ''],
      ...rows.list.map((r) => [
        fmtDate(r.date), r.label, r.number || '', r.mode || '',
        r.debit ? inr(r.debit) : '', r.credit ? inr(r.credit) : '', inr(r.balance),
        r.dueDate ? (r.overdueBy > 0 ? `${fmtDate(r.dueDate)} (${r.overdueBy}d overdue)` : fmtDate(r.dueDate)) : '',
      ]),
      ['', t('closingBalance'), '', '', '', '', inr(rows.closing), ''],
    ],
  }), [rows, openingBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileBase = `statement-${String(party.name || 'party').replace(/[^a-zA-Z0-9]+/g, '-')}`;
  const docTitle = `${t('statement')} - ${party.name || ''}`;
  const sel = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const COLS = '95px minmax(110px, 1fr) minmax(120px, 1fr) 90px 105px 105px 115px 130px';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 14 }}>
        <Tile
          label={isClient ? t('totalReceivable') : t('totalPayable')}
          value={inr(totals.receivable)}
          color={totals.receivable > 0 ? (isClient ? 'var(--green, #059669)' : 'var(--red, #DC2626)') : 'var(--text2)'}
        />
        <Tile label={t('overdueAmount')} value={inr(totals.overdue)}
          color={totals.overdue > 0 ? 'var(--red, #DC2626)' : 'var(--text2)'} />
        <Tile label={t('totalInvoiced')} value={inr(totals.invoiced)} />
        <Tile label={t('totalReceived')} value={inr(totals.received)} />
      </div>

      <div className="flex items-center" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select style={sel} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="all">{t('allTime')}</option>
          <option value="last365">{t('last365')}</option>
          <option value="thisMonth">{t('thisMonth')}</option>
          <option value="thisFy">{t('thisFy')}</option>
        </select>
        <div className="flex" style={{ gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadCsv(`${fileBase}.csv`, grid)}>CSV</button>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadExcel(`${fileBase}.xlsx`, grid)}>Excel</button>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadPdf(docTitle, grid, `${fileBase}.pdf`)}>PDF</button>
          <button className="btn btn-xs btn-ghost" onClick={() => printReport(docTitle, grid)}>🖨 {t('print')}</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
            <div>{t('date')}</div><div>{t('voucher')}</div><div>{t('vchNo')}</div><div>{t('mode')}</div>
            <div style={{ textAlign: 'right' }}>{t('debit')}</div>
            <div style={{ textAlign: 'right' }}>{t('credit')}</div>
            <div style={{ textAlign: 'right' }}>{t('balance')}</div>
            <div>{t('dueDate')}</div>
          </div>

          <StatementRow cols={COLS} bold muted
            cells={['', t('openingBalance'), '', '', '', '', inr(openingBalance || 0), '']} />

          {!rows.list.length && (
            <div style={{ padding: 26, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('empty')}</div>
          )}

          {rows.list.map((r) => (
            <div key={r.collectionName + r.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
              <div style={{ color: 'var(--text2)' }}>{fmtDate(r.date)}</div>
              <div style={{ fontWeight: 600 }}>{r.label}</div>
              <div style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.number || '—'}</div>
              <div style={{ color: 'var(--text3)' }}>{r.mode || ''}</div>
              <div style={{ textAlign: 'right', fontWeight: r.debit ? 600 : 400 }}>{r.debit ? inr(r.debit) : ''}</div>
              <div style={{ textAlign: 'right', fontWeight: r.credit ? 600 : 400, color: r.credit ? 'var(--green, #059669)' : undefined }}>{r.credit ? inr(r.credit) : ''}</div>
              <div style={{ textAlign: 'right', fontWeight: 700 }}>{inr(r.balance)}</div>
              <div style={{ fontSize: 11.5 }}>
                {r.dueDate && (r.overdueBy > 0
                  ? <span style={{ color: 'var(--red, #DC2626)' }}>{fmtDate(r.dueDate)} · {r.overdueBy}d {t('overdue')}</span>
                  : <span style={{ color: 'var(--text3)' }}>{fmtDate(r.dueDate)}</span>)}
              </div>
            </div>
          ))}

          <StatementRow cols={COLS} bold
            cells={['', t('closingBalance'), '', '', '', '', inr(rows.closing), '']} />
        </div>
      </div>
    </div>
  );
}

// Opening / Closing lines, rendered from the same plain arrays the export grid
// uses so the two cannot drift apart.
function StatementRow({ cells, cols, bold, muted }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 10px',
      borderBottom: '1px solid var(--border)', fontSize: 12.5,
      fontWeight: bold ? 700 : 400,
      background: muted ? 'var(--surface2)' : undefined,
    }}>
      {cells.map((c, i) => (
        <div key={i} style={{ textAlign: i >= 4 && i <= 6 ? 'right' : 'left' }}>{c}</div>
      ))}
    </div>
  );
}

/* ───────────────────────────── Item wise ─────────────────────────────── */

function ItemsTab({ party, t }) {
  const [range, setRange] = useState('last365');
  const [data, setData] = useState(null);

  // Fetched per range rather than filtered client-side: the totals have to be
  // aggregated over the documents in that window, and doing it on the server
  // keeps this report agreeing with every other figure on the page.
  // `t` is a fresh reference each render (useT) and must never be a dependency.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    const params = {};
    if (range === 'last365') { const d = new Date(); d.setDate(d.getDate() - 365); params.from = isoDate(d); }
    else if (range === 'thisMonth') { const d = new Date(); params.from = isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); }
    else if (range === 'thisFy') params.from = fyStartDate();
    accountingApi.partyItems(party.id, params)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData({ items: [], totals: {} }); });
    return () => { cancelled = true; };
  }, [party.id, range]);

  const qty = (n, unit) => (n ? `${n} ${unit || 'PCS'}` : '-');
  const amt = (n) => (n ? inr(n) : '-');

  const grid = useMemo(() => ({
    headers: [t('itemName'), t('itemCode'), t('salesQty'), t('salesAmount'), t('purchaseQty'), t('purchaseAmount')],
    rows: [
      ...((data && data.items) || []).map((r) => [
        r.name, r.sku || '-',
        qty(r.salesQty, r.unit), amt(r.salesAmount),
        qty(r.purchaseQty, r.unit), amt(r.purchaseAmount),
      ]),
      ...(data && data.items && data.items.length ? [[
        t('total'), '',
        qty(data.totals.salesQty, ''), amt(data.totals.salesAmount),
        qty(data.totals.purchaseQty, ''), amt(data.totals.purchaseAmount),
      ]] : []),
    ],
  }), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const fileBase = `items-${String(party.name || 'party').replace(/[^a-zA-Z0-9]+/g, '-')}`;
  const docTitle = `${t('tabItems')} - ${party.name || ''}`;
  const sel = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const COLS = 'minmax(150px, 1.6fr) 110px 110px 120px 120px 130px';

  return (
    <div>
      <div className="flex items-center" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select style={sel} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="last365">{t('last365')}</option>
          <option value="thisMonth">{t('thisMonth')}</option>
          <option value="thisFy">{t('thisFy')}</option>
          <option value="all">{t('allTime')}</option>
        </select>
        <div className="flex" style={{ gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadCsv(`${fileBase}.csv`, grid)}>CSV</button>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadExcel(`${fileBase}.xlsx`, grid)}>Excel</button>
          <button className="btn btn-xs btn-ghost" onClick={() => downloadPdf(docTitle, grid, `${fileBase}.pdf`)}>PDF</button>
          <button className="btn btn-xs btn-ghost" onClick={() => printReport(docTitle, grid)}>🖨 {t('print')}</button>
        </div>
      </div>

      {!data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('loading')}</div>}
      {data && !data.items.length && <div style={{ color: 'var(--text3)', fontSize: 13, padding: 20 }}>{t('noItems')}</div>}

      {data && !!data.items.length && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 760 }}>
            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
              <div>{t('itemName')}</div><div>{t('itemCode')}</div>
              <div style={{ textAlign: 'right' }}>{t('salesQty')}</div>
              <div style={{ textAlign: 'right' }}>{t('salesAmount')}</div>
              <div style={{ textAlign: 'right' }}>{t('purchaseQty')}</div>
              <div style={{ textAlign: 'right' }}>{t('purchaseAmount')}</div>
            </div>

            {data.items.map((r, i) => (
              <div key={(r.itemId || r.name) + i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
                <div style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.name}
                  {r.lastDate && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>{t('lastOn')} {fmtDate(r.lastDate)}</span>}
                </div>
                <div style={{ color: 'var(--text2)' }}>{r.sku || '-'}</div>
                <div style={{ textAlign: 'right' }}>{qty(r.salesQty, r.unit)}</div>
                <div style={{ textAlign: 'right', fontWeight: r.salesAmount ? 700 : 400 }}>{amt(r.salesAmount)}</div>
                <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{qty(r.purchaseQty, r.unit)}</div>
                <div style={{ textAlign: 'right', fontWeight: r.purchaseAmount ? 700 : 400, color: r.purchaseAmount ? 'var(--amber, #B45309)' : undefined }}>{amt(r.purchaseAmount)}</div>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px', fontSize: 13, fontWeight: 800 }}>
              <div style={{ gridColumn: '1 / 3' }}>{t('total')}</div>
              <div style={{ textAlign: 'right' }}>{data.totals.salesQty || '-'}</div>
              <div style={{ textAlign: 'right' }}>{amt(data.totals.salesAmount)}</div>
              <div style={{ textAlign: 'right' }}>{data.totals.purchaseQty || '-'}</div>
              <div style={{ textAlign: 'right' }}>{amt(data.totals.purchaseAmount)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Add customer / supplier ─────────────────────── */

const BLANK_BANK = { holderName: '', accountNumber: '', ifsc: '', bankName: '', branch: '' };

const blankPartyForm = (type) => ({
  name: '', phone: '', email: '',
  openingBalance: '', openingBalanceType: 'to_collect',
  gstNo: '', pan: '',
  partyType: type,
  accountGroup: type === 'vendor' ? 'sundry_creditors' : 'sundry_debtors',
  category: '',
  billingAddress: '', shippingAddress: '', shippingSameAsBilling: true,
  creditPeriodDays: '', creditLimit: '',
  contactPersonName: '', dateOfBirth: '',
  bankAccounts: [],
  customFields: [],
});

function Section({ title, children, right }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--text2)' }}>{title}</h4>
        {right}
      </div>
      {children}
    </div>
  );
}

const gridCols = (min = 200) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 });

/* ───────────────────────── Record a payment ──────────────────────────── */

// Money arriving against a PARTY rather than one invoice — which is how it
// actually arrives. Shows exactly which bills the amount will clear before it
// is saved, because an allocation the user cannot see is one they cannot check.
function PartyPaymentModal({ t, party, isClient, outstanding, unpaidInvoices, onClose, onDone }) {
  const [form, setForm] = useState({
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    mode: 'Cash',
    // WHICH account the money moved through. Left blank the server files it
    // under Unlinked Transactions rather than guessing a real account.
    bankAccountId: '',
    reference: '',
    invoiceId: '',      // '' = allocate oldest-first
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openInvoices = useMemo(
    () => (unpaidInvoices || []).filter((r) => ['invoice', 'cash'].includes(r.docType)),
    [unpaidInvoices]
  );

  // Oldest first, matching what the server will do — so this preview is a
  // prediction of the real allocation rather than a different guess.
  const candidates = useMemo(() => {
    const list = [...openInvoices].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    return form.invoiceId ? list.filter((r) => r.id === form.invoiceId) : list;
  }, [openInvoices, form.invoiceId]);

  const preview = useMemo(() => {
    let left = round2(Number(form.amount) || 0);
    const hits = [];
    for (const inv of candidates) {
      if (left <= 0) break;
      const applied = round2(Math.min(inv.unpaid, left));
      if (applied <= 0) continue;
      left = round2(left - applied);
      hits.push({ ...inv, applied, clears: applied >= inv.unpaid });
    }
    return { hits, onAccount: left };
  }, [candidates, form.amount]);

  const submit = async (e) => {
    e.preventDefault();
    const amount = round2(Number(form.amount) || 0);
    if (!(amount > 0)) { setError(t('amountGt0')); return; }
    setBusy(true); setError('');
    try {
      const r = await accountingApi.partyPayment(party.id, {
        partyType: party.type === 'vendor' ? 'vendor' : 'client',
        amount, date: form.date, mode: form.mode,
        bankAccountId: form.bankAccountId || undefined,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
        invoiceId: form.invoiceId || undefined,
      });
      const settled = r.allocations.map((a) => a.invoiceNo).filter(Boolean).join(', ');
      showToast(
        `${inr(amount)} recorded`
        + (settled ? ` — ${settled}` : '')
        + (r.onAccount > 0 ? ` · ${inr(r.onAccount)} ${t('onAccount')}` : ''),
        'success'
      );
      onDone();
    } catch (err) {
      setError(describeError(err, t('failed')));
    } finally { setBusy(false); }
  };

  const lbl = { fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form className="card" onSubmit={submit} style={{ width: '100%', maxWidth: 520, padding: 20, maxHeight: '92vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {isClient ? t('paymentIn') : t('paymentOut')}
          </h3>
          <button type="button" className="btn btn-xs btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
          {party.name} · {t('currentDue')}: <b style={{ color: 'var(--text)' }}>{inr(Math.abs(outstanding))}</b>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={lbl}>{isClient ? t('amountRecv') : t('amountPaid')} *</label>
            <input className="input" type="number" step="0.01" autoFocus value={form.amount}
              onChange={(e) => set('amount', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>{t('date')}</label>
            <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>{t('payMode')}</label>
            <select className="input" value={form.mode} onChange={(e) => set('mode', e.target.value)}>
              {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{t('reference')}</label>
            <input className="input" value={form.reference} onChange={(e) => set('reference', e.target.value)} placeholder="UTR / cheque no" />
          </div>
        </div>

        {/* The mode says HOW the money moved; this says WHERE it landed. Both
            are needed before a bank statement can be reconciled. */}
        <BankAccountSelect
          style={{ marginTop: 12, marginBottom: 0 }}
          label={isClient ? 'Received in' : 'Paid from'}
          mode={form.mode}
          value={form.bankAccountId}
          onChange={(v) => set('bankAccountId', v)}
        />

        {isClient && openInvoices.length > 0 && (
          <div className="form-group" style={{ marginTop: 12 }}>
            <label style={lbl}>{t('againstInv')}</label>
            <select className="input" value={form.invoiceId} onChange={(e) => set('invoiceId', e.target.value)}>
              <option value="">{t('oldestFirst')}</option>
              {openInvoices.map((r) => (
                <option key={r.id} value={r.id}>{r.number} — {inr(r.unpaid)} due</option>
              ))}
            </select>
          </div>
        )}

        {/* What the money will actually do, shown before it is saved. */}
        {Number(form.amount) > 0 && (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('willSettle')}</div>
            {preview.hits.length === 0 && (
              <div style={{ color: 'var(--text2)' }}>{inr(preview.onAccount)} {t('onAccount')}</div>
            )}
            {preview.hits.map((h) => (
              <div key={h.id} className="flex items-center justify-between" style={{ padding: '2px 0' }}>
                <span>{h.number}</span>
                <span>
                  {inr(h.applied)}
                  <span style={{ color: h.clears ? 'var(--green, #059669)' : 'var(--amber, #B45309)', marginLeft: 6 }}>
                    {h.clears ? '· cleared' : '· part'}
                  </span>
                </span>
              </div>
            ))}
            {preview.hits.length > 0 && preview.onAccount > 0 && (
              <div style={{ marginTop: 4, color: 'var(--amber, #B45309)' }}>
                + {inr(preview.onAccount)} {t('onAccount')}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 10 }}>{error}</div>}

        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? t('adding') : t('saveReceipt')}
          </button>
        </div>
      </form>
    </div>
  );
}

function PartyFormModal({ type, t, onClose, onCreated, party: editing }) {
  const isEdit = !!editing;
  const [form, setForm] = useState(() => (editing
    ? {
      ...blankPartyForm(editing.type === 'vendor' ? 'vendor' : 'client'),
      name: editing.name || '', phone: editing.phone || '', email: editing.email || '',
      openingBalance: editing.openingBalance != null ? String(editing.openingBalance) : '',
      openingBalanceType: editing.openingBalanceType || 'to_collect',
      gstNo: editing.gstNo || '', pan: editing.pan || '',
      partyType: editing.type === 'vendor' ? 'vendor' : 'client',
      accountGroup: editing.accountGroup || (editing.type === 'vendor' ? 'sundry_creditors' : 'sundry_debtors'),
      category: editing.category || '',
      billingAddress: editing.billingAddress || editing.address || '',
      shippingAddress: editing.shippingAddress || '',
      // Only "same as billing" when they genuinely match — otherwise editing
      // would tick the box and overwrite a real shipping address on save.
      shippingSameAsBilling: !editing.shippingAddress
        || editing.shippingAddress === (editing.billingAddress || editing.address),
      creditPeriodDays: editing.creditPeriodDays ?? '',
      creditLimit: editing.creditLimit ?? '',
      contactPersonName: editing.contactPersonName || '',
      dateOfBirth: editing.dateOfBirth || '',
      bankAccounts: Array.isArray(editing.bankAccounts) ? editing.bankAccounts : [],
      customFields: Array.isArray(editing.customFields) ? editing.customFields : [],
    }
    : blankPartyForm(type)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gstBusy, setGstBusy] = useState(false);
  const [gstNote, setGstNote] = useState(null);
  const [states, setStates] = useState([]);
  const [groups, setGroups] = useState([]);

  // Reuse the invoice module's GST state list rather than duplicating it here.
  // There is no GSTIN lookup service wired up, so instead of a "Get Details"
  // button that can't fetch anything, the state encoded in the GSTIN's first two
  // digits is shown as live confirmation that the number was typed correctly.
  useEffect(() => {
    accountingApi.invoiceDefaults('invoice')
      .then((d) => setStates(d?.states || []))
      .catch(() => setStates([]));
    accountingApi.partyGroups()
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => setGroups([]));
  }, []);
  const stateMap = useMemo(() => Object.fromEntries(states.map((s) => [s.code, s.name])), [states]);
  const gstState = stateMap[String(form.gstNo || '').slice(0, 2)] || null;

  const isClient = form.partyType === 'client';
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Pull the party's details from their GSTIN. Only fills fields that are still
  // EMPTY — a lookup must never overwrite something the user typed, and on an
  // edit it must not quietly replace details they corrected by hand.
  const fetchGstin = async () => {
    setGstBusy(true); setGstNote(null);
    try {
      const r = await accountingApi.gstinLookup(form.gstNo.trim().toUpperCase());
      const d = r.data || {};
      if (r.ok && d._matched === false) {
        // The provider answered, but nothing in its payload looked like a name
        // or an address. Say so and name the fields it DID send — a silent
        // "success" with an empty form is the most confusing outcome possible,
        // and those key names are exactly what's needed to fix the mapping.
        setGstNote({
          ok: false,
          text: `Provider replied but sent no recognisable name or address. Fields received: ${(d._keys || []).join(', ') || 'none'}`,
        });
      } else if (r.ok) {
        setForm((f) => ({
          ...f,
          name: f.name.trim() || d.tradeName || d.legalName || '',
          billingAddress: f.billingAddress.trim() || d.address || '',
          pan: f.pan.trim() || (form.gstNo.slice(2, 12) || ''),
        }));
        setGstNote({
          ok: true,
          text: `${d.tradeName || d.legalName || 'Found'}`
            + (d.status ? ` · ${d.status}` : '')
            + (d.registrationType ? ` · ${d.registrationType}` : '')
            + (d._unmapped && d._unmapped.length ? ` · unused fields: ${d._unmapped.join(', ')}` : ''),
        });
      } else if (!r.configured) {
        // Not an error the user caused — say what's missing and move on.
        setGstNote({ ok: false, text: 'Auto-fetch is not set up yet — enter the details below.' });
      } else {
        setGstNote({ ok: false, text: r.error || 'Could not fetch details.' });
      }
      // The PAN sits inside the GSTIN whether or not a provider answered.
      if (r.valid) setForm((f) => ({ ...f, pan: f.pan.trim() || form.gstNo.slice(2, 12) }));
    } catch (e) {
      setGstNote({ ok: false, text: describeError(e, 'Could not fetch details.') });
    } finally { setGstBusy(false); }
  };

  const setBank = (i, k, v) => setForm((f) => ({
    ...f, bankAccounts: f.bankAccounts.map((b, idx) => (idx === i ? { ...b, [k]: v } : b)),
  }));
  const setCustom = (i, k, v) => setForm((f) => ({
    ...f, customFields: f.customFields.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)),
  }));

  const build = () => {
    const billing = form.billingAddress.trim();
    const shipping = form.shippingSameAsBilling ? billing : form.shippingAddress.trim();
    return {
      partyType: form.partyType, // decides clients vs vendors, server-side
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      openingBalance: round2(Number(form.openingBalance) || 0),
      openingBalanceType: form.openingBalanceType,
      gstNo: form.gstNo.trim().toUpperCase(),
      gstState: gstState || null,
      pan: form.pan.trim().toUpperCase(),
      accountGroup: form.accountGroup,
      category: form.category.trim(),
      // `address` stays the canonical single-line field the invoice form, the
      // party list and every existing screen already read — billingAddress is
      // the new explicit name, kept in sync so nothing downstream breaks.
      address: billing,
      billingAddress: billing,
      shippingAddress: shipping,
      shippingSameAsBilling: !!form.shippingSameAsBilling,
      creditPeriodDays: form.creditPeriodDays === '' ? null : Number(form.creditPeriodDays),
      creditLimit: form.creditLimit === '' ? null : round2(Number(form.creditLimit) || 0),
      contactPersonName: form.contactPersonName.trim(),
      dateOfBirth: form.dateOfBirth || null,
      // Drop rows the user opened but never filled in.
      bankAccounts: form.bankAccounts.filter((b) => b.accountNumber.trim() || b.bankName.trim()),
      customFields: form.customFields.filter((c) => c.name.trim()),
      // status / createdAt / createdBy are stamped server-side.
    };
  };

  const save = async (andNew) => {
    if (!form.name.trim()) { setError(t('nameReq')); return; }
    setSaving(true);
    setError('');
    try {
      const created = isEdit
        ? await accountingApi.updateParty(editing.id, form.partyType, build())
        : await accountingApi.createParty(build());
      if (created && created.groupChangeBlocked) showToast(created.groupChangeBlocked, 'error');
      if (andNew) {
        showToast('✅ ' + t('savedNew'), 'success');
        setForm(blankPartyForm(form.partyType));
      } else {
        showToast('✅ ' + (isEdit ? t('partySaved') : (isClient ? t('addCustomer') : t('addSupplier'))), 'success');
        onCreated(created, form.partyType);
      }
    } catch (err) {
      setError(describeError(err, t('failed')));
    } finally { setSaving(false); }
  };

  const lbl = { fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 16, overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="card" onSubmit={(e) => { e.preventDefault(); save(false); }}
        style={{ width: '100%', maxWidth: 1000, padding: 0, margin: 'auto' }}>

        {/* Sticky header with the actions, like the reference screen */}
        <div className="flex items-center justify-between"
          style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2, flexWrap: 'wrap', gap: 8 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 8px' }}>←</button>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{isEdit ? t('editParty') : t('createParty')}</h3>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('cancel')}</button>
            {!isEdit && (
              <button type="button" className="btn btn-sm" onClick={() => save(true)} disabled={saving}
                style={{ border: '1px solid var(--border)' }}>{t('saveAndNew')}</button>
            )}
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? t('adding') : t('save')}</button>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* ── General Details ── */}
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: 'var(--text2)' }}>{t('generalDetails')}</h4>
          <div style={gridCols()}>
            <div>
              <label style={lbl}>{t('partyName')} *</label>
              <input className="input" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder={isClient ? 'e.g. Sharma Traders' : 'e.g. Jain Paper House'} />
            </div>
            <div>
              <label style={lbl}>{t('mobile')}</label>
              <input className="input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. 98765 43210" />
            </div>
            <div>
              <label style={lbl}>{t('email')}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
            </div>
            <div>
              <label style={lbl}>{t('openingBalance')}</label>
              <div className="flex" style={{ gap: 6 }}>
                <input className="input" type="number" step="0.01" style={{ flex: 1, minWidth: 0 }} value={form.openingBalance}
                  onChange={(e) => set('openingBalance', e.target.value)} placeholder="0" />
                <select className="input" style={{ width: 120 }} value={form.openingBalanceType} onChange={(e) => set('openingBalanceType', e.target.value)}>
                  <option value="to_collect">{t('toCollect')}</option>
                  <option value="to_pay">{t('toPay')}</option>
                </select>
              </div>
            </div>
            <div>
              <label style={lbl}>{t('gstin')}</label>
              <div className="flex" style={{ gap: 6 }}>
                <input className="input" style={{ flex: 1, minWidth: 0 }} value={form.gstNo}
                  onChange={(e) => set('gstNo', e.target.value.toUpperCase())} placeholder="ex. 29XXXXXXXXXXXZX" />
                <button type="button" className="btn btn-sm" style={{ border: '1px solid var(--border)', whiteSpace: 'nowrap' }}
                  onClick={fetchGstin} disabled={gstBusy || form.gstNo.length !== 15}>
                  {gstBusy ? t('fetching') : t('getDetails')}
                </button>
              </div>
              {gstState && <div style={{ fontSize: 11, color: 'var(--green, #059669)', marginTop: 3 }}>✓ {t('stateFromGst')}: {gstState}</div>}
              {gstNote && (
                <div style={{ fontSize: 11, marginTop: 3, color: gstNote.ok ? 'var(--green, #059669)' : 'var(--amber, #B45309)' }}>
                  {gstNote.text}
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>{t('panNumber')}</label>
              <input className="input" value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} placeholder="e.g. AABCU9603R" />
            </div>
            <div>
              <label style={lbl}>{t('partyType')} *</label>
              <select className="input" value={form.partyType} onChange={(e) => {
                const nextType = e.target.value;
                setForm((f) => ({
                  ...f,
                  partyType: nextType,
                  // Only re-default the group if it is still the other type's
                  // default — never clobber a deliberate choice.
                  accountGroup: (f.accountGroup === 'sundry_debtors' || f.accountGroup === 'sundry_creditors')
                    ? (nextType === 'vendor' ? 'sundry_creditors' : 'sundry_debtors')
                    : f.accountGroup,
                }));
              }}>
                <option value="client">{t('customer')}</option>
                <option value="vendor">{t('supplier')}</option>
              </select>
            </div>
            <div>
              <label style={lbl}>{t('accountGroup')} *</label>
              <select className="input" value={form.accountGroup} onChange={(e) => set('accountGroup', e.target.value)}>
                {groups
                  .filter((g) => g.for === 'both' || g.for === form.partyType)
                  .map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{t('groupHint')}</div>
            </div>
            <div>
              <label style={lbl}>{t('category')}</label>
              <input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder={t('categoryHint')} />
            </div>
          </div>

          {/* ── Address ── */}
          <Section title={t('addressSec')}>
            <div style={gridCols(260)}>
              <div>
                <label style={lbl}>{t('billingAddress')}</label>
                <textarea className="input" rows={3} value={form.billingAddress}
                  onChange={(e) => set('billingAddress', e.target.value)} placeholder="Street, city, PIN" />
              </div>
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>{t('shippingAddress')}</label>
                  <label style={{ fontSize: 11.5, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.shippingSameAsBilling}
                      onChange={(e) => set('shippingSameAsBilling', e.target.checked)} />
                    {t('sameAsBilling')}
                  </label>
                </div>
                <textarea className="input" rows={3}
                  value={form.shippingSameAsBilling ? form.billingAddress : form.shippingAddress}
                  disabled={form.shippingSameAsBilling}
                  onChange={(e) => set('shippingAddress', e.target.value)}
                  placeholder="Street, city, PIN"
                  style={form.shippingSameAsBilling ? { opacity: .6 } : undefined} />
              </div>
            </div>
            <div style={{ ...gridCols(), marginTop: 12 }}>
              <div>
                <label style={lbl}>{t('creditPeriod')}</label>
                <div className="flex" style={{ gap: 6, alignItems: 'center' }}>
                  <input className="input" type="number" min="0" style={{ flex: 1, minWidth: 0 }} value={form.creditPeriodDays}
                    onChange={(e) => set('creditPeriodDays', e.target.value)} placeholder="30" />
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('days')}</span>
                </div>
              </div>
              <div>
                <label style={lbl}>{t('creditLimit')}</label>
                <input className="input" type="number" step="0.01" min="0" value={form.creditLimit}
                  onChange={(e) => set('creditLimit', e.target.value)} placeholder="₹ 0" />
              </div>
            </div>
          </Section>

          {/* ── Contact Person ── */}
          <Section title={t('contactSec')}>
            <div style={gridCols()}>
              <div>
                <label style={lbl}>{t('contactName')}</label>
                <input className="input" value={form.contactPersonName}
                  onChange={(e) => set('contactPersonName', e.target.value)} placeholder="e.g. Rahul Mehta" />
              </div>
              <div>
                <label style={lbl}>{t('dob')}</label>
                <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </div>
            </div>
          </Section>

          {/* ── Bank accounts ── */}
          <Section title={t('bankSec')}
            right={<button type="button" className="btn btn-xs btn-ghost"
              onClick={() => setForm((f) => ({ ...f, bankAccounts: [...f.bankAccounts, { ...BLANK_BANK }] }))}>{t('addBank')}</button>}>
            {!form.bankAccounts.length && (
              <div style={{ textAlign: 'center', padding: '18px 10px', color: 'var(--text3)', fontSize: 12.5 }}>
                🏦 {t('bankHint')}
              </div>
            )}
            {form.bankAccounts.map((b, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={gridCols(170)}>
                  <div><label style={lbl}>{t('holderName')}</label>
                    <input className="input" value={b.holderName} onChange={(e) => setBank(i, 'holderName', e.target.value)} /></div>
                  <div><label style={lbl}>{t('accountNumber')}</label>
                    <input className="input" value={b.accountNumber} onChange={(e) => setBank(i, 'accountNumber', e.target.value)} /></div>
                  <div><label style={lbl}>{t('ifsc')}</label>
                    <input className="input" value={b.ifsc} onChange={(e) => setBank(i, 'ifsc', e.target.value.toUpperCase())} /></div>
                  <div><label style={lbl}>{t('bankName')}</label>
                    <input className="input" value={b.bankName} onChange={(e) => setBank(i, 'bankName', e.target.value)} /></div>
                  <div><label style={lbl}>{t('branch')}</label>
                    <input className="input" value={b.branch} onChange={(e) => setBank(i, 'branch', e.target.value)} /></div>
                </div>
                <button type="button" className="btn btn-xs btn-ghost" style={{ marginTop: 8, color: 'var(--red)' }}
                  onClick={() => setForm((f) => ({ ...f, bankAccounts: f.bankAccounts.filter((_, idx) => idx !== i) }))}>
                  🗑 {t('remove')}
                </button>
              </div>
            ))}
          </Section>

          {/* ── Custom fields ── */}
          <Section title={t('customSec')}
            right={<button type="button" className="btn btn-xs btn-ghost"
              onClick={() => setForm((f) => ({ ...f, customFields: [...f.customFields, { name: '', value: '' }] }))}>{t('addCustom')}</button>}>
            {!form.customFields.length && (
              <div style={{ textAlign: 'center', padding: '18px 10px', color: 'var(--text3)', fontSize: 12.5 }}>
                {t('customHint')}
              </div>
            )}
            {form.customFields.map((c, i) => (
              <div key={i} className="flex" style={{ gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={lbl}>{t('fieldName')}</label>
                  <input className="input" value={c.name} onChange={(e) => setCustom(i, 'name', e.target.value)} placeholder="e.g. Referred By" />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={lbl}>{t('fieldValue')}</label>
                  <input className="input" value={c.value} onChange={(e) => setCustom(i, 'value', e.target.value)} />
                </div>
                <button type="button" className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }}
                  onClick={() => setForm((f) => ({ ...f, customFields: f.customFields.filter((_, idx) => idx !== i) }))}>🗑</button>
              </div>
            ))}
          </Section>

          {error && <div style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 12 }}>{error}</div>}
        </div>
      </form>
    </div>
  );
}
