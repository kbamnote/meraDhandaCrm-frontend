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
  deleteUser: (uid)             => api.delete(`/auth/users/${uid}`).then(r => r.data),
  // Designations — the job-title list a teammate's designation is picked from.
  designations:      ()         => api.get('/auth/designations').then(r => r.data),
  createDesignation: (name)     => api.post('/auth/designations', { name }).then(r => r.data),
  renameDesignation: (from, to) => api.patch('/auth/designations', { from, to }).then(r => r.data),
  deleteDesignation: (name)     => api.delete('/auth/designations', { params: { name } }).then(r => r.data),
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
  // Salary advances — the cap is the server's answer, never a local sum.
  advanceLimit:  ()      => api.get('/me/advance-limit').then(r => r.data),
  advances:      ()      => api.get('/me/advances').then(r => r.data),
  applyAdvance:  (body)  => api.post('/me/advances', body).then(r => r.data),
  cancelAdvance: (id)    => api.post(`/me/advances/${id}/cancel`).then(r => r.data),
  // Name, phone and photo — the few things a person may change about
  // themselves. Salary and role are deliberately not among them.
  updateProfile: (body)  => api.patch('/me/profile', body).then(r => r.data),
};

// HR admin — leave decisions, payroll compute/generate, productivity, team attendance (admin/hr).
export const hrApi = {
  leaveDecision:   (id, body) => api.post(`/hr/leaves/${id}/decision`, body).then(r => r.data),
  // Either a month ('2026-09') or a custom range ({ from, to, workingDays? }).
  payrollCompute:  (p)        => api.get('/hr/payroll/compute', { params: typeof p === 'string' ? { month: p } : p }).then(r => r.data),
  // Which day of the month the pay cycle opens on (1 = calendar month).
  setPayrollCycle: (startDay)   => api.post('/hr/payroll/cycle', { startDay }).then(r => r.data),
  payrollGenerate: (month)    => api.post('/hr/payroll/generate', { month }).then(r => r.data),
  productivity:    (params)   => api.get('/hr/productivity', { params }).then(r => r.data),
  attendance:      (date)     => api.get('/hr/attendance', { params: date ? { date } : {} }).then(r => r.data),
  userAttendance:  (uid, month) => api.get(`/hr/attendance/${uid}`, { params: month ? { month } : {} }).then(r => r.data),
  // Custom date range (inclusive, YYYY-MM-DD). Per-teammate totals for the range…
  attendanceSummary: (from, to) => api.get('/hr/attendance/summary', { params: { from, to } }).then(r => r.data),
  // …and one teammate's records within it.
  userAttendanceRange: (uid, from, to) => api.get(`/hr/attendance/${uid}`, { params: { from, to } }).then(r => r.data),
  // Pay, and the advances drawn against it.
  salaries:        ()            => api.get('/hr/salaries').then(r => r.data),
  setSalary:       (uid, salary) => api.post(`/hr/salaries/${uid}`, { salary }).then(r => r.data),
  // A hike is given as EITHER an amount or a percent; the server derives the other.
  hikeSalary:      (uid, body)   => api.post(`/hr/salaries/${uid}/hike`, body).then(r => r.data),
  salaryRevisions: (uid)         => api.get(`/hr/salaries/${uid}/revisions`).then(r => r.data),
  advances:        (params)      => api.get('/hr/advances', { params }).then(r => r.data),
  // Money already handed over, written down after the fact. Lands approved.
  recordAdvance:   (body)        => api.post('/hr/advances', body).then(r => r.data),
  decideAdvance:   (id, body)    => api.post(`/hr/advances/${id}/decide`, body).then(r => r.data),
  repayAdvance:    (id, body)    => api.post(`/hr/advances/${id}/repay`, body).then(r => r.data),
};

export const paymentApi = {
  order:  (body) => api.post('/payments/order', body).then(r => r.data),
  verify: (body) => api.post('/payments/verify', body).then(r => r.data),
};

