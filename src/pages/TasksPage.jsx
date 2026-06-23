/**
 * Tasks page — REFERENCE PORT.
 *
 * This page is intentionally fully implemented (not a stub) so your developer
 * can copy the pattern when porting the remaining 49 legacy pages:
 *
 *   1. Subscribe to a Firebase Realtime DB path via `onValue` (real-time).
 *   2. Mirror the legacy filter/sort logic that lived inside refreshTasks().
 *   3. Use dbApi.create / dbApi.update / dbApi.remove for writes — these go
 *      through the Node backend so all role checks happen server-side.
 *   4. Custom roles ("CustomRolesInTaskAssign"): the assignee dropdown shows
 *      both built-in roles and any custom role names that appear on user docs.
 */

import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const PRIORITY_ORDER = { most_urgent: 0, urgent: 1, normal: 2 };
const PRIORITY_LABEL = { most_urgent: '🔴 MOST URGENT', urgent: '⚡ Urgent', normal: '' };
const PRIORITY_BG    = { most_urgent: '#DC2626', urgent: '#F59E0B', normal: '' };

const S = {
  taskManager: { en: 'Task Manager', hi: 'टास्क मैनेजर', hinglish: 'Task Manager', gu: 'ટાસ્ક મેનેજર', mr: 'टास्क मॅनेजर', mwr: 'टास्क मैनेजर' },
  active: { en: 'active', hi: 'एक्टिव', hinglish: 'active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },
  overdue: { en: 'overdue', hi: 'ओवरड्यू', hinglish: 'overdue', gu: 'ઓવરડ્યૂ', mr: 'मुदत संपली', mwr: 'ओवरड्यू' },
  done: { en: 'done', hi: 'पूरा', hinglish: 'done', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरो' },
  newTask: { en: '+ New Task', hi: '+ नया टास्क', hinglish: '+ Naya Task', gu: '+ નવો ટાસ્ક', mr: '+ नवीन टास्क', mwr: '+ नयो टास्क' },
  searchTasks: { en: '🔍 Search tasks...', hi: '🔍 टास्क खोजें...', hinglish: '🔍 Task search karein...', gu: '🔍 ટાસ્ક શોધો...', mr: '🔍 टास्क शोधा...', mwr: '🔍 टास्क ढूंढो...' },
  noTasks: { en: 'No tasks yet.', hi: 'अभी तक कोई टास्क नहीं।', hinglish: 'Abhi tak koi task nahi.', gu: 'હજુ સુધી કોઈ ટાસ્ક નથી.', mr: 'अद्याप कोणतेही टास्क नाहीत.', mwr: 'अजे तांई कोई टास्क कोनी।' },
  activeLabel: { en: 'Active', hi: 'एक्टिव', hinglish: 'Active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },
  doneLabel: { en: 'Done', hi: 'पूरे', hinglish: 'Done', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरा' },
  taskMarkedDone: { en: 'Task marked done', hi: 'टास्क पूरा हो गया', hinglish: 'Task done ho gaya', gu: 'ટાસ્ક પૂર્ણ થયો', mr: 'टास्क पूर्ण झाले', mwr: 'टास्क पूरो हो ग्यो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  confirmDeletePrefix: { en: 'Delete task', hi: 'क्या टास्क', hinglish: 'Kya task', gu: 'ટાસ્ક', mr: 'टास्क', mwr: 'टास्क' },
  confirmDeleteSuffix: { en: '?', hi: 'डिलीट करें?', hinglish: 'delete karein?', gu: 'ડિલીટ કરવો?', mr: 'डिलीट करायचे?', mwr: 'डिलीट करां?' },
  taskDeleted: { en: 'Task deleted', hi: 'टास्क डिलीट हो गया', hinglish: 'Task delete ho gaya', gu: 'ટાસ્ક ડિલીટ થયો', mr: 'टास्क डिलीट झाले', mwr: 'टास्क डिलीट हो ग्यो' },
  overdueBadge: { en: 'OVERDUE', hi: 'ओवरड्यू', hinglish: 'OVERDUE', gu: 'ઓવરડ્યૂ', mr: 'मुदत संपली', mwr: 'ओवरड्यू' },
  dueIn: { en: 'Due in', hi: 'बाकी', hinglish: 'Due in', gu: 'બાકી', mr: 'उरले', mwr: 'बाकी' },
  doneBadge: { en: 'Done', hi: 'पूरा', hinglish: 'Done', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरो' },
  noDeadline: { en: 'No deadline', hi: 'कोई डेडलाइन नहीं', hinglish: 'Koi deadline nahi', gu: 'કોઈ ડેડલાઇન નથી', mr: 'डेडलाइन नाही', mwr: 'कोई डेडलाइन कोनी' },
  by: { en: 'By:', hi: 'द्वारा:', hinglish: 'By:', gu: 'દ્વારા:', mr: 'द्वारा:', mwr: 'द्वारा:' },
  role: { en: 'Role:', hi: 'रोल:', hinglish: 'Role:', gu: 'રોલ:', mr: 'भूमिका:', mwr: 'रोल:' },
  markDone: { en: 'Mark Done', hi: 'पूरा करें', hinglish: 'Mark Done', gu: 'પૂર્ણ કરો', mr: 'पूर्ण करा', mwr: 'पूरो करो' },
  delete: { en: 'Delete', hi: 'डिलीट करें', hinglish: 'Delete karein', gu: 'ડિલીટ કરો', mr: 'डिलीट करा', mwr: 'डिलीट करो' },
  titleRequired: { en: 'Title required', hi: 'टाइटल ज़रूरी है', hinglish: 'Title zaroori hai', gu: 'ટાઇટલ જરૂરી છે', mr: 'शीर्षक आवश्यक', mwr: 'टाइटल जरूरी है' },
  pickAssignee: { en: 'Pick an assignee', hi: 'किसी को चुनें', hinglish: 'Kisi ko chunein', gu: 'કોઈને પસંદ કરો', mr: 'नियुक्त व्यक्ती निवडा', mwr: 'किणी ने चुणो' },
  pickRole: { en: 'Pick a role', hi: 'रोल चुनें', hinglish: 'Role chunein', gu: 'રોલ પસંદ કરો', mr: 'भूमिका निवडा', mwr: 'रोल चुणो' },
  taskCreated: { en: 'Task created', hi: 'टास्क बन गया', hinglish: 'Task ban gaya', gu: 'ટાસ્ક બન્યો', mr: 'टास्क तयार झाले', mwr: 'टास्क बण ग्यो' },
  createFailed: { en: 'Failed to create task', hi: 'टास्क नहीं बना', hinglish: 'Task nahi bana', gu: 'ટાસ્ક બનાવવામાં નિષ્ફળ', mr: 'टास्क तयार करता आले नाही', mwr: 'टास्क कोनी बण्यो' },
  title: { en: 'Title', hi: 'टाइटल', hinglish: 'Title', gu: 'ટાઇટલ', mr: 'शीर्षक', mwr: 'टाइटल' },
  description: { en: 'Description', hi: 'विवरण', hinglish: 'Description', gu: 'વર્ણન', mr: 'वर्णन', mwr: 'विवरण' },
  priority: { en: 'Priority', hi: 'प्राथमिकता', hinglish: 'Priority', gu: 'પ્રાયોરિટી', mr: 'प्राधान्य', mwr: 'प्राथमिकता' },
  normal: { en: 'Normal', hi: 'सामान्य', hinglish: 'Normal', gu: 'સામાન્ય', mr: 'सामान्य', mwr: 'सामान्य' },
  urgent: { en: '⚡ Urgent', hi: '⚡ अर्जेंट', hinglish: '⚡ Urgent', gu: '⚡ અર્જન્ટ', mr: '⚡ तातडीचे', mwr: '⚡ अर्जेंट' },
  mostUrgent: { en: '🔴 Most Urgent', hi: '🔴 सबसे अर्जेंट', hinglish: '🔴 Most Urgent', gu: '🔴 સૌથી અર્જન્ટ', mr: '🔴 सर्वात तातडीचे', mwr: '🔴 सबसूं अर्जेंट' },
  jobRef: { en: 'Job ref', hi: 'जॉब रेफ', hinglish: 'Job ref', gu: 'જોબ રેફ', mr: 'जॉब रेफ', mwr: 'जॉब रेफ' },
  deadlineDate: { en: 'Deadline date', hi: 'डेडलाइन तारीख', hinglish: 'Deadline date', gu: 'ડેડલાઇન તારીખ', mr: 'डेडलाइन तारीख', mwr: 'डेडलाइन तारीख' },
  time: { en: 'Time', hi: 'समय', hinglish: 'Time', gu: 'સમય', mr: 'वेळ', mwr: 'टैम' },
  assignTo: { en: 'Assign to', hi: 'किसे सौंपें', hinglish: 'Kise assign karein', gu: 'કોને સોંપો', mr: 'कोणाला द्या', mwr: 'किणने सौंपो' },
  specificUser: { en: 'Specific user', hi: 'किसी यूज़र को', hinglish: 'Specific user', gu: 'ચોક્કસ યૂઝર', mr: 'विशिष्ट युझर', mwr: 'खास यूज़र' },
  roleBtn: { en: 'Role (custom roles supported)', hi: 'रोल (कस्टम रोल भी)', hinglish: 'Role (custom roles supported)', gu: 'રોલ (કસ્ટમ રોલ સપોર્ટેડ)', mr: 'भूमिका (कस्टम भूमिका समर्थित)', mwr: 'रोल (कस्टम रोल भी)' },
  chooseRole: { en: '-- choose role --', hi: '-- रोल चुनें --', hinglish: '-- role chunein --', gu: '-- રોલ પસંદ કરો --', mr: '-- भूमिका निवडा --', mwr: '-- रोल चुणो --' },
  tip: { en: 'Tip: role-based assignment notifies every user with that role or customRole.', hi: 'टिप: रोल-आधारित असाइनमेंट उस रोल या customRole वाले हर यूज़र को सूचना भेजता है।', hinglish: 'Tip: role-based assignment us role ya customRole wale har user ko notify karta hai.', gu: 'ટિપ: રોલ-આધારિત અસાઇનમેન્ટ તે રોલ અથવા customRole ધરાવતા દરેક યૂઝરને નોટિફાય કરે છે.', mr: 'टिप: भूमिका-आधारित नियुक्ती त्या भूमिकेच्या किंवा customRole असलेल्या प्रत्येक युझरला सूचित करते.', mwr: 'टिप: रोल-आधारित असाइनमेंट उण रोल या customRole वाला हर यूज़र ने सूचना भेजे है।' },
  saving: { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Save ho raha hai…', gu: 'સેવ થઈ રહ્યું છે…', mr: 'सेव होत आहे…', mwr: 'सेव हो रियो है…' },
  createTask: { en: 'Create task', hi: 'टास्क बनाएं', hinglish: 'Task banayein', gu: 'ટાસ્ક બનાવો', mr: 'टास्क तयार करा', mwr: 'टास्क बणावो' },
  cancel: { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel karein', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  chooseOpt: { en: '-- choose --', hi: '-- चुनें --', hinglish: '-- chunein --', gu: '-- પસંદ કરો --', mr: '-- निवडा --', mwr: '-- चुणो --' },
};

function getDeadlineMs(t) {
  try {
    if (!t.deadlineDate) return 0;
    const iso = t.deadlineDate + (t.deadlineTime ? 'T' + t.deadlineTime : '');
    return new Date(iso).getTime();
  } catch { return 0; }
}

export default function TasksPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [tasks, setTasks] = useState({});      // { id: task }
  const [users, setUsers] = useState({});      // { uid: user }
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const isAdmin = ['admin', 'manager', 'floor_manager', 'superadmin', 'owner'].includes(profile?.role);
  const canSeeAll = isAdmin || profile?.permissions?.manage_tasks;

  // Real-time subscriptions — same pattern the legacy file used.
  useEffect(() => {
    const tasksRef = ref(db, 'mpw/tasks');
    const usersRef = ref(db, 'mpw/users');
    const u1 = onValue(tasksRef, (snap) => setTasks(snap.val() || {}));
    const u2 = onValue(usersRef, (snap) => setUsers(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(
    () => Object.entries(tasks).map(([id, t]) => ({ ...t, id })),
    [tasks]
  );

  const visible = useMemo(() => {
    if (canSeeAll) return all;
    const myKey = profile?.id;
    return all.filter(t => t.assignedTo === myKey || t.createdBy === myKey);
  }, [all, canSeeAll, profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.assignedToName || '').toLowerCase().includes(q) ||
      (t.jobRef || '').toLowerCase().includes(q)
    );
  }, [visible, search]);

  const now = Date.now();
  const active   = filtered.filter(t => t.status !== 'done');
  const overdue  = active.filter(t => { const dl = getDeadlineMs(t); return dl && dl < now; });
  const upcoming = active.filter(t => { const dl = getDeadlineMs(t); return !dl || dl >= now; });
  const done     = filtered.filter(t => t.status === 'done');

  const sortedActive = [
    ...overdue.sort((a, b) => getDeadlineMs(a) - getDeadlineMs(b)),
    ...upcoming.sort((a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    ),
  ];

  const completeTask = async (task) => {
    try {
      await dbApi.update('tasks', task.id, { status: 'done', completedTs: Date.now() });
      showToast(t('taskMarkedDone'), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const removeTask = async (task) => {
    if (!confirm(`${t('confirmDeletePrefix')} "${task.title}" ${t('confirmDeleteSuffix')}`)) return;
    try {
      await dbApi.remove('tasks', task.id);
      showToast(t('taskDeleted'), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>📋 {t('taskManager')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {active.length} {t('active')} · {overdue.length} {t('overdue')} · {done.length} {t('done')}
          </div>
        </div>
        {canSeeAll && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            {t('newTask')}
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder={t('searchTasks')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noTasks')}
        </div>
      )}

      {!!sortedActive.length && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '8px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {t('activeLabel')} ({sortedActive.length})
        </div>
      )}
      {sortedActive.map(t => (
        <TaskCard key={t.id} t={t} now={now} onComplete={completeTask} onDelete={removeTask} canManage={canSeeAll} />
      ))}

      {!!done.length && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {t('doneLabel')} ({done.length})
        </div>
      )}
      {done.map(t => (
        <TaskCard key={t.id} t={t} now={now} onDelete={removeTask} canManage={canSeeAll} />
      ))}

      {showNew && (
        <NewTaskModal users={users} onClose={() => setShowNew(false)} createdBy={profile?.id} />
      )}
    </div>
  );
}

function TaskCard({ t, now, onComplete, onDelete, canManage }) {
  const tr = useT(S);
  const dlMs = getDeadlineMs(t);
  const isOverdue = dlMs && dlMs < now && t.status !== 'done';
  const isDueSoon = dlMs && dlMs - now < 3600000 && dlMs > now;
  const minutesLeft = dlMs ? Math.max(0, Math.round((dlMs - now) / 60000)) : 0;
  const dl = (t.deadlineDate || '') + (t.deadlineTime ? ' ' + t.deadlineTime : '');
  const borderColor =
    isOverdue ? 'var(--red)'
    : isDueSoon ? 'var(--amber)'
    : t.priority === 'most_urgent' ? '#DC2626'
    : t.priority === 'urgent' ? '#F59E0B'
    : 'var(--border)';

  return (
    <div className="card" style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
          {t.description && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRIORITY_LABEL[t.priority] && (
            <span style={{ background: PRIORITY_BG[t.priority], color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>
              {PRIORITY_LABEL[t.priority]}
            </span>
          )}
          {isOverdue && <span className="badge badge-red">⚠️ {tr('overdueBadge')}</span>}
          {isDueSoon && <span className="badge badge-amber">⏰ {tr('dueIn')} {minutesLeft}m</span>}
          {t.status === 'done' && <span className="badge badge-green">✓ {tr('doneBadge')}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        <span>👤 <b style={{ color: 'var(--text2)' }}>{t.assignedToName || t.assignedTo}</b></span>
        <span>📅 <b style={{ color: isOverdue ? 'var(--red)' : 'var(--text2)' }}>{dl || tr('noDeadline')}</b></span>
        {t.jobRef && <span>🔗 {t.jobRef}</span>}
        <span>{tr('by')} {t.createdByName || t.createdBy}</span>
        {t.assignedRole && <span className="badge badge-blue">{tr('role')} {t.assignedRole}</span>}
      </div>

      <div className="flex gap-2">
        {t.status !== 'done' && onComplete && (
          <button className="btn btn-success btn-xs" onClick={() => onComplete(t)}>{tr('markDone')}</button>
        )}
        {canManage && (
          <button className="btn btn-danger btn-xs" onClick={() => onDelete(t)}>{tr('delete')}</button>
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ users, onClose, createdBy }) {
  const t = useT(S);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [assignMode, setAssignMode] = useState('user');     // 'user' | 'role'
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [jobRef, setJobRef] = useState('');
  const [busy, setBusy] = useState(false);

  const userList = Object.entries(users).map(([uid, u]) => ({ uid, ...u }));

  // CustomRolesInTaskAssign: gather every role string seen on users (built-in + custom).
  const allRoles = useMemo(() => {
    const set = new Set();
    userList.forEach(u => {
      if (u.role && u.role !== 'pending') set.add(u.role);
      if (u.customRole) set.add(u.customRole);
    });
    return [...set].sort();
  }, [userList]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return showToast(t('titleRequired'), 'error');

    let assignedToFinal = null, assignedToName = null, assignedRoleFinal = null;
    if (assignMode === 'user') {
      if (!assignedTo) return showToast(t('pickAssignee'), 'error');
      const u = users[assignedTo];
      assignedToFinal = assignedTo;
      assignedToName = u?.name || u?.phone || assignedTo;
    } else {
      if (!assignedRole) return showToast('Pick a role', 'error');
      assignedRoleFinal = assignedRole;
      assignedToName = `(role) ${assignedRole}`;
    }

    setBusy(true);
    try {
      await dbApi.create('tasks', {
        title: title.trim(),
        description: description.trim(),
        priority,
        deadlineDate, deadlineTime,
        assignedTo: assignedToFinal,
        assignedToName,
        assignedRole: assignedRoleFinal,
        jobRef: jobRef.trim() || null,
        status: 'pending',
        createdBy,
        assignedAt: new Date().toISOString(),
      });
      showToast('Task created', 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create task', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>+ New Task</h3>

        <div className="form-group">
          <label>Title *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="urgent">⚡ Urgent</option>
              <option value="most_urgent">🔴 Most Urgent</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Job ref</label>
            <input className="input" value={jobRef} onChange={(e) => setJobRef(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Deadline date</label>
            <input className="input" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Time</label>
            <input className="input" type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Assign to</label>
          <div className="flex gap-2 mb-2">
            <button type="button"
              className={`btn btn-sm ${assignMode === 'user' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAssignMode('user')}>Specific user</button>
            <button type="button"
              className={`btn btn-sm ${assignMode === 'role' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAssignMode('role')}>Role (custom roles supported)</button>
          </div>
          {assignMode === 'user' ? (
            <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">-- choose --</option>
              {userList.map(u => (
                <option key={u.uid} value={u.uid}>
                  {(u.name || u.phone || u.uid)} {u.role ? `[${u.role}]` : ''}
                </option>
              ))}
            </select>
          ) : (
            <select className="input" value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)}>
              <option value="">-- choose role --</option>
              {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Tip: role-based assignment notifies every user with that role or customRole.
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Create task'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
