/**
 * Internal Chat — staff messaging (1-to-1 + groups), real-time.
 *
 * The conversation list is what the SERVER says: each row carries the last
 * message and how many of them are unread, so the page never downloads a thread
 * to draw a row. People with no history yet are listed underneath, to start one.
 *
 * Chat paths are REST-only (not served by the onValue shim), so this subscribes
 * to the raw Socket.IO `data:change` events and re-fetches the path that moved.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ref, onValue, db, socket } from '../services/realtime';
import { chatApi, uploadApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:        { en: '💬 Chat', hi: '💬 चैट', hinglish: '💬 Chat', gu: '💬 ચેટ', mr: '💬 चॅट', mwr: '💬 चैट' },
  search:       { en: '🔍 Search people or messages…', hi: '🔍 लोग या मैसेज खोजें…', hinglish: '🔍 Log ya message search karein…', gu: '🔍 લોકો કે સંદેશ શોધો…', mr: '🔍 लोक किंवा संदेश शोधा…', mwr: '🔍 लोग या मैसेज ढूंढो…' },
  chats:        { en: 'Chats', hi: 'चैट', hinglish: 'Chats', gu: 'ચેટ', mr: 'चॅट', mwr: 'चैट' },
  people:       { en: 'Start a new chat', hi: 'नई चैट शुरू करें', hinglish: 'Nayi chat shuru karein', gu: 'નવી ચેટ શરૂ કરો', mr: 'नवीन चॅट सुरू करा', mwr: 'नयी चैट चालू करो' },
  results:      { en: 'Messages', hi: 'मैसेज', hinglish: 'Messages', gu: 'સંદેશા', mr: 'संदेश', mwr: 'मैसेज' },
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
  reply:        { en: 'Reply', hi: 'जवाब', hinglish: 'Reply', gu: 'જવાબ', mr: 'उत्तर', mwr: 'जवाब' },
  edit:         { en: 'Edit', hi: 'बदलें', hinglish: 'Edit', gu: 'સંપાદિત', mr: 'बदला', mwr: 'बदलो' },
  del:          { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete', gu: 'કાઢી નાખો', mr: 'हटवा', mwr: 'हटावो' },
  deleted:      { en: 'This message was deleted', hi: 'यह मैसेज हटा दिया गया', hinglish: 'Yeh message delete ho gaya', gu: 'આ સંદેશ કાઢી નાખ્યો', mr: 'हा संदेश हटवला', mwr: 'यो मैसेज हटा दियो' },
  edited:       { en: 'edited', hi: 'बदला गया', hinglish: 'edited', gu: 'સંપાદિત', mr: 'संपादित', mwr: 'बदल्यो' },
  delConfirm:   { en: 'Delete this message for everyone?', hi: 'यह मैसेज सबके लिए हटाएँ?', hinglish: 'Yeh message sab ke liye delete karein?', gu: 'આ સંદેશ બધા માટે કાઢી નાખો?', mr: 'हा संदेश सर्वांसाठी हटवायचा?', mwr: 'यो मैसेज सगळा खातर हटावां?' },
  today:        { en: 'Today', hi: 'आज', hinglish: 'Aaj', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  yesterday:    { en: 'Yesterday', hi: 'कल', hinglish: 'Kal', gu: 'ગઈકાલે', mr: 'काल', mwr: 'काल' },
};

const dmId = (a, b) => [a, b].sort().join('_');
const userLabel = (u) => (u?.name || u?.phone || u?.email || u?.id || 'User');
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🙏', '✅'];

const hhmm = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const dayKey = (ts) => new Date(ts || 0).toDateString();

function dayLabel(ts, t) {
  const d = dayKey(ts);
  if (d === new Date().toDateString()) return t('today');
  if (d === new Date(Date.now() - 86400000).toDateString()) return t('yesterday');
  return new Date(ts).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

// What a row shows under the name: the last thing said, whoever said it.
function previewOf(conv, me, usersMap, t) {
  const m = conv.lastMessage;
  if (!m) return '';
  const who = m.from === me ? 'You: ' : (conv.isGroup ? `${userLabel(usersMap[m.from])}: ` : '');
  if (m.deleted) return `${who}${t('deleted')}`;
  if (m.text) return `${who}${m.text}`;
  return `${who}📎`;
}

export default function ChatPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const me = profile?.id;

  const [usersMap, setUsersMap] = useState({});
  const [convs, setConvs] = useState([]);          // server-computed rows
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(null);      // { type, id, convId, name }
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState([]);            // message search results
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsersMap(snap.val() || {}));
    return () => u();
  }, []);

  const loadConvs = () => chatApi.conversations().then((c) => setConvs(Array.isArray(c) ? c : [])).catch(() => {});
  const loadGroups = () => chatApi.groups().then((g) => setGroups(Array.isArray(g) ? g : [])).catch(() => {});

  useEffect(() => {
    loadConvs(); loadGroups();
    const onChange = (msg) => {
      const p = String(msg?.path || '');
      if (p.includes('chat/conversations') || p.includes('chat/messages')) loadConvs();
      if (p.includes('chat/groups')) { loadGroups(); loadConvs(); }
    };
    socket.on('data:change', onChange);
    return () => socket.off('data:change', onChange);
  }, []);

  // Messages for the open conversation, and marking them read the moment they
  // are on screen — that is what turns the other person's ticks.
  const loadMessages = (convId) =>
    chatApi.messages(convId)
      .then((m) => setMessages(Array.isArray(m) ? m : []))
      .then(() => chatApi.markRead(convId).then(loadConvs).catch(() => {}))
      .catch(() => setMessages([]));

  useEffect(() => {
    if (!active) { setMessages([]); return undefined; }
    loadMessages(active.convId);
    const onChange = (msg) => {
      if (String(msg?.path || '').includes(`chat/messages/${active.convId}`)) loadMessages(active.convId);
    };
    socket.on('data:change', onChange);
    return () => socket.off('data:change', onChange);
  }, [active?.convId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to the newest message. Guarded on the METHOD, not just the ref: not
  // every environment that renders this page implements scrollIntoView, and a
  // throw here takes the whole thread down with it.
  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Searching past two characters also looks inside the messages themselves.
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setHits([]); return undefined; }
    const id = setTimeout(() => {
      chatApi.search(q).then((r) => setHits(Array.isArray(r) ? r : [])).catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(id);
  }, [search]);

  const people = useMemo(
    () => Object.entries(usersMap)
      .map(([id, u]) => ({ ...u, id }))
      .filter((u) => u.id !== me && u.role !== 'pending'),
    [usersMap, me]
  );

  const q = search.trim().toLowerCase();
  const nameOf = (c) => (c.isGroup ? (c.name || 'Group') : userLabel(usersMap[c.otherId]));
  const shownConvs = convs
    .filter((c) => !q || nameOf(c).toLowerCase().includes(q))
    .filter((c) => c.lastMessage || c.isGroup);
  // People not already in a conversation — so the list isn't the same name twice.
  const talkedTo = new Set(convs.filter((c) => !c.isGroup).map((c) => c.otherId));
  const freshPeople = people
    .filter((u) => !talkedTo.has(u.id))
    .filter((u) => !q || userLabel(u).toLowerCase().includes(q));

  const openConv = (c) => setActive(c.isGroup
    ? { type: 'group', id: c.groupId, convId: c.convId, name: c.name }
    : { type: 'dm', id: c.otherId, convId: c.convId, name: userLabel(usersMap[c.otherId]) });
  const openDm = (u) => setActive({ type: 'dm', id: u.id, convId: dmId(me, u.id), name: userLabel(u) });
  const openGroup = (g) => setActive({ type: 'group', id: g.id, convId: g.id, name: g.name });

  const openHit = (m) => {
    const c = convs.find((x) => x.convId === m.convId);
    if (c) { openConv(c); setSearch(''); }
  };

  const send = async (text, media) => {
    if (!active) return;
    try {
      if (editing) {
        await chatApi.editMessage(editing.id, text);
        setEditing(null);
        loadMessages(active.convId);
        return;
      }
      const saved = await chatApi.send({
        to: active.id, isGroup: active.type === 'group',
        text: text || null, media: media || null,
        replyTo: replyTo ? { id: replyTo.id } : undefined,
      });
      setReplyTo(null);
      setMessages((m) => [...m, saved]);
      loadConvs();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    }
  };

  const react = async (m, emoji) => {
    try { await chatApi.react(m.id, emoji); loadMessages(active.convId); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const remove = async (m) => {
    if (!window.confirm(t('delConfirm'))) return;
    try { await chatApi.deleteMessage(m.id); loadMessages(active.convId); loadConvs(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const unreadTotal = convs.reduce((s, c) => s + (c.unread || 0), 0);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        {t('title')}
        {unreadTotal > 0 && (
          <span className="badge badge-red" data-testid="chat-unread-total" style={{ marginLeft: 8 }}>{unreadTotal}</span>
        )}
      </h2>

      <div className="chat-wrap" style={{ display: 'flex', gap: 12, height: 'calc(100vh - 160px)', minHeight: 420 }}>
        {/* ── Conversations ── */}
        <div className="card" style={{ width: 320, flexShrink: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} data-chat-list>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input className="input" data-testid="chat-search" placeholder={t('search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('chats')}</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowNewGroup(true)}>{t('newGroup')}</button>
            </div>
            {shownConvs.map((c) => (
              <ConvRow
                key={c.convId}
                avatar={c.isGroup ? '👥' : (nameOf(c)[0] || '?').toUpperCase()}
                name={nameOf(c)}
                sub={previewOf(c, me, usersMap, t)}
                time={c.lastAt ? hhmm(c.lastAt) : ''}
                unread={c.unread}
                active={active?.convId === c.convId}
                onClick={() => openConv(c)}
              />
            ))}

            {hits.length > 0 && (
              <>
                <div style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('results')}</div>
                {hits.map((m) => (
                  <button key={m.id} data-testid="chat-hit" onClick={() => openHit(m)}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{userLabel(usersMap[m.from])} · {hhmm(m.timestamp)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</div>
                  </button>
                ))}
              </>
            )}

            {freshPeople.length > 0 && (
              <div style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('people')}</div>
            )}
            {freshPeople.map((u) => (
              <ConvRow key={u.id} avatar={(userLabel(u)[0] || '?').toUpperCase()} name={userLabel(u)} sub={u.role || ''} onClick={() => openDm(u)} />
            ))}
          </div>
        </div>

        {/* ── The open thread ── */}
        <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!active ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text3)', padding: 32 }}>{t('selectChat')}</div>
          ) : (
            <>
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-ghost btn-xs chat-back" onClick={() => setActive(null)} style={{ display: 'none' }}>←</button>
                <div style={{ fontWeight: 600 }}>{active.type === 'group' ? '👥 ' : ''}{active.name}</div>
                {active.type === 'group' && (
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {(groups.find((g) => g.id === active.id)?.members || []).length} {t('members')}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!messages.length && <div style={{ margin: 'auto', color: 'var(--text3)' }}>{t('noMessages')}</div>}
                {messages.map((m, i) => (
                  <div key={m.id}>
                    {dayKey(m.timestamp) !== dayKey(messages[i - 1]?.timestamp) && (
                      <div style={{ textAlign: 'center', margin: '10px 0 6px' }}>
                        <span style={{ fontSize: 10.5, color: 'var(--text3)', background: 'var(--surface2)', padding: '2px 10px', borderRadius: 10 }}>
                          {dayLabel(m.timestamp, t)}
                        </span>
                      </div>
                    )}
                    <Bubble
                      m={m}
                      mine={m.from === me}
                      isGroup={active.type === 'group'}
                      usersMap={usersMap}
                      me={me}
                      t={t}
                      onReply={() => setReplyTo(m)}
                      onReact={(e) => react(m, e)}
                      onEdit={() => setEditing(m)}
                      onDelete={() => remove(m)}
                    />
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              <Composer
                onSend={send}
                t={t}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                editing={editing}
                onCancelEdit={() => setEditing(null)}
                usersMap={usersMap}
              />
            </>
          )}
        </div>
      </div>

      {showNewGroup && (
        <NewGroupModal
          people={people}
          onClose={() => setShowNewGroup(false)}
          onCreated={(g) => { setShowNewGroup(false); loadGroups(); loadConvs(); openGroup(g); }}
          t={t}
        />
      )}
    </div>
  );
}

function ConvRow({ avatar, name, sub, time, unread, active, onClick }) {
  return (
    <button onClick={onClick} className="chat-conv-row" data-testid="conv-row" style={{
      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', background: active ? 'var(--surface2)' : 'none', border: 'none', cursor: 'pointer',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: '50%', background: 'var(--blue, #C05621)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
      }}>{avatar}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: unread > 0 ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          {time ? <span style={{ fontSize: 10.5, color: 'var(--text3)', flexShrink: 0 }}>{time}</span> : null}
        </span>
        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
          {sub ? (
            <span style={{ fontSize: 11.5, color: unread > 0 ? 'var(--text2)' : 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
          ) : <span />}
          {/* Unread only ever shows when there IS something unread. */}
          {unread > 0 && (
            <span data-testid="conv-unread" style={{
              background: 'var(--green, #16A34A)', color: '#fff', fontSize: 10.5, fontWeight: 700,
              minWidth: 18, textAlign: 'center', borderRadius: 9, padding: '1px 5px', flexShrink: 0,
            }}>{unread > 99 ? '99+' : unread}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function Bubble({ m, mine, isGroup, usersMap, me, t, onReply, onReact, onEdit, onDelete }) {
  const [menu, setMenu] = useState(false);
  const isImg = m.media && typeof m.media === 'object' && String(m.media.type || '').startsWith('image');
  const senderName = userLabel(usersMap[m.from]);
  // Read by anyone other than the sender — the second tick.
  const seen = Object.keys(m.seenBy || {}).some((uid) => uid !== m.from);
  const reactions = Object.entries(m.reactions || {});

  return (
    <div
      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', position: 'relative' }}
      onMouseEnter={() => setMenu(true)}
      onMouseLeave={() => setMenu(false)}
      data-testid="chat-bubble"
    >
      {isGroup && !mine && !m.deleted && (
        <div style={{ fontSize: 10, color: 'var(--text3)', margin: '0 0 2px 8px' }}>{senderName}</div>
      )}

      <div style={{
        background: m.deleted ? 'transparent' : (mine ? 'var(--blue, #C05621)' : 'var(--surface2)'),
        border: m.deleted ? '1px dashed var(--border)' : 'none',
        color: m.deleted ? 'var(--text3)' : (mine ? '#fff' : 'var(--text)'),
        padding: isImg ? 4 : '8px 12px', borderRadius: 14,
        borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
        fontStyle: m.deleted ? 'italic' : 'normal',
      }}>
        {/* The quoted line is a snapshot taken when the reply was sent, so it
            still reads correctly after the original is withdrawn. */}
        {m.replyTo && !m.deleted && (
          <div data-testid="reply-quote" style={{
            borderLeft: '3px solid rgba(255,255,255,.5)', paddingLeft: 6, marginBottom: 4,
            fontSize: 11.5, opacity: .85, maxHeight: 40, overflow: 'hidden',
          }}>
            <b>{userLabel(usersMap[m.replyTo.from])}</b>
            <div>{m.replyTo.text || t('deleted')}</div>
          </div>
        )}

        {m.deleted ? (
          <span data-testid="deleted-note">🚫 {t('deleted')}</span>
        ) : isImg ? (
          <a href={m.media.url} target="_blank" rel="noreferrer">
            <img src={m.media.url} alt={m.media.name || 'image'} style={{ maxWidth: 240, borderRadius: 10, display: 'block' }} />
          </a>
        ) : m.media ? (
          <a href={m.media.url} target="_blank" rel="noreferrer" style={{ color: mine ? '#fff' : 'var(--blue)' }}>📎 {m.media.name || 'file'}</a>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</span>
        )}
      </div>

      {reactions.length > 0 && (
        <div data-testid="reaction-row" style={{ margin: '-6px 6px 0', textAlign: mine ? 'right' : 'left' }}>
          <span style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 6px', fontSize: 12 }}>
            {reactions.map(([, e]) => e).join(' ')} {reactions.length > 1 ? reactions.length : ''}
          </span>
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: mine ? 'right' : 'left', margin: '2px 6px 0' }}>
        {hhmm(m.timestamp)}
        {m.editedAt && !m.deleted ? ` · ${t('edited')}` : ''}
        {/* One tick sent, two when somebody has read it. */}
        {mine && !m.deleted ? <span data-testid="tick" style={{ marginLeft: 4, color: seen ? 'var(--blue, #2563EB)' : 'var(--text3)' }}>{seen ? '✓✓' : '✓'}</span> : null}
      </div>

      {menu && !m.deleted && (
        <div style={{
          position: 'absolute', top: -14, [mine ? 'left' : 'right']: -4, display: 'flex', gap: 2,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '2px 4px', zIndex: 3,
        }}>
          {QUICK_REACTIONS.map((e) => (
            <button key={e} data-testid="react-btn" onClick={() => onReact(e)} title={e}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>{e}</button>
          ))}
          <button className="btn btn-ghost btn-xs" data-testid="reply-btn" onClick={onReply}>↩</button>
          {m.from === me && <button className="btn btn-ghost btn-xs" data-testid="edit-btn" onClick={onEdit}>✏️</button>}
          {m.from === me && <button className="btn btn-ghost btn-xs" data-testid="delete-btn" onClick={onDelete}>🗑</button>}
        </div>
      )}
    </div>
  );
}

function Composer({ onSend, t, replyTo, onCancelReply, editing, onCancelEdit, usersMap }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  // Editing loads the message into the box; cancelling puts it back as it was.
  useEffect(() => { setText(editing ? (editing.text || '') : ''); }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    await onSend(v, null);
    setText('');
    setBusy(false);
  };

  const attach = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const r = await uploadApi.upload(f);
      await onSend(null, { url: r.url, type: f.type, name: f.name, size: f.size });
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      {(replyTo || editing) && (
        <div data-testid="composer-banner" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--surface2)' }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text2)' }}>
            {editing ? (
              <>✏️ {t('edit')}</>
            ) : (
              <>↩ {t('reply')} · <b>{userLabel(usersMap[replyTo.from])}</b>: {String(replyTo.text || '📎').slice(0, 60)}</>
            )}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={editing ? onCancelEdit : onCancelReply}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: 10, alignItems: 'center' }}>
        <label className="btn btn-ghost btn-sm" style={{ margin: 0, cursor: 'pointer' }} title="Attach">
          📎
          <input type="file" style={{ display: 'none' }} onChange={attach} disabled={busy} />
        </label>
        <input
          className="input"
          data-testid="chat-input"
          style={{ flex: 1 }}
          placeholder={t('typeMessage')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          disabled={busy}
        />
        <button className="btn btn-primary btn-sm" data-testid="chat-send" onClick={submit} disabled={busy || !text.trim()}>
          {t('send')}
        </button>
      </div>
    </div>
  );
}

function NewGroupModal({ people, onClose, onCreated, t }) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const create = async () => {
    if (!name.trim()) return showToast(t('nameRequired'), 'error');
    if (!members.length) return showToast(t('pickMembers'), 'error');
    setBusy(true);
    try {
      const g = await chatApi.createGroup({ name: name.trim(), members });
      showToast(t('groupCreated'), 'success');
      onCreated(g);
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 18 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>{t('newGroupTitle')}</h3>
        <div className="form-group">
          <label>{t('groupName')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
          {people.map((u) => (
            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              <input type="checkbox" checked={members.includes(u.id)} onChange={() => toggle(u.id)} />
              <span style={{ fontSize: 13 }}>{userLabel(u)}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>{u.role || ''}</span>
            </label>
          ))}
        </div>
        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>{t('cancel')}</button>
          <button className="btn btn-primary btn-sm" onClick={create} disabled={busy}>{t('create')}</button>
        </div>
      </div>
    </div>
  );
}
