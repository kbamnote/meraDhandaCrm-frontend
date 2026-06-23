/**
 * Production Steps — read-only kanban-ish board.
 * Subscribes to mpw/production, groups entries by `stage` (falling back to
 * `status`) and renders a column/card per group.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';

const S = {
  productionSteps: { en: 'Production Steps', hi: 'प्रोडक्शन स्टेप्स', hinglish: 'Production Steps', gu: 'પ્રોડક્શન સ્ટેપ્સ', mr: 'प्रोडक्शन स्टेप्स', mwr: 'प्रोडक्शन स्टेप्स' },
  itemOne: { en: 'item', hi: 'आइटम', hinglish: 'item', gu: 'આઇટમ', mr: 'आयटम', mwr: 'आइटम' },
  itemMany: { en: 'items', hi: 'आइटम', hinglish: 'items', gu: 'આઇટમ', mr: 'आयटम', mwr: 'आइटम' },
  across: { en: 'across', hi: 'में', hinglish: 'across', gu: 'માં', mr: 'मध्ये', mwr: 'में' },
  stageOne: { en: 'stage', hi: 'स्टेज', hinglish: 'stage', gu: 'સ્ટેજ', mr: 'टप्पा', mwr: 'स्टेज' },
  stageMany: { en: 'stages', hi: 'स्टेज', hinglish: 'stages', gu: 'સ્ટેજ', mr: 'टप्पे', mwr: 'स्टेज' },
  noEntries: { en: 'No production entries yet.', hi: 'अभी तक कोई प्रोडक्शन एंट्री नहीं।', hinglish: 'Abhi tak koi production entry nahi.', gu: 'હજુ સુધી કોઈ પ્રોડક્શન એન્ટ્રી નથી.', mr: 'अद्याप कोणतीही प्रोडक्शन नोंद नाही.', mwr: 'अजे तांई कोई प्रोडक्शन एंट्री कोनी।' },
};

const STATUS_BADGE = {
  pending: 'badge badge-amber',
  queued: 'badge badge-blue',
  in_progress: 'badge badge-blue',
  done: 'badge badge-green',
  complete: 'badge badge-green',
  blocked: 'badge badge-red',
};

function statusBadgeClass(status) {
  return STATUS_BADGE[String(status || '').toLowerCase()] || 'badge badge-blue';
}

export default function ProdStepsPage() {
  const t = useT(S);
  const [production, setProduction] = useState({});

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/production'), (snap) => setProduction(snap.val() || {}));
    return () => u();
  }, []);

  const entries = useMemo(
    () => Object.entries(production).map(([id, p]) => ({ ...p, id })),
    [production]
  );

  const groups = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      const key = e.stage || e.status || 'unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return Object.entries(map).map(([stage, items]) => ({ stage, items }));
  }, [entries]);

  return (
    <div data-legacy-id="page-prod-steps">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>⚙️ {t('productionSteps')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {entries.length} {entries.length === 1 ? t('itemOne') : t('itemMany')} {t('across')} {groups.length} {groups.length === 1 ? t('stageOne') : t('stageMany')}
        </div>
      </div>

      {!entries.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noEntries')}
        </div>
      ) : (
        <div className="flex gap-3" style={{ overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
          {groups.map((g) => (
            <div key={g.stage} style={{ minWidth: 240, flex: '0 0 240px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                {g.stage} ({g.items.length})
              </div>
              {g.items.map((it) => (
                <div key={it.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                    {it.job || it.title || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      👤 {it.operator || it.assignedTo || '—'}
                    </span>
                    {it.status && <span className={statusBadgeClass(it.status)}>{it.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