export const uploadApi = {
  // `preset` asks the server to shrink before storing: 'selfie' (640px) or
  // 'photo' (1600px cap). Omitted, the file is stored exactly as sent — so this
  // cannot silently degrade an existing caller.
  upload: (file, preset) => {
    const fd = new FormData();
    fd.append('file', file);
    if (preset) fd.append('preset', preset);
    return api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(r => r.data);
  },
};

// Order workflow engine — job cards + 7-stage pipeline (FY job numbering server-side).
export const ordersApi = {
  nextNumber:  ()           => api.get('/orders/next-number').then(r => r.data),
  searchClients: (q)        => api.get('/orders/clients/search', { params: { q } }).then(r => r.data),
  lookups:     ()           => api.get('/orders/lookups').then(r => r.data),
  // Jobs past their promised delivery time, for the on-screen alert.
  overdue:     ()           => api.get('/orders/overdue').then(r => r.data),
  // Jobs per stage, for the sidebar badges — a count, not the jobs.
  stageCounts: ()           => api.get('/orders/stage-counts').then(r => r.data),
  create:      (body)       => api.post('/orders', body).then(r => r.data),
  // Correct a job card's details. The stage moves via transition(), and the
  // job number never changes.
  update:      (id, body)   => api.put(`/orders/${id}`, body).then(r => r.data),
  // Add a product from the job-card form. Open to any job-card creator,
  // like the customer auto-add; matched by name so it never duplicates.
  createProduct: (name)     => api.post('/orders/products', { name }).then(r => r.data),
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
  // Why this designer's pool looks the way it does: on leave, how many jobs
  // are waiting, and how many are hidden only because they passed them.
  designerStatus:   ()      => api.get('/orders/designer/status').then(r => r.data),
  designerPassed:   ()      => api.get('/orders/designer/passed').then(r => r.data),
  designerUnpass:   (id)    => api.post(`/orders/${id}/designer/unpass`).then(r => r.data),
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
  // Tally-style account groups a party can be filed under (Balance Sheet
  // placement — see the note in posting.js; these do NOT shape the P&L).
  partyGroups: ()           => api.get('/accounting/party-groups').then(r => r.data),
  // Item-wise report for one party, sales and purchases side by side.
  // Record money received from / paid to a party without starting from an
  // invoice. Allocates oldest-first across unpaid invoices; any excess is held
  // on account.
  // Unapplied advance a party is holding. Applying it is a document allocation,
  // not a new posting — the cash already hit the ledger when it was received.
  partyAdvance: (id) => api.get(`/accounting/party/${id}/advance`).then(r => r.data),
  applyAdvance: (invoiceId, amount) =>
    api.post(`/accounting/invoice/${invoiceId}/apply-advance`, amount != null ? { amount } : {}).then(r => r.data),
  partyPayment: (id, body) => api.post(`/accounting/party/${id}/payment`, body).then(r => r.data),
  // Payment In / Payment Out vouchers.
  payments:      (params)   => api.get('/accounting/payments', { params }).then(r => r.data),
  // One voucher, with the bills it settled and what they owe now.
  payment:       (id)       => api.get(`/accounting/payment/${id}`).then(r => r.data),
  // Correct one already recorded. The server reverses it and re-records
  // through the same path that created it, keeping its voucher number.
  updatePayment: (id, body) => api.put(`/accounting/payment/${id}`, body).then(r => r.data),
  // The number the form displays. Peeks at the counter without taking one, so
  // opening the screen and changing your mind does not burn a voucher number.
  paymentNumber: (direction) => api.get('/accounting/payment-number', { params: { direction } }).then(r => r.data),
  // What this party still owes, oldest first — the rows to allocate against.
  openBills:     (id, type, forPayment) => api.get(`/accounting/party/${id}/open-bills`, { params: { type, forPayment } }).then(r => r.data),
  // Search either side. Suppliers had no search at all before this; only
  // clients were indexed, via ordersApi.searchClients.
  searchParties: (q, type)  => api.get('/accounting/party-search', { params: { q, type } }).then(r => r.data),
  partyItems: (id, params) => api.get(`/accounting/party/${id}/items`, { params }).then(r => r.data),
  updateParty: (id, type, body) => api.put(`/accounting/party/${id}`, body, { params: { type } }).then(r => r.data),
  // Deletes a party that was never used; marks one with history inactive
  // instead. The response says which happened — they are different promises.
  deleteParty: (id, type) => api.delete(`/accounting/party/${id}`, { params: { type } }).then(r => r.data),
  // Re-address an invoice raised against the wrong customer. Its receipts and
  // notes move with it. Refused when the move would change the tax.
  transferInvoiceParty: (invoiceId, toPartyId) =>
    api.post(`/accounting/invoice/${invoiceId}/transfer-party`, { toPartyId }).then(r => r.data),
  // GSTIN -> business details. Always resolves: an unconfigured or failing
  // provider returns { ok:false, data:<what the GSTIN itself tells us> } so the
  // form can fall back to manual entry rather than blocking.
  gstinLookup: (gstin)      => api.get(`/accounting/gstin/${gstin}`).then(r => r.data),
  // Sales profitability — per-invoice and per-item margin from the costs
  // stamped at invoice time. { summary, invoices, items }.
  profit: (params)          => api.get('/accounting/profit', { params }).then(r => r.data),
  // Bulk party import. ALWAYS call with dryRun:true first — the response is the
  // exact impact report, and nothing is written until you call again without it.
  importParties: (body)     => api.post('/accounting/import/parties', body).then(r => r.data),
  // Historical sales import. Always dry-run first. Imported invoices never move
  // stock, and existing invoice numbers are skipped rather than overwritten.
  importTransactions: (body) => api.post('/accounting/import/transactions', body).then(r => r.data),
  // Purchase register import — one row per supplier bill. Always dry-run first.
  // Imported bills never move stock, existing bill numbers are skipped, and the
  // optional ledger posting debits Purchases (expense) rather than Inventory.
  importPurchases: (body)   => api.post('/accounting/import/purchases', body).then(r => r.data),
  // Cash & Bank. Each named account is its own ledger head (`bank:<id>`), so a
  // payment can say WHICH account it landed in.
  bankAccounts:       ()          => api.get('/accounting/bank-accounts').then(r => r.data),
  createBankAccount:  (body)      => api.post('/accounting/bank-accounts', body).then(r => r.data),
  updateBankAccount:  (id, body)  => api.put(`/accounting/bank-accounts/${id}`, body).then(r => r.data),
  deleteBankAccount:  (id)        => api.delete(`/accounting/bank-accounts/${id}`).then(r => r.data),
  bankTransactions:   (id, params) => api.get(`/accounting/bank-accounts/${id}/transactions`, { params }).then(r => r.data),
  bankTransfer:       (body)      => api.post('/accounting/bank-accounts/transfer', body).then(r => r.data),
  bankAdjust:         (body)      => api.post('/accounting/bank-accounts/adjust', body).then(r => r.data),
  bankEntry:          (entryId)   => api.get(`/accounting/bank-accounts/entry/${entryId}`).then(r => r.data),
  // Correct or remove a statement row. Only rows Cash & Bank itself created
  // (a transfer or an Add/Reduce Money) — anything derived from an invoice or
  // an expense is edited on the screen that owns it, and the server says so.
  bankEntryUpdate:    (entryId, body) => api.put(`/accounting/bank-accounts/entry/${entryId}`, body).then(r => r.data),
  bankEntryDelete:    (entryId)   => api.delete(`/accounting/bank-accounts/entry/${entryId}`).then(r => r.data),
  // Correct WHICH account past transactions went through. Not a transfer: no
  // money moves and no entry is created — it rewrites the existing one AND the
  // document behind it, so a later re-post reproduces the correction.
  bankReassign:       (body)      => api.post('/accounting/bank-accounts/reassign', body).then(r => r.data),
  // Per-job (cost-centre) profitability. NOTE the margin is MATERIAL-only —
  // nothing records labour or machine time against a job.
  jobProfit: (params)       => api.get('/accounting/job-profit', { params }).then(r => r.data),
  // Everything the Create Invoice form prefills: next number, bank details,
  // company GSTIN/state, default Terms for this doc type, GST state list.
  invoiceDefaults: (type)   => api.get('/accounting/invoice-defaults', { params: { type } }).then(r => r.data),
  createInvoice: (body)     => api.post('/accounting/invoice', body).then(r => r.data),
  // Correct an invoice in place, keeping its number. Refused (409) once money
  // has been received against it — use a credit/debit note then — or if the
  // financial year is closed. The prior version is kept in `revisions`.
  updateInvoice: (id, body) => api.put(`/accounting/invoice/${id}`, body).then(r => r.data),
  invoicePayments: (id)     => api.get(`/accounting/invoice/${id}/payments`).then(r => r.data),
  // Undo a receipt recorded by mistake: its ledger entry goes too, and the
  // invoice's paid amount is recomputed from what is left.
  undoPayment:    (id)      => api.delete(`/accounting/payment/${id}`).then(r => r.data),
  recordPayment: (id, body) => api.post(`/accounting/invoice/${id}/payment`, body).then(r => r.data),
  voidInvoice:   (id)       => api.post(`/accounting/invoice/${id}/void`).then(r => r.data),
  deleteInvoice: (id)       => api.delete(`/accounting/invoice/${id}`).then(r => r.data),
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
  // The read-only GST registers behind the returns. All three read the
  // documents, not the ledger, so a register and the return agree.
  gstr1:         (params)   => api.get('/accounting/gstr1', { params }).then(r => r.data),
  gstr2:         (params)   => api.get('/accounting/gstr2', { params }).then(r => r.data),
  // Mail the spreadsheet the reader is looking at. `content` is base64 of a
  // workbook the BROWSER built, so the mail matches the filtered view on
  // screen rather than a second, server-side rendering of the same report.
  emailReport:   (body)     => api.post('/accounting/report-email', body).then(r => r.data),
  gstr3b:        (params)   => api.get('/accounting/gstr3b', { params }).then(r => r.data),
  gstHsn:        (params)   => api.get('/accounting/gst-hsn', { params }).then(r => r.data),
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
  createExpenseCategory: (body) => api.post('/accounting/expense-categories', body).then(r => r.data),
  suggestCategory:   (body) => api.post('/accounting/expenses/suggest-category', body).then(r => r.data),
  reminders:         ()     => api.get('/accounting/automation/reminders').then(r => r.data),
  markReminderRead:  (id)   => api.post(`/accounting/automation/reminders/${id}/read`).then(r => r.data),
  // Purchase Orders CRUD
  // Quotations / Estimates.
  quotations:         (params)   => api.get('/accounting/quotations', { params }).then(r => r.data),
  setQuotationStatus: (id, body) => api.post(`/accounting/quotation/${id}/status`, body).then(r => r.data),
  quotationDraft:     (id)       => api.get(`/accounting/quotation/${id}/convert-draft`).then(r => r.data),
  purchaseOrders: ()        => api.get('/accounting/purchase-orders').then(r => r.data),
  createPO:      (body)     => api.post('/accounting/purchase-orders', body).then(r => r.data),
  updatePO:      (id, body) => api.put(`/accounting/purchase-orders/${id}`, body).then(r => r.data),
  receivePO:     (id, body) => api.post(`/accounting/purchase-orders/${id}/receive`, body || {}).then(r => r.data),
  deletePO:      (id)       => api.delete(`/accounting/purchase-orders/${id}`).then(r => r.data),
  // A purchase INVOICE is the supplier's bill for goods already received, so
  // unlike a PO it posts to the ledger the moment it is saved.
  createPurchaseInvoice: (body) => api.post('/accounting/purchase-invoice', body).then(r => r.data),
  getPurchaseInvoice:    (id)   => api.get(`/accounting/purchase-invoice/${id}`).then(r => r.data),
  // Refused once a payment is recorded against the bill (use a debit note), and
  // inside a closed year. Re-posts the ledger and re-receives the stock.
  updatePurchaseInvoice: (id, body) => api.put(`/accounting/purchase-invoice/${id}`, body).then(r => r.data),
  // Pay a supplier against one bill. Refuses more than is owed — pay the excess
  // from Parties so it is held as an advance.
  payPurchaseInvoice:    (id, body) => api.post(`/accounting/purchase-invoice/${id}/payment`, body).then(r => r.data),
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
  // The statutory sections plus any this shop added. Each carries
  // { code, name, defaultRate, custom }.
  tdsSections: ()      => api.get('/accounting/tds/sections').then(r => r.data),
  addTdsRate: (body)   => api.post('/accounting/tds/rates', body).then(r => r.data),
  deleteTdsRate: (id)  => api.delete(`/accounting/tds/rates/${id}`).then(r => r.data),
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
  // Edit a MANUAL voucher — re-posts against the same ref, so the correction
  // replaces the old ledger effect instead of stacking on top of it. The prior
  // version is retained in meta.revisions. Returns a NEW entry id.
  updateEntry:    (id, body) => api.put(`/ledger/entry/${id}`, body).then(r => r.data),
  deleteEntry:    (id)     => api.delete(`/ledger/entry/${id}`).then(r => r.data),
  // Year-end close (Phase 5-4). preview() posts nothing; close() is idempotent
  // — re-running recomputes the same closing entry rather than stacking one.
  yearEndPreview: (fy)     => api.get('/ledger/year-end', { params: { fy } }).then(r => r.data),
  yearEndClosed:  ()       => api.get('/ledger/year-end/closed').then(r => r.data),
  yearEndClose:   (fy)     => api.post('/ledger/year-end/close', { fy }).then(r => r.data),
  yearEndReopen:  (fy)     => api.post('/ledger/year-end/reopen', { fy }).then(r => r.data),
};

