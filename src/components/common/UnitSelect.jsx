/**
 * What a line is measured in — on a bill, a job card and anywhere else a
 * line is priced.
 *
 * A print shop quotes in more than the obvious units: the job sheet this was
 * built from uses Inch, Sqft, Sqft/Pcs, Sqft/Pcs/Min and Pcs/Other-Typing on
 * one page. So the four defaults are a starting point, and anything the shop
 * adds is saved and offered from then on — which is the whole point of a
 * picker over a free-text box, where the same unit gets spelled three ways
 * and the reports can never group by it.
 *
 * The list is fetched ONCE per page, not once per line: a bill with twenty
 * lines would otherwise fire twenty identical requests on open. Every mounted
 * picker subscribes to the one copy, so a unit added on line 3 appears on
 * line 11 without a reload.
 */
import { useEffect, useState } from 'react';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from './toast';

// Shown before the list arrives, and if it never does — a bill must still be
// writable when the network is having a bad morning. Kept in step with
// DEFAULT_UNITS in the accounting routes.
export const DEFAULT_UNITS = ['Sqft', 'Inch', 'Pcs', 'Other'];

const ADD_NEW = '__add_unit__';

// ── The one shared copy ────────────────────────────────────────────────────
let cache = null;          // string[] once loaded
let inFlight = null;       // the request everyone waits on
const listeners = new Set();

const publish = (list) => {
  cache = list;
  listeners.forEach((fn) => fn(list));
};

function loadUnits() {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = accountingApi.units()
      .then((r) => {
        const names = (r && Array.isArray(r.units) ? r.units : [])
          .map((u) => String((u && u.name) || '').trim())
          .filter(Boolean);
        publish(names.length ? names : DEFAULT_UNITS);
        return cache;
      })
      .catch(() => {
        // Not fatal and not worth a toast on every line: the defaults cover
        // the common cases and the box is still a box.
        publish(DEFAULT_UNITS);
        return cache;
      })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

/** Forget the shared copy. Exported for tests, which mount many of these. */
export function resetUnitCache() {
  cache = null;
  inFlight = null;
  listeners.clear();
}

export default function UnitSelect({ value, onChange, testId = 'unit-select', style }) {
  const [units, setUnits] = useState(cache || DEFAULT_UNITS);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listeners.add(setUnits);
    loadUnits();
    return () => listeners.delete(setUnits);
  }, []);

  // A unit already on the line but not on the list — a bill written before
  // the picker existed, or one typed on another device. Offered rather than
  // silently swapped for a blank, which would quietly change what was billed.
  const current = String(value || '').trim();
  const known = units.some((u) => u.toLowerCase() === current.toLowerCase());
  const options = current && !known ? [current, ...units] : units;

  const save = async () => {
    const name = draft.trim();
    if (!name) { setAdding(false); setDraft(''); return; }
    setSaving(true);
    try {
      const r = await accountingApi.addUnit(name);
      const saved = (r && r.name) || name;
      // Straight onto every other line's picker, not just this one.
      if (!cache || !cache.some((u) => u.toLowerCase() === saved.toLowerCase())) {
        publish([...(cache || DEFAULT_UNITS), saved]);
      }
      onChange(saved);
      setAdding(false);
      setDraft('');
    } catch (e) {
      showToast(describeError(e, 'Could not save that unit'), 'error');
    } finally { setSaving(false); }
  };

  if (adding) {
    return (
      <input
        className="input" data-testid={`${testId}-new`} autoFocus disabled={saving}
        style={{ fontSize: 12, ...style }}
        placeholder="e.g. Sqft/Pcs"
        title="Saved to this shop's units, and offered from now on"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setAdding(false); setDraft(''); }
        }}
        onBlur={save}
      />
    );
  }

  return (
    <select
      className="input" data-testid={testId} style={{ fontSize: 12, ...style }}
      title="What this line is measured in"
      value={current}
      onChange={(e) => {
        if (e.target.value === ADD_NEW) { setAdding(true); setDraft(''); return; }
        onChange(e.target.value);
      }}
    >
      <option value="">Unit</option>
      {options.map((u) => <option key={u} value={u}>{u}</option>)}
      <option value={ADD_NEW}>+ Add unit…</option>
    </select>
  );
}
