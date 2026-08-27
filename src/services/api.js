// Axios API client. Injects our JWT (from localStorage) into the Authorization
// header on every request. Replaces the old Firebase ID-token interceptor.

import axios from 'axios';

const TOKEN_KEY = 'mpw_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.error || err.message;
    console.warn('[api]', err.config?.method?.toUpperCase(), err.config?.url, '→', msg);
    // Token expired/invalid → clear it so the app falls back to login.
    if (err.response?.status === 401) clearToken();
    return Promise.reject(err);
  }
);

// Turn an axios failure into something a user can act on — and, crucially, that
// distinguishes the three cases a bare `data.error` fallback collapses into one
// generic "Failed":
//
//   1. the server answered with our normal { error } JSON  → show that
//   2. the server answered, but not with our JSON shape    → a gateway/proxy
//      error page (Cloudflare 502/504/524, an HTML body) — show the status
//   3. no response at all → request timed out or never reached the API
//
// Screens should prefer this over `e.response?.data?.error || 'Failed'`, which
// silently reports a 30s timeout and a 504 identically to a validation error.
export function describeError(e, fallback = 'Failed') {
  const res = e?.response;
  if (!res) {
    if (e?.code === 'ECONNABORTED') return 'Server took too long to respond (timed out). Please try again.';
    // Not an axios failure at all — a bug in the calling screen threw before the
    // request went out. Saying "check your connection" would send the user
    // chasing a network problem that doesn't exist, so surface the real message.
    if (e && !e.isAxiosError && e.message) return `${fallback}: ${e.message}`;
    return 'Could not reach the server. Check your connection and try again.';
  }
  const data = res.data;
  const serverMsg = typeof data === 'string' ? null : data?.error;
  if (serverMsg) return serverMsg;
  return `${fallback} (server returned ${res.status}${res.statusText ? ' ' + res.statusText : ''})`;
}

// ── Runaway-request safety net ────────────────────────────────────────────────
// A screen with an unstable useCallback dep (e.g. `t` from useT(), which is a
// fresh ref every render) re-fires its effect on every render and can hammer one
// endpoint hundreds of times a minute. That took the API down once already, so
// the client enforces two guarantees no single screen can bypass:
//
//   1. COALESCE — identical GETs already in flight share one network request.
//   2. GATE — if one GET repeats absurdly often, or the server answers 429, the
//      endpoint is gated: NO network call is made until the backoff expires, and
//      every caller in that period shares one deferred promise that performs a
//      single real request when it lifts. Backoff escalates 5s → 60s while the
//      loop persists and resets on the first healthy response.
//
// The gate must never depend on having a cached success: the failure this was
// written for is a page looping while the server is already returning 429, so
// there is no good response to replay. Suppression is therefore unconditional.
// Correct code never reaches either path and nothing is cached between normal
// calls, so this cannot serve stale data during ordinary use.
const LOOP_WINDOW_MS = 2000;    // how far back we count repeats
const LOOP_MAX_CALLS = 12;      // repeats of ONE endpoint in that window = a loop
const BACKOFF_MIN_MS = 5000;
const BACKOFF_MAX_MS = 60000;

const inFlight = new Map();
const callTimes = new Map();
const backoffMs = new Map();
const gates = new Map();

const rawGet = api.get.bind(api);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Suppress this endpoint for `waitMs`. Everyone who asks meanwhile gets the same
// promise, which performs exactly ONE real request once the gate lifts.
function openGate(key, waitMs, url, config, why) {
  const promise = sleep(waitMs).then(() => {
    gates.delete(key);
    callTimes.set(key, []);
    return api.get(url, config);
  });
  gates.set(key, { until: Date.now() + waitMs, promise });
  backoffMs.set(key, Math.min((backoffMs.get(key) || BACKOFF_MIN_MS) * 2, BACKOFF_MAX_MS));
  console.error(
    `[api] ${why} on GET ${key} — no requests for ${waitMs}ms. A component is ` +
    're-fetching every render; check its useEffect/useCallback deps.'
  );
  return promise;
}

