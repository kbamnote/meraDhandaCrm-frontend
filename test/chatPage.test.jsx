/**
 * The desktop chat.
 *
 * What a messaging screen has to get right, and what the old one did not do at
 * all: which conversations have something new in them, what was last said, that
 * a message was read, and the ordinary actions — reply, react, edit, withdraw.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

const ME = 'u1'; // renderScreen's OWNER
const NOW = Date.parse('2026-09-30T10:00:00Z');

const USERS = {
  u1: { name: 'Test Owner', role: 'owner' },
  u2: { name: 'Asha Kale', role: 'designer' },
  u3: { name: 'Bilal Khan', role: 'production' },
};

let conversations = [];
let messages = [];
let searchHits = [];
const calls = { sent: [], read: [], react: [], edit: [], del: [] };

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' },
  socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    cb({ val: () => (String(refObj.path).endsWith('users') ? USERS : {}) });
    return () => {};
  },
  authSocket: () => {},
}));

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    chatApi: {
      conversations: vi.fn(async () => conversations),
      messages: vi.fn(async () => messages),
      groups: vi.fn(async () => [{ id: 'g1', name: 'Production', members: ['u1', 'u2', 'u3'] }]),
      markRead: vi.fn(async (convId) => { calls.read.push(convId); return { read: 1 }; }),
      send: vi.fn(async (b) => { calls.sent.push(b); return { id: 'new', ...b, from: ME, timestamp: NOW, seenBy: { [ME]: NOW } }; }),
      react: vi.fn(async (id, emoji) => { calls.react.push({ id, emoji }); return {}; }),
      editMessage: vi.fn(async (id, text) => { calls.edit.push({ id, text }); return {}; }),
      deleteMessage: vi.fn(async (id) => { calls.del.push(id); return {}; }),
      search: vi.fn(async () => searchHits),
      createGroup: vi.fn(async (b) => ({ id: 'g2', ...b })),
    },
    uploadApi: { ...actual.uploadApi, upload: vi.fn(async () => ({ url: 'https://x/pic.png' })) },
  };
});

const { default: ChatPage } = await import('../src/pages/ChatPage.jsx');

const row = (name) => screen.getAllByTestId('conv-row').find((r) => r.textContent.includes(name));
const openChat = async (name) => {
  renderScreen(ChatPage, { auth: OWNER });
  await waitFor(() => expect(row(name)).toBeTruthy());
  fireEvent.click(row(name));
  return waitFor(() => expect(screen.getAllByTestId('chat-bubble').length).toBeGreaterThan(0));
};

beforeEach(() => {
  calls.sent.length = 0; calls.read.length = 0; calls.react.length = 0;
  calls.edit.length = 0; calls.del.length = 0;
  searchHits = [];
  conversations = [
    {
      convId: 'u1_u2', isGroup: false, otherId: 'u2', unread: 3, lastAt: NOW,
      lastMessage: { id: 'm2', from: 'u2', text: 'Design is ready', deleted: false, timestamp: NOW },
    },
    {
      convId: 'g1', isGroup: true, groupId: 'g1', name: 'Production', members: ['u1', 'u2', 'u3'],
      unread: 0, lastAt: NOW - 3600000,
      lastMessage: { id: 'm9', from: 'u3', text: 'Machine 2 free', deleted: false, timestamp: NOW - 3600000 },
    },
  ];
  messages = [
    { id: 'm1', convId: 'u1_u2', from: ME, text: 'Are the cards ready?', timestamp: NOW - 7200000, seenBy: { u1: NOW, u2: NOW } },
    { id: 'm2', convId: 'u1_u2', from: 'u2', text: 'Design is ready', timestamp: NOW, seenBy: { u2: NOW }, reactions: { u1: '👍' } },
    { id: 'm3', convId: 'u1_u2', from: ME, text: 'Sending now', timestamp: NOW, seenBy: { u1: NOW } },
  ];
});

describe('the conversation list', () => {
  it('shows what was last said and how much is unread', async () => {
    renderScreen(ChatPage, { auth: OWNER });
    await waitFor(() => expect(row('Asha Kale')).toBeTruthy());
    expect(row('Asha Kale').textContent).toContain('Design is ready');
    expect(within(row('Asha Kale')).getByTestId('conv-unread').textContent).toBe('3');
    // A read conversation carries no badge at all.
    expect(within(row('Production')).queryByTestId('conv-unread')).toBeNull();
    expect(screen.getByTestId('chat-unread-total').textContent).toBe('3');
  });

  it('says who spoke last in a group, and "You" for your own', async () => {
    conversations[1].lastMessage = { id: 'm9', from: 'u3', text: 'Machine 2 free', timestamp: NOW };
    conversations[0].lastMessage = { id: 'm3', from: ME, text: 'Sending now', timestamp: NOW };
    renderScreen(ChatPage, { auth: OWNER });
    await waitFor(() => expect(row('Production')).toBeTruthy());
    expect(row('Production').textContent).toContain('Bilal Khan: Machine 2 free');
    expect(row('Asha Kale').textContent).toContain('You: Sending now');
  });

  it('lists people you have never messaged, without repeating the ones you have', async () => {
    renderScreen(ChatPage, { auth: OWNER });
    await waitFor(() => expect(row('Asha Kale')).toBeTruthy());
    // Bilal has no DM yet, so he appears once — as someone to start a chat with.
    // (A group's preview line can also mention him, hence matching on the row's
    // own name rather than anywhere in its text.)
    const named = (n) => screen.getAllByTestId('conv-row').filter((r) => within(r).queryByText(n));
    expect(named('Bilal Khan')).toHaveLength(1);
    expect(named('Asha Kale')).toHaveLength(1);
  });

  it('marks a conversation read when it is opened', async () => {
    await openChat('Asha Kale');
    await waitFor(() => expect(calls.read).toEqual(['u1_u2']));
  });
});

describe('the thread', () => {
  it('shows one tick for sent and two once it has been read', async () => {
    await openChat('Asha Kale');
    const bubbles = screen.getAllByTestId('chat-bubble');
    // m1 was read by Asha; m3 has not been.
    expect(within(bubbles[0]).getByTestId('tick').textContent).toBe('✓✓');
    expect(within(bubbles[2]).getByTestId('tick').textContent).toBe('✓');
    // Someone else's message carries no tick — it is not mine to track.
    expect(within(bubbles[1]).queryByTestId('tick')).toBeNull();
  });

  it('shows reactions that were left on a message', async () => {
    await openChat('Asha Kale');
    const bubbles = screen.getAllByTestId('chat-bubble');
    expect(within(bubbles[1]).getByTestId('reaction-row').textContent).toContain('👍');
    expect(within(bubbles[0]).queryByTestId('reaction-row')).toBeNull();
  });

  it('shows a withdrawn message as withdrawn, not as a gap', async () => {
    messages[1] = { ...messages[1], deleted: true, text: null, reactions: {} };
    await openChat('Asha Kale');
    expect(screen.getByTestId('deleted-note')).toBeTruthy();
    expect(screen.getAllByTestId('chat-bubble')).toHaveLength(3);
  });

  it('quotes the replied-to line', async () => {
    messages.push({
      id: 'm4', convId: 'u1_u2', from: 'u2', text: 'On it',
      replyTo: { id: 'm3', from: ME, text: 'Sending now' }, timestamp: NOW, seenBy: { u2: NOW },
    });
    await openChat('Asha Kale');
    const quote = screen.getByTestId('reply-quote');
    expect(quote.textContent).toContain('Test Owner');
    expect(quote.textContent).toContain('Sending now');
  });
});

describe('sending', () => {
  it('sends what was typed', async () => {
    await openChat('Asha Kale');
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Thanks' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(calls.sent).toHaveLength(1));
    expect(calls.sent[0]).toMatchObject({ to: 'u2', isGroup: false, text: 'Thanks' });
  });

  it('replying sends the message it answers', async () => {
    await openChat('Asha Kale');
    const bubble = screen.getAllByTestId('chat-bubble')[1];
    fireEvent.mouseEnter(bubble);
    fireEvent.click(within(bubble).getByTestId('reply-btn'));
    expect(screen.getByTestId('composer-banner').textContent).toContain('Design is ready');
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Great' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(calls.sent).toHaveLength(1));
    expect(calls.sent[0].replyTo).toEqual({ id: 'm2' });
  });

  it('reacting goes to the server', async () => {
    await openChat('Asha Kale');
    const bubble = screen.getAllByTestId('chat-bubble')[1];
    fireEvent.mouseEnter(bubble);
    fireEvent.click(within(bubble).getAllByTestId('react-btn')[0]);
    await waitFor(() => expect(calls.react).toEqual([{ id: 'm2', emoji: '👍' }]));
  });

  it('edit and delete are offered on my own messages only', async () => {
    await openChat('Asha Kale');
    const mine = screen.getAllByTestId('chat-bubble')[0];
    const theirs = screen.getAllByTestId('chat-bubble')[1];
    fireEvent.mouseEnter(mine);
    expect(within(mine).queryByTestId('edit-btn')).toBeTruthy();
    expect(within(mine).queryByTestId('delete-btn')).toBeTruthy();
    fireEvent.mouseLeave(mine);
    fireEvent.mouseEnter(theirs);
    expect(within(theirs).queryByTestId('edit-btn'), "not someone else's words").toBeNull();
    expect(within(theirs).queryByTestId('delete-btn')).toBeNull();
  });

  it('editing loads the message and saves the change', async () => {
    await openChat('Asha Kale');
    const mine = screen.getAllByTestId('chat-bubble')[0];
    fireEvent.mouseEnter(mine);
    fireEvent.click(within(mine).getByTestId('edit-btn'));
    expect(screen.getByTestId('chat-input').value).toBe('Are the cards ready?');
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Are the 500 cards ready?' } });
    fireEvent.click(screen.getByTestId('chat-send'));
    await waitFor(() => expect(calls.edit).toEqual([{ id: 'm1', text: 'Are the 500 cards ready?' }]));
    expect(calls.sent, 'an edit must not post a second message').toHaveLength(0);
  });

  it('deleting asks first', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openChat('Asha Kale');
    const mine = screen.getAllByTestId('chat-bubble')[0];
    fireEvent.mouseEnter(mine);
    fireEvent.click(within(mine).getByTestId('delete-btn'));
    expect(calls.del).toEqual([]);
    window.confirm.mockReturnValue(true);
    fireEvent.click(within(mine).getByTestId('delete-btn'));
    await waitFor(() => expect(calls.del).toEqual(['m1']));
  });
});

describe('search', () => {
  it('finds messages, and opening one jumps to its conversation', async () => {
    searchHits = [{ id: 'm2', convId: 'u1_u2', from: 'u2', text: 'Design is ready', timestamp: NOW }];
    renderScreen(ChatPage, { auth: OWNER });
    await waitFor(() => expect(row('Asha Kale')).toBeTruthy());
    fireEvent.change(screen.getByTestId('chat-search'), { target: { value: 'design' } });
    const hit = await screen.findByTestId('chat-hit');
    expect(hit.textContent).toContain('Design is ready');
    fireEvent.click(hit);
    await waitFor(() => expect(screen.getAllByTestId('chat-bubble').length).toBeGreaterThan(0));
  });
});
