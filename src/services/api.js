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

// ── Runaway-request safety net ────────────────────────────────────────────────
// A screen with an unstable useCallback dep (e.g. `t` from useT(), which is a
// fresh ref every render) re-fires its effect on every render and can hammer one
// endpoint hundreds of times a minute. That took the API down once already, so
// the client enforces two guarantees no single screen can bypass:
//
//   1. COALESCE — identical GETs already in flight share one network request.
//   2. CIRCUIT-BREAK — if the same GET repeats absurdly often in a short window,
//      stop calling the network for a cooldown and replay the last response.
//
// Correct code never reaches either path, and nothing is cached between normal
// calls, so this cannot serve stale data during ordinary use. The breaker logs
// loudly so the underlying render loop still gets found and fixed.
const LOOP_WINDOW_MS = 2000;   // how far back we count repeats
const LOOP_MAX_CALLS = 12;     // repeats of ONE endpoint in that window = a loop
const LOOP_COOLDOWN_MS = 5000; // how long to stop hitting the network after that

const inFlight = new Map();
const callTimes = new Map();
const lastOk = new Map();
const cooldownUntil = new Map();

const rawGet = api.get.bind(api);

api.get = (url, config) => {
  const key = url + (config?.params ? '?' + JSON.stringify(config.params) : '');
  const now = Date.now();

  // Breaker is open → replay the last good response instead of the network.
  const until = cooldownUntil.get(key) || 0;
  if (now < until && lastOk.has(key)) return Promise.resolve(lastOk.get(key));
  if (now >= until && until) cooldownUntil.delete(key);

  // Coalesce concurrent duplicates onto the single request already running.
  if (inFlight.has(key)) return inFlight.get(key);

  const times = (callTimes.get(key) || []).filter((ts) => now - ts < LOOP_WINDOW_MS);
  times.push(now);
  callTimes.set(key, times);

  if (times.length > LOOP_MAX_CALLS) {
    cooldownUntil.set(key, now + LOOP_COOLDOWN_MS);
    callTimes.set(key, []);
    console.error(
      `[api] Request loop detected on GET ${key} — ${times.length} calls in ` +
      `${LOOP_WINDOW_MS}ms. Pausing ${LOOP_COOLDOWN_MS}ms. A component is ` +
      're-fetching every render; check its useEffect/useCallback deps.'
    );
    if (lastOk.has(key)) return Promise.resolve(lastOk.get(key));
  }

  const p = rawGet(url, config)
    .then((res) => { lastOk.set(key, res); return res; })
    .finally(() => { inFlight.delete(key); });

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
  designerReject:   (id)    => api.post(`/orders/${id}/designer/reject`).then(r => r.data),
  designerReady:    (id)    => api.post(`/orders/${id}/designer/ready`).then(r => r.data),
  designerApproval: (id)    => api.post(`/orders/${id}/designer/client-approval`).then(r => r.data),
  designerWait:     (id, reason) => api.post(`/orders/${id}/designer/wait`, { reason }).then(r => r.data),
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
  createInvoice: (body)     => api.post('/accounting/invoice', body).then(r => r.data),
  recordPayment: (id, body) => api.post(`/accounting/invoice/${id}/payment`, body).then(r => r.data),
  ledger:        ()         => api.get('/accounting/ledger').then(r => r.data),
  pnl:           (params)   => api.get('/accounting/pnl', { params }).then(r => r.data),
  gstReport:     (params)   => api.get('/accounting/gst-report', { params }).then(r => r.data),
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