api.get = (url, config) => {
  const key = url + (config?.params ? '?' + JSON.stringify(config.params) : '');
  const now = Date.now();

  // Gate open → share the deferred retry. No network call at all.
  const gate = gates.get(key);
  if (gate && now < gate.until) return gate.promise;

  // Coalesce concurrent duplicates onto the single request already running.
  if (inFlight.has(key)) return inFlight.get(key);

  const times = (callTimes.get(key) || []).filter((ts) => now - ts < LOOP_WINDOW_MS);
  times.push(now);
  callTimes.set(key, times);

  if (times.length > LOOP_MAX_CALLS) {
    return openGate(key, backoffMs.get(key) || BACKOFF_MIN_MS, url, config, 'Request loop detected');
  }

  const p = rawGet(url, config)
    .then((res) => { backoffMs.delete(key); return res; })
    .catch((err) => {
      // The server is shedding load — stop hitting it and honour its reset hint.
      // Resolving via the gate (instead of rejecting) also stops the caller's
      // error handler from re-rendering and immediately re-firing the loop.
      if (err?.response?.status === 429) {
        // Release the in-flight slot FIRST. The gate's retry calls api.get()
        // again, and if this chain were still registered that retry would be
        // handed its own promise and wait on itself forever.
        if (inFlight.get(key) === p) inFlight.delete(key);
        const reset = Number(err.response.headers?.['ratelimit-reset']);
        const waitMs = Number.isFinite(reset) && reset > 0
          ? Math.min(reset * 1000, BACKOFF_MAX_MS)
          : (backoffMs.get(key) || BACKOFF_MIN_MS);
        return openGate(key, waitMs, url, config, 'Server rate-limited (429)');
      }
      throw err;
    })
    // Only clear our own entry — a later request may already own the slot.
    .finally(() => { if (inFlight.get(key) === p) inFlight.delete(key); });

  inFlight.set(key, p);
  return p;
};

// Mirrors the legacy "Firebase paths" used throughout the app.
export const dbApi = {
  list:   (col)         => api.get(`/db/${col}`).then(r => r.data),
  get:    (col, id)     => api.get(`/db/${col}/${id}`).then(r => r.data),
  create: (col, data)   => api.post(`/db/${col}`, data).then(r => r.data),
  set:    (col, id, d)  => api.put(`/db/${col}/${id}`, d).then(r => r.data),
  update: (col, id, p)  => api.patch(`/db/${col}/${id}`, p).then(r => r.data),
  remove: (col, id)     => api.delete(`/db/${col}/${id}`).then(r => r.data),
};

export const authApi = {
  signup:     (body)            => api.post('/auth/signup', body).then(r => r.data),
  login:      (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  me:         ()                => api.get('/auth/me').then(r => r.data),
  createUser: (body)            => api.post('/auth/users', body).then(r => r.data),
  setRole:    (uid, b)          => api.patch(`/auth/users/${uid}/role`, b).then(r => r.data),
  updateUser: (uid, b)          => api.patch(`/auth/users/${uid}`, b).then(r => r.data),
};

// The caller's own company (plan / trial status / branding).
export const tenantApi = {
  get:    ()     => api.get('/tenant').then(r => r.data),
  update: (body) => api.patch('/tenant', body).then(r => r.data),
  // Staff announcements (owner/admin). body: { title, body, forRole?, forUser? }
  notify: (body) => api.post('/tenant/notify', body).then(r => r.data),
  sentNotifications: () => api.get('/tenant/notify/sent').then(r => r.data),
};

// Platform super-admin — manage ALL tenants (gated server-side to platformAdmin).
export const platformApi = {
  stats:        ()         => api.get('/platform/stats').then(r => r.data),
  tenants:      ()         => api.get('/platform/tenants').then(r => r.data),
  updateTenant: (id, body) => api.patch(`/platform/tenants/${id}`, body).then(r => r.data),
  createTenant: (body)     => api.post('/platform/tenants', body).then(r => r.data),
  tenantDetail: (id)       => api.get(`/platform/tenants/${id}/detail`).then(r => r.data),
  broadcast:    (body)     => api.post('/platform/broadcast', body).then(r => r.data),
};

export const meApi = {
  payroll:      () => api.get('/me/payroll').then(r => r.data),
  leaves:       () => api.get('/me/leaves').then(r => r.data),
  attendance:   () => api.get('/me/attendance').then(r => r.data),
  tasks:        () => api.get('/me/tasks').then(r => r.data),
  requestLeave: (body) => api.post('/me/leaves', body).then(r => r.data),
  punch:        (body) => api.post('/me/attendance/punch', body).then(r => r.data),
  notifications:        ()     => api.get('/me/notifications').then(r => r.data),
  readNotification:     (id)   => api.post(`/me/notifications/${id}/read`).then(r => r.data),
  readAllNotifications: ()     => api.post('/me/notifications/read-all').then(r => r.data),
  registerPush:         (token) => api.post('/me/push-token', { token, platform: 'android' }).then(r => r.data),
};

// HR admin — leave decisions, payroll compute/generate, productivity, team attendance (admin/hr).
export const hrApi = {
  leaveDecision:   (id, body) => api.post(`/hr/leaves/${id}/decision`, body).then(r => r.data),
  payrollCompute:  (month)    => api.get('/hr/payroll/compute', { params: { month } }).then(r => r.data),
  payrollGenerate: (month)    => api.post('/hr/payroll/generate', { month }).then(r => r.data),
  productivity:    (params)   => api.get('/hr/productivity', { params }).then(r => r.data),
  attendance:      (date)     => api.get('/hr/attendance', { params: date ? { date } : {} }).then(r => r.data),
};

export const paymentApi = {
  order:  (body) => api.post('/payments/order', body).then(r => r.data),
  verify: (body) => api.post('/payments/verify', body).then(r => r.data),
};

export const uploadApi = {
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data);
  },
};

