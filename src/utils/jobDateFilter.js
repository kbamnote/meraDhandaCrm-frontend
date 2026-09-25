/**
 * Date filter for job lists (Job Cards). A job is matched on either the day it
 * was CREATED (createdAt, a timestamp) or its DELIVERY date (deliveryDate,
 * 'YYYY-MM-DD'). Dates are compared as local 'YYYY-MM-DD' strings, inclusive,
 * so "today" means today on the user's own calendar.
 */
const pad2 = (n) => String(n).padStart(2, '0');
export const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const DAY_RE = /^\d{4}-\d{2}-\d{2}/;

export const DATE_FIELDS = ['created', 'delivery'];
export const DATE_PRESETS = ['all', 'today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'custom'];

// { from, to } for a preset, relative to `today` ('YYYY-MM-DD'). 'all' → no
// limits; 'custom' → null (the caller supplies its own).
export function presetRange(kind, today) {
  const t = parseDay(today);
  const shift = (days) => { const d = new Date(t); d.setDate(d.getDate() + days); return isoDay(d); };
  switch (kind) {
    case 'all': return { from: '', to: '' };
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: shift(-1), to: shift(-1) };
    case 'last7': return { from: shift(-6), to: today };
    case 'thisMonth': return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
    case 'lastMonth': return {
      from: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
      to: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)),
    };
    default: return null;
  }
}

// The job's date for `field` as 'YYYY-MM-DD', or null when it has none.
export function jobDate(job, field) {
  if (!job) return null;
  if (field === 'delivery') {
    const v = String(job.deliveryDate || '');
    return DAY_RE.test(v) ? v.slice(0, 10) : null;
  }
  const c = job.createdAt;
  if (c == null || c === '') return null;
  const d = new Date(typeof c === 'number' || /^\d+$/.test(String(c)) ? Number(c) : c);
  return Number.isNaN(d.getTime()) ? null : isoDay(d);
}

// Inclusive; an empty from/to is open-ended. With any limit set, a job with
// no date for the field is left out (it can't be placed in the range).
export function inDateRange(job, field, from, to) {
  if (!from && !to) return true;
  const d = jobDate(job, field);
  if (!d) return false;
  return (!from || d >= from) && (!to || d <= to);
}
