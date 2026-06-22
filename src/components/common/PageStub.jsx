/**
 * PageStub — placeholder used by every page that is not yet fully ported
 * from the legacy single-file HTML.
 *
 * Each stub:
 *   - Preserves the legacy page id (`data-legacy-id`) so a developer can
 *     grep the original HTML for "page-xxx" and find the source code.
 *   - Optionally subscribes to a Firebase Realtime DB path and shows a raw
 *     JSON dump of the current data, so the developer immediately sees the
 *     shape of records they need to render.
 *
 * To finish porting a page:
 *   1. Open  legacy/original.html  and search for  id="page-xxxx".
 *   2. Find the matching `function refreshXxxx()` / render code further down.
 *   3. Re-create the JSX using the pattern in TasksPage.jsx.
 *   4. Replace <PageStub … /> in App.jsx with your real component.
 */
import { useEffect, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';

export default function PageStub({ title, legacyId, dbPath, hint }) {
  const [data, setData] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!dbPath) return;
    const r = ref(db, dbPath);
    const unsub = onValue(r, (snap) => {
      const v = snap.val();
      setData(v);
      setCount(v ? Object.keys(v).length : 0);
    });
    return () => unsub();
  }, [dbPath]);

  return (
    <div data-legacy-id={legacyId}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Legacy id: <code>{legacyId}</code>
            {dbPath && <> · DB: <code>{dbPath}</code> · {count} records</>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, background: 'var(--amber-light)', borderColor: 'var(--amber)' }}>
        <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>
          🚧 Page not yet ported
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {hint || (
            <>Find <code>id="{legacyId}"</code> in <code>legacy/original.html</code>,
              then re-implement using the same pattern as <code>TasksPage.jsx</code>.</>
          )}
        </div>
      </div>

      {dbPath && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>
            Live preview — first 3 records from <code>{dbPath}</code>:
          </div>
          <pre style={{ fontSize: 11, fontFamily: 'var(--mono)', overflow: 'auto', maxHeight: 320, background: 'var(--surface2)', padding: 12, borderRadius: 6 }}>
            {data
              ? JSON.stringify(Object.fromEntries(Object.entries(data).slice(0, 3)), null, 2)
              : '(no data yet)'}
          </pre>
        </div>
      )}
    </div>
  );
}