// Sales / Leads CRM — assign, outcome, Excel import, targets, leaderboard, reports.
export const salesApi = {
  assignLead:  (id, body) => api.post(`/sales/leads/${id}/assign`, body).then(r => r.data),
  setOutcome:  (id, body) => api.post(`/sales/leads/${id}/outcome`, body).then(r => r.data),
  // `assignedTo` (optional) gives every imported row the same owner; an
  // 'Assigned To' column in the sheet overrides it per row.
  importLeads: (file, assignedTo) => {
    const fd = new FormData();
    fd.append('file', file);
    if (assignedTo) fd.append('assignedTo', assignedTo);
    return api.post('/sales/leads/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
  },
  // The ready-made .xlsx to fill in. Returned as a blob so it can be saved.
  leadTemplate: () => api.get('/sales/leads/import-template', { responseType: 'blob' }).then(r => r.data),
  // Calling: the outcomes, logging one, a lead's history, and the day's report.
  // The caller's OWN calling figures, for their dashboard.
  myCalling:   (params)   => api.get('/sales/my-calling', { params }).then(r => r.data),
  callStatuses: ()        => api.get('/sales/call-statuses').then(r => r.data),
  logCall:     (id, body) => api.post(`/sales/leads/${id}/call`, body).then(r => r.data),
  leadCalls:   (id)       => api.get(`/sales/leads/${id}/calls`).then(r => r.data),
  calls:       (params)   => api.get('/sales/calls', { params }).then(r => r.data),
  setTarget:   (body)     => api.post('/sales/targets', body).then(r => r.data),
  targets:     (month)    => api.get('/sales/targets', { params: { month } }).then(r => r.data),
  leaderboard: (params)   => api.get('/sales/leaderboard', { params }).then(r => r.data),
  report:      (params)   => api.get('/sales/report', { params }).then(r => r.data),
  // One rep's own orders, billing and collection. Defaults to the caller and
  // this month; `userId` needs the Tracking grant, like the team map.
  myPerformance: (params) => api.get('/sales/my-performance', { params }).then(r => r.data),
};

// Stock — material in/out movements that adjust an item's running quantity.
export const stockApi = {
  move:      (body)   => api.post('/stock/move', body).then(r => r.data),
  movements: (itemId) => api.get('/stock/movements', { params: itemId ? { itemId } : {} }).then(r => r.data),
  // Current stock value at moving-average cost (Accounting dashboard + Balance Sheet).
  // Pass { method: 'fifo'|'fefo' } to value from batch costs instead.
  valuation: (params) => api.get('/stock/valuation', { params }).then(r => r.data),
  // Bulk product/stock import. Pass { rows, dryRun: true } to preview first.
  // A few hundred rows is a lot of writing, and the default 30s timeout
  // reported an import that was still running as a failure — leaving the user
  // with no idea how much of it had landed. The server batches the writes now;
  // this is headroom for a slow connection.
  bulk:      (body)   => api.post('/stock/bulk', body, { timeout: 180000 }).then(r => r.data),
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
  messages:    (convId, params) => api.get(`/chat/messages/${convId}`, { params }).then(r => r.data),
  send:        (body)     => api.post('/chat/messages', body).then(r => r.data),
  // The list screen's rows: last message + unread count per conversation,
  // computed server-side so a client never downloads a thread to draw a row.
  conversations: ()       => api.get('/chat/conversations').then(r => r.data),
  markRead:    (convId)   => api.post(`/chat/read/${convId}`).then(r => r.data),
  editMessage: (id, text) => api.patch(`/chat/messages/${id}`, { text }).then(r => r.data),
  deleteMessage: (id)     => api.delete(`/chat/messages/${id}`).then(r => r.data),
  react:       (id, emoji) => api.post(`/chat/messages/${id}/react`, { emoji }).then(r => r.data),
  search:      (q)        => api.get('/chat/search', { params: { q } }).then(r => r.data),
  groups:      ()         => api.get('/chat/groups').then(r => r.data),
  createGroup: (body)     => api.post('/chat/groups', body).then(r => r.data),
  updateGroup: (id, body) => api.patch(`/chat/groups/${id}`, body).then(r => r.data),
  leaveGroup:  (id)       => api.post(`/chat/groups/${id}/leave`).then(r => r.data),
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

// Field tracking — where the sales team is, and where they have been.
// `fix` is what a phone posts; the rest is what a manager reads.
export const trackingApi = {
  me:      ()                 => api.get('/tracking/me').then(r => r.data),
  live:    ()                 => api.get('/tracking/live').then(r => r.data),
  history: (userId, params)   => api.get(`/tracking/history/${userId}`, { params }).then(r => r.data),
  summary: (params)           => api.get('/tracking/summary', { params }).then(r => r.data),
  fix:     (body)             => api.post('/tracking/fix', body).then(r => r.data),
  stop:    (reason)           => api.post('/tracking/stop', { reason }).then(r => r.data),
  setTracked: (userId, enabled) => api.post(`/tracking/user/${userId}/track`, { enabled }).then(r => r.data),
};

// Shop visits — a rep checks in at a shop with a photo, then files feedback on
// the way out. `list` returns the caller's own unless they may watch the team.
export const visitsApi = {
  list:     (params)      => api.get('/visits', { params }).then(r => r.data),
  open:     ()            => api.get('/visits/open').then(r => r.data),
  outcomes: ()            => api.get('/visits/outcomes').then(r => r.data),
  summary:  (params)      => api.get('/visits/summary', { params }).then(r => r.data),
  checkIn:  (body)        => api.post('/visits/checkin', body).then(r => r.data),
  feedback: (id, body)    => api.post(`/visits/${id}/feedback`, body).then(r => r.data),
  remove:   (id)          => api.delete(`/visits/${id}`).then(r => r.data),
};

// Referrals — your share code + the businesses you referred.
export const referralsApi = {
  code: () => api.get('/referrals/code').then(r => r.data),
  list: () => api.get('/referrals').then(r => r.data),
};

export default api;
