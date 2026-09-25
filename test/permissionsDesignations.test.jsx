/**
 * Designations on the Permissions page.
 *
 * A teammate's designation is picked from the company's list (not typed), so
 * the label stays consistent. Admins manage the list — add, rename, delete —
 * from a panel on the same page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderScreen, STAFF } from './renderScreen.jsx';

const USERS = {
  u1: { name: 'Asha', email: 'asha@x.in', role: 'staff', customRole: 'machine  operator' },
  u2: { name: 'Bilal', email: 'bilal@x.in', role: 'staff', customRole: null },
};
let LIST;
const calls = [];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => { cb({ val: () => (r.path === 'mpw/users' ? USERS : {}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      designations: vi.fn(async () => LIST.map((d) => ({ ...d }))),
      createDesignation: vi.fn(async (name) => { calls.push(['create', name]); LIST.push({ name, count: 0, saved: true }); return {}; }),
      renameDesignation: vi.fn(async (from, to) => { calls.push(['rename', from, to]); LIST = LIST.map((d) => (d.name === from ? { ...d, name: to } : d)); return {}; }),
      deleteDesignation: vi.fn(async (name) => { calls.push(['delete', name]); LIST = LIST.filter((d) => d.name !== name); return {}; }),
      setRole: vi.fn(async (uid, b) => { calls.push(['setRole', uid, b]); return {}; }),
      createUser: vi.fn(async (b) => { calls.push(['createUser', b]); return {}; }),
    },
  };
});

const { default: PermissionsPage, matchDesignation } = await import('../src/pages/PermissionsPage.jsx');

beforeEach(() => {
  LIST = [
    { name: 'Delivery Boy', count: 0, saved: true },
    { name: 'Machine Operator', count: 1, saved: true },
  ];
  calls.length = 0;
});

const openPanel = async () => {
  await waitFor(() => expect(screen.getByTestId('designations-panel')).toBeTruthy());
  fireEvent.click(within(screen.getByTestId('designations-panel')).getByText(/Designations \(/));
};

describe('matchDesignation', () => {
  it('finds the list spelling regardless of case / spacing; unknown or blank → none', () => {
    const list = [{ name: 'Machine Operator' }];
    expect(matchDesignation('machine   OPERATOR ', list)).toBe('Machine Operator');
    expect(matchDesignation('Typo', list)).toBe('');
    expect(matchDesignation(null, list)).toBe('');
  });
});

describe('the Permissions page', () => {
  it('each teammate’s designation is a dropdown of the list, showing their current one', async () => {
    renderScreen(PermissionsPage);
    // The list loads after the rows; the dropdown then shows the stored value.
    await waitFor(() => expect(screen.getAllByTestId('designation-select')[0].value).toBe('Machine Operator'));
    const [asha, bilal] = screen.getAllByTestId('designation-select');
    expect(bilal.value).toBe('');
    expect([...asha.options].map((o) => o.value)).toEqual(['', 'Delivery Boy', 'Machine Operator']);
  });

  it('saving sends the picked designation', async () => {
    renderScreen(PermissionsPage);
    await waitFor(() => expect(screen.getAllByTestId('designation-select').length).toBe(2));
    fireEvent.change(screen.getAllByTestId('designation-select')[1], { target: { value: 'Delivery Boy' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Save/ })[1]);
    await waitFor(() => expect(calls.find((c) => c[0] === 'setRole')).toBeTruthy());
    expect(calls.find((c) => c[0] === 'setRole')).toEqual(['setRole', 'u2', { role: 'staff', customRole: 'Delivery Boy' }]);
  });

  it('an unsaved pick survives the list reloading', async () => {
    renderScreen(PermissionsPage);
    await waitFor(() => expect(screen.getAllByTestId('designation-select')[1].options.length).toBe(3));
    fireEvent.change(screen.getAllByTestId('designation-select')[1], { target: { value: 'Delivery Boy' } });
    // Adding a designation reloads the list.
    await openPanel();
    fireEvent.change(screen.getByTestId('new-designation'), { target: { value: 'Packer' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add$/ }));
    await waitFor(() => expect(screen.getAllByTestId('designation-select')[1].options.length).toBe(4));
    expect(screen.getAllByTestId('designation-select')[1].value).toBe('Delivery Boy');
  });

  it('admins can add a designation and it becomes pickable', async () => {
    renderScreen(PermissionsPage);
    await openPanel();
    fireEvent.change(screen.getByTestId('new-designation'), { target: { value: 'CNC Operator' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add$/ }));
    await waitFor(() => expect(calls).toContainEqual(['create', 'CNC Operator']));
    await waitFor(() => expect([...screen.getAllByTestId('designation-select')[0].options].map((o) => o.value)).toContain('CNC Operator'));
  });

  it('rename and delete go through the API after asking', async () => {
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Senior Operator');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderScreen(PermissionsPage);
    await openPanel();
    const row = screen.getByText('Machine Operator', { selector: 'b' }).closest('div').parentElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Rename' }));
    await waitFor(() => expect(calls).toContainEqual(['rename', 'Machine Operator', 'Senior Operator']));
    const row2 = screen.getByText('Delivery Boy', { selector: 'b' }).closest('div').parentElement;
    fireEvent.click(within(row2).getByRole('button', { name: /Remove/ }));
    await waitFor(() => expect(calls).toContainEqual(['delete', 'Delivery Boy']));
    prompt.mockRestore(); confirm.mockRestore();
  });

  it('Add Teammate offers the list and sends the choice', async () => {
    renderScreen(PermissionsPage);
    await waitFor(() => expect(screen.getAllByTestId('designation-select')[0].options.length).toBe(3));
    fireEvent.click(screen.getByRole('button', { name: /\+ Teammate add|Add Teammate/i }));
    const selects = screen.getAllByTestId('designation-select');
    fireEvent.change(selects[selects.length - 1], { target: { value: 'Delivery Boy' } });
    const form = selects[selects.length - 1].closest('form');
    fireEvent.change(within(form).getByPlaceholderText(/@/), { target: { value: 'new@x.in' } });
    fireEvent.change(form.querySelectorAll('input')[2], { target: { value: 'secret1' } });
    fireEvent.submit(form);
    await waitFor(() => expect(calls.find((c) => c[0] === 'createUser')).toBeTruthy());
    expect(calls.find((c) => c[0] === 'createUser')[1].customRole).toBe('Delivery Boy');
  });

  it('non-admins don’t see the Designations panel', async () => {
    renderScreen(PermissionsPage, { auth: STAFF });
    await waitFor(() => expect(screen.getAllByText(/Asha/).length).toBeGreaterThan(0));
    expect(screen.queryByTestId('designations-panel')).toBeNull();
  });
});
