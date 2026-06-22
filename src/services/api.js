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
  requestOtp: (phone)            => api.post('/auth/request-otp', { phone }).then(r => r.data),
  verifyOtp:  (phone, code, name)=> api.post('/auth/verify-otp', { phone, code, name }).then(r => r.data),
  me:         ()                 => api.get('/auth/me').then(r => r.data),
  bootstrap:  (body = {})        => api.post('/auth/bootstrap', body).then(r => r.data),
  setRole:    (uid, b)           => api.patch(`/auth/users/${uid}/role`, b).then(r => r.data),
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

export const chatApi = {
  messages:    (convId)   => api.get(`/chat/messages/${convId}`).then(r => r.data),
  send:        (body)     => api.post('/chat/messages', body).then(r => r.data),
  groups:      ()         => api.get('/chat/groups').then(r => r.data),
  createGroup: (body)     => api.post('/chat/groups', body).then(r => r.data),
  updateGroup: (id, body) => api.patch(`/chat/groups/${id}`, body).then(r => r.data),
};

export default api;