// Order workflow engine — job cards + 7-stage pipeline (FY job numbering server-side).
export const ordersApi = {
  nextNumber:  ()           => api.get('/orders/next-number').then(r => r.data),
  searchClients: (q)        => api.get('/orders/clients/search', { params: { q } }).then(r => r.data),
  lookups:     ()           => api.get('/orders/lookups').then(r => r.data),
  create:      (body)       => api.post('/orders', body).then(r => r.data),
  transition:  (id, body)   => api.post(`/orders/${id}/transition`, body).then(r => r.data),
  reschedule:  (id, body)   => api.post(`/orders/${id}/reschedule`, body).then(r => r.data),
  departments: ()           => api.get('/orders/departments').then(r => r.data),
  assignProduction: (id, b) => api.post(`/orders/${id}/production`, b).then(r => r.data),
  markStep:    (id, body)   => api.post(`/orders/${id}/step`, body).then(r => r.data),
  deptComplete:(id, body)   => api.post(`/orders/${id}/dept-complete`, body).then(r => r.data),
  stockItems:  ()           => api.get('/orders/stock-items').then(r => r.data),
  designerClaim:    (id)    => api.post(`/orders/${id}/designer/claim`).then(r => r.data),
  designerReject:   (id, reason) => api.post(`/orders/${id}/designer/reject`, { reason }).then(r => r.data),
  designerReady:    (id)    => api.post(`/orders/${id}/designer/ready`).then(r => r.data),
  designerApproval: (id)    => api.post(`/orders/${id}/designer/client-approval`).then(r => r.data),
  designerWait:     (id, reason) => api.post(`/orders/${id}/designer/wait`, { reason }).then(r => r.data),
  designerDesignImage: (id, url) => api.post(`/orders/${id}/designer/design-image`, { url }).then(r => r.data),
  designerHold:     (id)    => api.post(`/orders/${id}/designer/hold`).then(r => r.data),
  designerFeed:     ()      => api.get('/orders/designer/feed').then(r => r.data),
  designerLeave:    (onLeave) => api.post('/orders/designer/leave', { onLeave }).then(r => r.data),
  designerManage:   (uid, b)  => api.post(`/orders/designer/${uid}/manage`, b).then(r => r.data),
  qc:          (id, body)   => api.post(`/orders/${id}/qc`, body).then(r => r.data),
  dispatch:    (id, body)   => api.post(`/orders/${id}/dispatch`, body).then(r => r.data),
};

// Production types — the tiles in the "Select Production Type" grid (Assign-Production
// flow). Admin/owner-only on the server; auto-seeds the built-in 12 on first list().
export const productionTypesApi = {
  list:   ()         => api.get('/orders/production-types').then(r => r.data),
  create: (body)     => api.post('/orders/production-types', body).then(r => r.data),
  update: (id, body) => api.patch(`/orders/production-types/${id}`, body).then(r => r.data),
  remove: (id)       => api.delete(`/orders/production-types/${id}`).then(r => r.data),
};

