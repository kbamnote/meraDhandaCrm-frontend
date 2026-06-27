/**
 * Internal Chat — staff messaging (1-to-1 + groups, text + image), real-time.
 *
 * Wires the existing chat backend (routes/chat.js) + chatApi to a UI. The chat
 * paths are REST-only (NOT served by the onValue shim), so we subscribe to the
 * raw Socket.IO `data:change` events and re-fetch on the relevant chat path.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, db, socket } from '../services/realtime';
import { chatApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:        { en: '💬 Chat', hi: '💬 चैट', hinglish: '💬 Chat', gu: '💬 ચેટ', mr: '💬 चॅट', mwr: '💬 चैट' },
  search:       { en: '🔍 Search…', hi: '🔍 खोजें…', hinglish: '🔍 Search…', gu: '🔍 શોધો…', mr: '🔍 शोधा…', mwr: '🔍 ढूंढो…' },
  groups:       { en: 'Groups', hi: 'ग्रुप', hinglish: 'Groups', gu: 'ગ્રુપ', mr: 'ग्रुप', mwr: 'ग्रुप' },
  people:       { en: 'People', hi: 'लोग', hinglish: 'People', gu: 'લોકો', mr: 'लोक', mwr: 'लोग' },
  newGroup:     { en: '+ New group', hi: '+ नया ग्रुप', hinglish: '+ Naya group', gu: '+ નવો ગ્રુપ', mr: '+ नवीन ग्रुप', mwr: '+ नयो ग्रुप' },
  selectChat:   { en: 'Select a conversation to start chatting', hi: 'चैट शुरू करने के लिए कोई बातचीत चुनें', hinglish: 'Chat shuru karne ke liye koi conversation chunein', gu: 'ચેટ શરૂ કરવા માટે વાતચીત પસંદ કરો', mr: 'चॅट सुरू करण्यासाठी संभाषण निवडा', mwr: 'चैट चालू करण खातर कोई बातचीत चुणो' },
  noMessages:   { en: 'No messages yet. Say hello! 👋', hi: 'अभी कोई मैसेज नहीं। नमस्ते कहें! 👋', hinglish: 'Abhi koi message nahi. Hello kahein! 👋', gu: 'હજુ કોઈ સંદેશ નથી. હેલો કહો! 👋', mr: 'अद्याप संदेश नाही. हॅलो म्हणा! 👋', mwr: 'अजे कोई मैसेज कोनी। नमस्ते कैवो! 👋' },
  typeMessage:  { en: 'Type a message…', hi: 'मैसेज लिखें…', hinglish: 'Message likhein…', gu: 'સંદેશ લખો…', mr: 'संदेश लिहा…', mwr: 'मैसेज लिखो…' },
  send:         { en: 'Send', hi: 'भेजें', hinglish: 'Send', gu: 'મોકલો', mr: 'पाठवा', mwr: 'भेजो' },
  members:      { en: 'Members', hi: 'सदस्य', hinglish: 'Members', gu: 'સભ્યો', mr: 'सदस्य', mwr: 'सदस्य' },
  groupName:    { en: 'Group name', hi: 'ग्रुप का नाम', hinglish: 'Group ka naam', gu: 'ગ્રુપનું નામ', mr: 'ग्रुपचे नाव', mwr: 'ग्रुप रो नाम' },
  create:       { en: 'Create', hi: 'बनाएं', hinglish: 'Banayein', gu: 'બનાવો', mr: 'तयार करा', mwr: 'बणावो' },
  cancel:       { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  newGroupTitle:{ en: 'New group', hi: 'नया ग्रुप', hinglish: 'Naya group', gu: 'નવો ગ્રુપ', mr: 'नवीन ग्रुप', mwr: 'नयो ग्रुप' },
  pickMembers:  { en: 'Pick at least one member', hi: 'कम से कम एक सदस्य चुनें', hinglish: 'Kam se kam ek member chunein', gu: 'ઓછામાં ઓછા એક સભ્ય પસંદ કરો', mr: 'किमान एक सदस्य निवडा', mwr: 'कम सूं कम एक सदस्य चुणो' },
  nameRequired: { en: 'Group name required', hi: 'ग्रुप का नाम ज़रूरी है', hinglish: 'Group ka naam zaroori hai', gu: 'ગ્રુપનું નામ જરૂરી છે', mr: 'ग्रुपचे नाव आवश्यक', mwr: 'ग्रुप रो नाम जरूरी है' },
  groupCreated: { en: 'Group created', hi: 'ग्रुप बन गया', hinglish: 'Group ban gaya', gu: 'ગ્રુપ બન્યો', mr: 'ग्रुप तयार झाला', mwr: 'ग्रुप बण ग्यो' },
  failed:       { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  image:        { en: '📎', hi: '📎', hinglish: '📎', gu: '📎', mr: '📎', mwr: '📎' },
};

const dmId = (a, b) => [a, b].sort().join('_');
const userLabel = (u) => (u?.name || u?.phone || u?.email || u?.id || 'User');

export default function ChatPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const me = profile?.id;

  const [usersMap, setUsersMap] = useState({});   // { uid: user }
  const [groups, setGroups] = useState([]);        // [{ id, name, members }]
  const [active, setActive] = useState(null);      // { type:'dm'|'group', id, convId, name }
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const endRef = useRef(null);

  // Live tenant users (for the People list + group member picker).
  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsersMap(snap.val() || {}));
    return () => u();
  }, []);

  // Groups I belong to (REST). Refetch on group changes.
  const loadGroups = () => chatApi.groups().then((g) => setGroups(Array.isArray(g) ? g : [])).catch(() => {});
  useEffect(() => {
    loadGroups();
    const onChange = (msg) => {
      if (String(msg?.path || '').includes('chat/groups')) loadGroups();
    };
    socket.on('data:change', onChange);
    return () => socket.off('data:change', onChange);
  }, []);

  // Messages for the active conversation (REST). Refetch on its path changing.
  const loadMessages = (convId) =>
    chatApi.messages(convId).then((m) => setMessages(Array.isArray(m) ? m : [])).catch(() => setMessages([]));
  useEffect(() => {
    if (!active) { setMessages([]); return; }
    loadMessages(active.convId);
    const onChange = (msg) => {
      const p = String(msg?.path || '');
      if (p.includes(`chat/messages/${active.convId}`)) loadMessages(active.convId);
    };
    socket.on('data:change', onChange);
    return () => socket.off('data:change', onChange);
  }, [active?.convId]);

  // Auto-scroll to newest.
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const people = useMemo(
    () => Object.entries(usersMap)
      .map(([id, u]) => ({ ...u, id }))
      .filter((u) => u.id !== me && u.role !== 'pending'),
    [usersMap, me]
  );

  const q = search.trim().toLowerCase();
  const filteredPeople = q ? people.filter((u) => userLabel(u).toLowerCase().includes(q)) : people;
  const filteredGroups = q ? groups.filter((g) => (g.name || '').toLowerCase().includes(q)) : groups;

  const openDm = (u) => setActive({ type: 'dm', id: u.id, convId: dmId(me, u.id), name: userLabel(u) });
  const openGroup = (g) => setActive({ type: 'group', id: g.id, convId: g.id, name: g.name });

  const send = async (text, media) => {
    if (!active) return;
    try {
      const payload = { to: active.id, isGroup: active.type === 'group', text: text || null, media: media || null };
      const saved = await chatApi.send(payload);
      setMessages((m) => [...m, saved]);   // optimistic; socket refetch will reconcile
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('title')}</h2>

      <div className="chat-wrap" style={{
        display: 'flex', gap: 12, height: 'calc(100vh - 160px)', minHeight: 420,
      }}>
        {/* Conversation list */}
        <div className="card" style={{
          width: 300, flexShrink: 0, padding: 0, display: active ? 'none' : 'flex',
          flexDirection: 'column', overflow: 'hidden',
        }} data-chat-list>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input className="input" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('groups')}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowNewGroup(true)}>{t('newGroup')}</button>
            </div>
            {filteredGroups.map((g) => (
              <ConvRow key={g.id} avatar="👥" name={g.name} sub={`${(g.members || []).length} ${t('members')}`} onClick={() => openGroup(g)} />
            ))}
            <div style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('people')}</div>
            {filteredPeople.map((u) => (
              <ConvRow key={u.id} avatar={(userLabel(u)[0] || '?').toUpperCase()} name={userLabel(u)} sub={u.role || ''} onClick={() => openDm(u)} />
            ))}
          </div>
        </div>

        {/* Active thread */}
        <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!active ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', padding: 32 }}>{t('selectChat')}</div>
          ) : (
            <>
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-ghost btn-xs chat-back" onClick={() => setActive(null)} style={{ display: 'none' }}>←</button>
                <div style={{ fontWeight: 600 }}>
                  {active.type === 'group' ? '👥 ' : ''}{active.name}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!messages.length && (
                  <div style={{ margin: 'auto', color: 'var(--text3)' }}>{t('noMessages')}</div>
                )}
                {messages.map((m) => (
                  <Bubble key={m.id} m={m} mine={m.from === me} isGroup={active.type === 'group'} usersMap={usersMap} />
                ))}
                <div ref={endRef} />
              </div>

              <Composer onSend={send} t={t} />
            </>
          )}
        </div>
      </div>

      {showNewGroup && (
        <NewGroupModal
          people={people}
          onClose={() => setShowNewGroup(false)}
          onCreated={(g) => { setShowNewGroup(false); loadGroups(); openGroup(g); }}
          t={t}
        />
      )}
    </div>
  );
}

