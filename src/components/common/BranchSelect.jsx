/**
 * BranchSelect — a branch (location) dropdown used by every accounting form and
 * report filter. Loads branches once and caches them at module scope so ten
 * forms on a page don't fire ten identical GETs. Realtime is NOT used: branch
 * metadata is admin-ish config; a refetch when the popup remounts is enough.
 *
 * Props:
 *   value      — selected branchId ('' = the "all/none" option)
 *   onChange   — (branchId) => void
 *   allowAll   — show an "All branches" option first (report filters)
 *   allLabel   — override that option's text (e.g. "All")
 *   style      — passthrough for the <select>
 */
import { useEffect, useState } from 'react';
import { accountingApi } from '../../services/api';

let cache = null; // [{ id, name, main }] — shared across mounts
let inflight = null;

function loadBranches() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = accountingApi.branches()
    .then((list) => { cache = list || []; return cache; })
    .catch(() => { cache = []; return cache; });
  return inflight;
}

export default function BranchSelect({ value, onChange, allowAll, allLabel, style }) {
  const [branches, setBranches] = useState(cache || []);

  useEffect(() => { loadBranches().then(setBranches); }, []);

  return (
    <select className="input" value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', padding: '5px 8px', fontSize: 13, ...(style || {}) }}>
      {allowAll && <option value="">{allLabel || 'All branches'}</option>}
      {!allowAll && <option value="">—</option>}
      {(branches || []).map((b) => (
        <option key={b.id} value={b.id}>{b.name}{b.main ? ' ⭐' : ''}</option>
      ))}
    </select>
  );
}