// Billing & Accounting — GST/proforma invoices, payments, ledger, P&L, GST report.
export const accountingApi = {
  invoiceNumber: (type)     => api.get('/accounting/invoice-number', { params: { type } }).then(r => r.data),
  // Party 360° — profile + transaction feed + item-wise summary + totals, for
  // the Parties detail pane. type is 'client' (default) or 'vendor'.
  party: (id, type)         => api.get(`/accounting/party/${id}`, { params: { type } }).then(r => r.data),
  // Create a customer/supplier. Goes through accounting (not /db/:col) so a
  // non-zero opening balance posts a real journal against Owner's Capital.
  createParty: (body)       => api.post('/accounting/party', body).then(r => r.data),
  // Everything the Create Invoice form prefills: next number, bank details,
  // company GSTIN/state, default Terms for this doc type, GST state list.
  invoiceDefaults: (type)   => api.get('/accounting/invoice-defaults', { params: { type } }).then(r => r.data),
  createInvoice: (body)     => api.post('/accounting/invoice', body).then(r => r.data),
  recordPayment: (id, body) => api.post(`/accounting/invoice/${id}/payment`, body).then(r => r.data),
  voidInvoice:   (id)       => api.post(`/accounting/invoice/${id}/void`).then(r => r.data),
  // Payment links (Phase 4B-1) — status (no mint) and mint-if-missing.
  payLinkStatus: (id)       => api.get(`/accounting/invoice/${id}/pay-link`).then(r => r.data),
  payLinkMint:   (id)       => api.post(`/accounting/invoice/${id}/pay-link`).then(r => r.data),
  // Public (no-auth) payment-page lookup — returns { valid, invoice, seller, items }.
  publicPay:     (token)    => api.get(`/public/pay/${token}`).then(r => r.data),
  alerts:        ()         => api.get('/accounting/alerts').then(r => r.data),
  ledger:        ()         => api.get('/accounting/ledger').then(r => r.data),
  pnl:           (params)   => api.get('/accounting/pnl', { params }).then(r => r.data),
  gstReport:     (params)   => api.get('/accounting/gst-report', { params }).then(r => r.data),
  // GSTR-1 offline-tool JSON (GSTN common schema) for the period — file-ready.
  gstExport:     (params)   => api.get('/accounting/gst/export', { params }).then(r => r.data),
  creditNote:    (body)     => api.post('/accounting/credit-note', body).then(r => r.data),
  creditNotes:   ()         => api.get('/accounting/credit-notes').then(r => r.data),
  debitNote:     (body)     => api.post('/accounting/debit-note', body).then(r => r.data),
  debitNotes:    ()         => api.get('/accounting/debit-notes').then(r => r.data),
  // Expenses CRUD
  expenses:      ()         => api.get('/accounting/expenses').then(r => r.data),
  createExpense: (body)     => api.post('/accounting/expenses', body).then(r => r.data),
  updateExpense: (id, body) => api.put(`/accounting/expenses/${id}`, body).then(r => r.data),
  deleteExpense: (id)       => api.delete(`/accounting/expenses/${id}`).then(r => r.data),
  expenseCategories: ()     => api.get('/accounting/expense-categories').then(r => r.data),
  suggestCategory:   (body) => api.post('/accounting/expenses/suggest-category', body).then(r => r.data),
  reminders:         ()     => api.get('/accounting/automation/reminders').then(r => r.data),
  markReminderRead:  (id)   => api.post(`/accounting/automation/reminders/${id}/read`).then(r => r.data),
  // Purchase Orders CRUD
  purchaseOrders: ()        => api.get('/accounting/purchase-orders').then(r => r.data),
  createPO:      (body)     => api.post('/accounting/purchase-orders', body).then(r => r.data),
  updatePO:      (id, body) => api.put(`/accounting/purchase-orders/${id}`, body).then(r => r.data),
  receivePO:     (id, body) => api.post(`/accounting/purchase-orders/${id}/receive`, body || {}).then(r => r.data),
  deletePO:      (id)       => api.delete(`/accounting/purchase-orders/${id}`).then(r => r.data),
  // Client Ledger
  clientLedger:  (clientId) => api.get(`/accounting/client-ledger/${clientId}`).then(r => r.data),
  // Delivery Challans
  deliveryChallans: ()        => api.get('/accounting/delivery-challans').then(r => r.data),
  createDC:      (body)     => api.post('/accounting/delivery-challans', body).then(r => r.data),
  updateDC:      (id, body) => api.put(`/accounting/delivery-challans/${id}`, body).then(r => r.data),
  deleteDC:      (id)       => api.delete(`/accounting/delivery-challans/${id}`).then(r => r.data),
  // Recurring Invoices
  recurringInvoices: ()     => api.get('/accounting/recurring-invoices').then(r => r.data),
  createRecurringInvoice: (body) => api.post('/accounting/recurring-invoices', body).then(r => r.data),
  updateRecurringInvoice: (id, body) => api.put(`/accounting/recurring-invoices/${id}`, body).then(r => r.data),
  deleteRecurringInvoice: (id) => api.delete(`/accounting/recurring-invoices/${id}`).then(r => r.data),
  generateRecurringInvoice: (id) => api.post(`/accounting/recurring-invoices/${id}/generate`).then(r => r.data),
  // Branches (multi-location)
  branches:          ()     => api.get('/accounting/branches').then(r => r.data),
  createBranch:      (body) => api.post('/accounting/branches', body).then(r => r.data),
  updateBranch:      (id, body) => api.put(`/accounting/branches/${id}`, body).then(r => r.data),
  deleteBranch:      (id)   => api.delete(`/accounting/branches/${id}`).then(r => r.data),
  // Global search across parties / invoices / jobs / stock / POs
  search:            (q)    => api.get('/accounting/search', { params: { q } }).then(r => r.data),
  // Bank reconciliation (Phase 4A-3)
  recon:           (params) => api.get('/accounting/recon', { params }).then(r => r.data),
  reconStatements: (lines)  => api.post('/accounting/recon/statements', lines).then(r => r.data),
  reconDelete:     (id)     => api.delete(`/accounting/recon/statements/${id}`).then(r => r.data),
  reconMatch:      (body)   => api.post('/accounting/recon/match', body).then(r => r.data),
  reconUnmatch:    (body)   => api.post('/accounting/recon/unmatch', body).then(r => r.data),
  reconAutoMatch:  (body)   => api.post('/accounting/recon/auto-match', body).then(r => r.data),
  // TDS (Phase 4A-4)
  tdsSections: ()      => api.get('/accounting/tds/sections').then(r => r.data),
  tdsList:     ()      => api.get('/accounting/tds').then(r => r.data),
  tdsCreate:   (body)  => api.post('/accounting/tds', body).then(r => r.data),
  tdsReport:   (params) => api.get('/accounting/tds/report', { params }).then(r => r.data),
  tdsDelete:   (id)    => api.delete(`/accounting/tds/${id}`).then(r => r.data),
};