function ConvRow({ avatar, name, sub, onClick }) {
  return (
    <button onClick={onClick} className="chat-conv-row" style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: '50%', background: 'var(--blue, #C05621)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
      }}>{avatar}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        {sub ? <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{sub}</span> : null}
      </span>
    </button>
  );
}

function Bubble({ m, mine, isGroup, usersMap }) {
  const isImg = m.media && typeof m.media === 'object' && String(m.media.type || '').startsWith('image');
  const senderName = userLabel(usersMap[m.from]);
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
      {isGroup && !mine && (
        <div style={{ fontSize: 10, color: 'var(--text3)', margin: '0 0 2px 8px' }}>{senderName}</div>
      )}
      <div style={{
        background: mine ? 'var(--blue, #C05621)' : 'var(--surface2)',
        color: mine ? '#fff' : 'var(--text)',
        padding: isImg ? 4 : '8px 12px', borderRadius: 14,
        borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
      }}>
        {isImg ? (
          <a href={m.media.url} target="_blank" rel="noreferrer">
            <img src={m.media.url} alt={m.media.name || 'image'} style={{ maxWidth: 220, borderRadius: 10, display: 'block' }} />
          </a>
        ) : m.media ? (
          <a href={m.media.url} target="_blank" rel="noreferrer" style={{ color: mine ? '#fff' : 'var(--blue)' }}>📎 {m.media.name || 'file'}</a>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</span>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: mine ? 'right' : 'left', margin: '2px 6px 0' }}>
        {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
    </div>
  );
}

function Composer({ onSend, t }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    onSend(v, null);
    setText('');
  };

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const up = await uploadApi.upload(file);
      await onSend(null, { url: up.url, type: up.type, name: up.name });
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
      <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy} title="Attach image">
        {busy ? '…' : t('image')}
      </button>
      <input className="input" style={{ flex: 1 }} placeholder={t('typeMessage')} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={!text.trim()}>{t('send')}</button>
    </form>
  );
}

function NewGroupModal({ people, onClose, onCreated, t }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return showToast(t('nameRequired'), 'error');
    if (!members.length) return showToast(t('pickMembers'), 'error');
    setBusy(true);
    try {
      const g = await chatApi.createGroup({ name: name.trim(), members });
      showToast(t('groupCreated'), 'success');
      onCreated(g);
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>{t('newGroupTitle')}</h3>
        <div className="form-group">
          <label>{t('groupName')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>{t('members')} ({members.length})</label>
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {people.map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={members.includes(u.id)} onChange={() => toggle(u.id)} />
                <span style={{ fontSize: 14 }}>{userLabel(u)} {u.role ? <span style={{ color: 'var(--text3)', fontSize: 11 }}>[{u.role}]</span> : null}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? '…' : t('create')}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}
