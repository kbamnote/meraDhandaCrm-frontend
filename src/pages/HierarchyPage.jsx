/**
 * HierarchyPage — Interactive org-chart tree.
 *
 * - Builds a proper parent→children tree from the `reportsTo` field on each user.
 * - Users with no `reportsTo` (or a broken reference) sit at the root level.
 * - Admins can DRAG any node and DROP it onto another node to reassign that
 *   person's manager (calls authApi.updateUser with the new reportsTo).
 * - Dropping onto the root "strip" clears the manager.
 * - Uses native HTML5 drag-and-drop — zero extra dependencies.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { showToast } from '../components/common/toast';

/* ─── translations ─────────────────────────────────────────────────────────── */
const S = {
  orgHierarchy:  { en: '🏢 Org Hierarchy',   hi: '🏢 संगठन पदानुक्रम', hinglish: '🏢 Org Hierarchy', gu: '🏢 સંસ્થા પદાનુક્રમ', mr: '🏢 संस्था उतरंड',        mwr: '🏢 संगठन पदानुक्रम' },
  person:        { en: 'person',              hi: 'व्यक्ति',           hinglish: 'person',          gu: 'વ્યક્તિ',              mr: 'व्यक्ती',              mwr: 'व्यक्ति' },
  people:        { en: 'people',              hi: 'लोग',              hinglish: 'people',          gu: 'લોકો',                mr: 'लोक',                  mwr: 'लोग' },
  noUsers:       { en: 'No users yet.',       hi: 'अभी कोई यूज़र नहीं।', hinglish: 'No users yet.',  gu: 'હજુ કોઈ યૂઝર નથી.', mr: 'अद्याप युझर नाहीत.',    mwr: 'अजे कोई यूज़र कोनी।' },
  reportsTo:     { en: 'Reports to',          hi: 'रिपोर्ट करता है',  hinglish: 'Reports to',      gu: 'રિપોર્ટ કરે',         mr: 'रिपोर्ट करतो',         mwr: 'रिपोर्ट करै' },
  noManager:     { en: '— No manager —',      hi: '— कोई मैनेजर नहीं —', hinglish: '— No manager —', gu: '— મેનેજર નહીં —',    mr: '— मॅनेजर नाही —',      mwr: '— कोई मैनेजर कोनी —' },
  managerSaved:  { en: 'Manager updated',     hi: 'मैनेजर अपडेट हो गया', hinglish: 'Manager updated', gu: 'મેનેજર અપડેટ થયો',  mr: 'मॅनेजर अपडेट झाला',    mwr: 'मैनेजर अपडेट हो ग्यो' },
  failed:        { en: 'Failed',              hi: 'नहीं हुआ',         hinglish: 'Failed',          gu: 'નિષ્ફળ',              mr: 'अयशस्वी',              mwr: 'कोनी हुयो' },
  dragHint:      { en: 'Drag a card onto another to reassign reporting line', hi: 'रिपोर्टिंग बदलने के लिए कार्ड को दूसरे पर खींचें', hinglish: 'Reporting change karne ke liye card drag karein', gu: 'રિપોર્ટિંગ બદલવા કાર્ડ ખેંચો', mr: 'रिपोर्टिंग बदलण्यासाठी कार्ड ड्रॅग करा', mwr: 'रिपोर्टिंग बदलण खातर कार्ड खींचो' },
  rootDrop:      { en: 'Drop here to remove manager', hi: 'यहाँ छोड़ें — मैनेजर हटाएं', hinglish: 'Yahan drop karein — manager hatayein', gu: 'અહીં છોડો — મેનેજર હટાવો', mr: 'येथे सोडा — मॅनेजर काढा', mwr: 'इठे छोड़ो — मैनेजर हटावो' },
  pending:       { en: 'pending', hi: 'पेंडिंग', hinglish: 'pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
};

/* ─── role → badge colour ─────────────────────────────────────────────────── */
const ROLE_COLOR = {
  owner: '#dc2626', superadmin: '#dc2626', admin: '#dc2626',
  manager: '#d97706', floor_manager: '#d97706', hr: '#d97706',
  designer: '#2563eb', jobsetter: '#2563eb', sales: '#2563eb',
  accountant: '#7c3aed', cashier: '#7c3aed', inventory: '#7c3aed',
  staff: '#059669', viewer: '#059669', pending: '#9ca3af',
};
const roleColor = (r) => ROLE_COLOR[r] || '#6b7280';

/* ─── avatar initials ─────────────────────────────────────────────────────── */
function initials(name, email) {
  const src = name || email || '?';
  return src.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/* ─── build tree from flat user list ─────────────────────────────────────── */
function buildTree(usersObj) {
  const byId = {};
  Object.entries(usersObj).forEach(([id, u]) => {
    byId[id] = { ...u, id, children: [] };
  });
  const roots = [];
  Object.values(byId).forEach((node) => {
    const parentId = node.reportsTo;
    if (parentId && byId[parentId]) {
      byId[parentId].children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Sort each level by name
  const sort = (nodes) => {
    nodes.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/* ─── single tree node card ───────────────────────────────────────────────── */
function TreeNode({ node, depth, canEdit, onDrop, dragId, setDragId, saving }) {
  const [collapsed, setCollapsed] = useState(false);
  const [over, setOver] = useState(false);
  const isDragging = dragId === node.id;
  const isTarget  = over && dragId && dragId !== node.id;

  const handleDragStart = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    setDragId(node.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
  };
  const handleDragOver = (e) => {
    if (!canEdit || !dragId || dragId === node.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setOver(true);
  };
  const handleDragLeave = (e) => {
    e.stopPropagation();
    setOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    if (!dragId || dragId === node.id) return;
    onDrop(dragId, node.id);
  };

  const cardStyle = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    background: isTarget
      ? 'var(--primary-light, #eff6ff)'
      : 'var(--surface)',
    border: isTarget
      ? '2px dashed var(--primary)'
      : `1px solid ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 8,
    cursor: canEdit ? 'grab' : 'default',
    opacity: isDragging ? 0.45 : 1,
    transition: 'border-color .15s, background .15s, opacity .15s',
    boxShadow: isTarget
      ? '0 0 0 4px rgba(59,130,246,.18)'
      : '0 1px 2px rgba(0,0,0,.04)',
    userSelect: 'none',
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 32 : 0, position: 'relative' }}>
      {/* ── branch line from parent ── */}
      {depth > 0 && (
        <div style={{
          position: 'absolute', left: -20, top: 24, width: 16, height: 2, background: 'var(--border)',
        }} />
      )}
      {depth > 0 && (
        <div style={{
          position: 'absolute', left: -20, top: -8, width: 2, bottom: 24, background: 'var(--border)',
        }} />
      )}

      {/* ── card ── */}
      <div
        draggable={canEdit}
        onDragStart={handleDragStart}
        onDragEnd={() => setDragId(null)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={cardStyle}
        title={canEdit ? 'Drag to reassign manager' : ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          {/* avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: `${roleColor(node.role)}22`,
            border: `1px solid ${roleColor(node.role)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: roleColor(node.role),
          }}>
            {initials(node.name, node.email)}
          </div>
          {/* info */}
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {node.name || node.email || node.id}
            </div>
            {(node.email && node.name || node.department) && (
              <div style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.email && node.name ? node.email : node.department || ''}
              </div>
            )}
            
            {/* badges */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: .4, textTransform: 'uppercase',
                background: `${roleColor(node.role)}22`, color: roleColor(node.role),
                borderRadius: 4, padding: '2px 6px',
              }}>
                {node.role || 'pending'}
              </span>
              {node.customRole && (
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: .4, textTransform: 'uppercase',
                  background: 'var(--surface2)', color: 'var(--text2)',
                  borderRadius: 4, padding: '2px 6px',
                }}>
                  {node.customRole}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* collapse toggle if there are children */}
        {node.children.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
            style={{
              marginLeft: 12, width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--surface2)', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)',
            }}
          >
            {collapsed ? '+' : '−'}
          </button>
        )}
      </div>

      {/* ── children branch ── */}
      {!collapsed && node.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              canEdit={canEdit}
              onDrop={onDrop}
              dragId={dragId}
              setDragId={setDragId}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function HierarchyPage() {
  const t = useT(S);
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'superadmin', 'owner');

  const [usersObj, setUsersObj] = useState({});
  const [dragId, setDragId]     = useState(null);
  const [saving, setSaving]     = useState(false);
  const [rootOver, setRootOver] = useState(false);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsersObj(snap.val() || {}));
    return () => u();
  }, []);

  const roots = useMemo(() => buildTree(usersObj), [usersObj]);
  const totalUsers = Object.keys(usersObj).length;

  const onDrop = useCallback(async (movedId, newParentId) => {
    // Guard against circular ref — don't allow dropping onto own descendant.
    const isDescendant = (nodeId, ancestorId, obj) => {
      if (!nodeId || !obj[nodeId]) return false;
      if (nodeId === ancestorId) return true;
      return isDescendant(obj[nodeId]?.reportsTo, ancestorId, obj);
    };
    if (isDescendant(newParentId, movedId, usersObj)) {
      showToast('Cannot move a manager under their own report — circular hierarchy!', 'error');
      return;
    }
    setSaving(true);
    try {
      await authApi.updateUser(movedId, { reportsTo: newParentId || null });
      showToast(t('managerSaved'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setSaving(false); }
  }, [usersObj, t]);

  // Drop onto root zone → clear manager
  const handleRootDrop = (e) => {
    e.preventDefault();
    setRootOver(false);
    if (!dragId) return;
    onDrop(dragId, null);
  };

  return (
    <div data-legacy-id="page-hierarchy" style={{ minHeight: '60vh' }}>
      {/* header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t('orgHierarchy')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>
            {totalUsers} {totalUsers === 1 ? t('person') : t('people')}
          </span>
          {saving && (
            <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
              ⏳ Saving…
            </span>
          )}
          {canEdit && (
            <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
              💡 {t('dragHint')}
            </span>
          )}
        </div>
      </div>

      {!totalUsers ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noUsers')}
        </div>
      ) : (
        <>
          {/* ── root drop zone (clear manager) ── */}
          {canEdit && dragId && (
            <div
              onDragOver={(e) => { e.preventDefault(); setRootOver(true); }}
              onDragLeave={() => setRootOver(false)}
              onDrop={handleRootDrop}
              style={{
                border: `2px dashed ${rootOver ? 'var(--primary)' : 'var(--border)'}`,
                background: rootOver ? 'var(--primary-light, #eff6ff)' : 'transparent',
                borderRadius: 10, padding: '10px 20px', marginBottom: 20,
                textAlign: 'center', fontSize: 13, color: rootOver ? 'var(--primary)' : 'var(--text3)',
                transition: 'all .15s',
              }}
            >
              🗂 {t('rootDrop')}
            </div>
          )}

          {/* ── vertical tree canvas ── */}
          <div style={{ paddingBottom: 40, maxWidth: 900 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {roots.map((root) => (
                <TreeNode
                  key={root.id}
                  node={root}
                  depth={0}
                  canEdit={canEdit}
                  onDrop={onDrop}
                  dragId={dragId}
                  setDragId={setDragId}
                  saving={saving}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