// Double-entry ledger reports — every endpoint reads the journalEntries
// projection produced by the posting engine, so Trial Balance / P&L / Balance
// Sheet / Cash Flow / party statements all agree by construction.
export const ledgerApi = {
  accounts:       (params) => api.get('/ledger/accounts', { params }).then(r => r.data),
  trialBalance:   (params) => api.get('/ledger/trial-balance', { params }).then(r => r.data),
  pnl:            (params) => api.get('/ledger/pnl', { params }).then(r => r.data),
  balanceSheet:   (params) => api.get('/ledger/balance-sheet', { params }).then(r => r.data),
  cashFlow:       (params) => api.get('/ledger/cash-flow', { params }).then(r => r.data),
  party:          (id, type) => api.get(`/ledger/party/${id}`, { params: type ? { type } : {} }).then(r => r.data),
  entries:        (params) => api.get('/ledger/entries', { params }).then(r => r.data),
  openingBalance: (body)   => api.post('/ledger/opening-balance', body).then(r => r.data),
  // Manual vouchers (journal / payment / receipt / contra). DELETE only works for
  // these — entries derived from invoices/payments/expenses/POs are immutable.
  entry:          (body)   => api.post('/ledger/entry', body).then(r => r.data),
  deleteEntry:    (id)     => api.delete(`/ledger/entry/${id}`).then(r => r.data),
};

// Sales / Leads CRM — assign, outcome, Excel import, targets, leaderboard, reports.
export const salesApi = {
  assignLead:  (id, body) => api.post(`/sales/leads/${id}/assign`, body).then(r => r.data),
  setOutcome:  (id, body) => api.post(`/sales/leads/${id}/outcome`, body).then(r => r.data),
  importLeads: (file)     => { const fd = new FormData(); fd.append('file', file); return api.post('/sales/leads/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data); },
  setTarget:   (body)     => api.post('/sales/targets', body).then(r => r.data),
  targets:     (month)    => api.get('/sales/targets', { params: { month } }).then(r => r.data),
  leaderboard: (params)   => api.get('/sales/leaderboard', { params }).then(r => r.data),
  report:      (params)   => api.get('/sales/report', { params }).then(r => r.data),
};

// Stock — material in/out movements that adjust an item's running quantity.
export const stockApi = {
  move:      (body)   => api.post('/stock/move', body).then(r => r.data),
  movements: (itemId) => api.get('/stock/movements', { params: itemId ? { itemId } : {} }).then(r => r.data),
  // Current stock value at moving-average cost (Accounting dashboard + Balance Sheet).
  // Pass { method: 'fifo'|'fefo' } to value from batch costs instead.
  valuation: (params) => api.get('/stock/valuation', { params }).then(r => r.data),
  // Bulk product/stock import. Pass { rows, dryRun: true } to preview first.
  bulk:      (body)   => api.post('/stock/bulk', body).then(r => r.data),
  // Variants & batches
  items:       (params) => api.get('/stock/items', { params }).then(r => r.data),
  batches:     (params) => api.get('/stock/batches', { params }).then(r => r.data),
  receiveBatch: (body)  => api.post('/stock/batch', body).then(r => r.data),
  issueBatch:   (body)  => api.post('/stock/batch-out', body).then(r => r.data),
  addVariant:   (body)  => api.post('/stock/variant', body).then(r => r.data),
  deleteVariant: (id, body) => api.delete(`/stock/variant/${id}`, { data: body }).then(r => r.data),
};

// Customer messaging — templates, broadcast, outbox (send is stubbed server-side).
export const messagingApi = {
  templates:    ()           => api.get('/messaging/templates').then(r => r.data),
  saveTemplate: (key, body)  => api.put(`/messaging/templates/${key}`, { body }).then(r => r.data),
  broadcast:    (body)       => api.post('/messaging/broadcast', body).then(r => r.data),
  outbox:       (status)     => api.get('/messaging/outbox', { params: status ? { status } : {} }).then(r => r.data),
  sendPending:  ()           => api.post('/messaging/send-pending').then(r => r.data),
  markSent:     (id)         => api.post(`/messaging/${id}/sent`).then(r => r.data),
};

// Analytics — consolidated business overview (KPIs, jobs-by-stage, revenue series).
export const analyticsApi = {
  overview: (params) => api.get('/analytics/overview', { params }).then(r => r.data),
  // Live job-pipeline tile strip (stage counts + approval + online staff).
  pipeline: () => api.get('/analytics/pipeline').then(r => r.data),
};

export const chatApi = {
  messages:    (convId)   => api.get(`/chat/messages/${convId}`).then(r => r.data),
  send:        (body)     => api.post('/chat/messages', body).then(r => r.data),
  groups:      ()         => api.get('/chat/groups').then(r => r.data),
  createGroup: (body)     => api.post('/chat/groups', body).then(r => r.data),
  updateGroup: (id, body) => api.patch(`/chat/groups/${id}`, body).then(r => r.data),
};

// ── Module 14 — Super Admin ─────────────────────────────────────────────────
// Audit trail (read-only viewer).
export const auditApi = {
  list: (params) => api.get('/audit', { params }).then(r => r.data),
};

// API keys for the external /api/v1 surface. The plaintext key is returned ONCE.
export const apiKeysApi = {
  list:   ()        => api.get('/apikeys').then(r => r.data),
  create: (body)    => api.post('/apikeys', body).then(r => r.data),
  revoke: (id)      => api.delete(`/apikeys/${id}`).then(r => r.data),
};

// Outbound webhooks + delivery logs (signing secret returned ONCE on create).
export const webhooksApi = {
  list:   ()        => api.get('/webhooks').then(r => r.data),
  create: (body)    => api.post('/webhooks', body).then(r => r.data),
  update: (id, b)   => api.patch(`/webhooks/${id}`, b).then(r => r.data),
  remove: (id)      => api.delete(`/webhooks/${id}`).then(r => r.data),
  test:   (id)      => api.post(`/webhooks/${id}/test`).then(r => r.data),
  logs:   (params)  => api.get('/webhooks/logs', { params }).then(r => r.data),
};

// Custom domain — store config + DNS TXT ownership verification.
export const domainApi = {
  get:    ()        => api.get('/domain').then(r => r.data),
  set:    (body)    => api.post('/domain', body).then(r => r.data),
  verify: ()        => api.post('/domain/verify').then(r => r.data),
  remove: ()        => api.delete('/domain').then(r => r.data),
};

// Referrals — your share code + the businesses you referred.
export const referralsApi = {
  code: () => api.get('/referrals/code').then(r => r.data),
  list: () => api.get('/referrals').then(r => r.data),
};

export default api;
