/**
 * An inactive teammate is marked as such on the user list.
 *
 * Switching someone off is a single checkbox in their Edit dialog, and it takes
 * them out of Team Attendance, the teammate pickers and every other list — but
 * the user list still showed them exactly like everyone else. So "why is Ahefaz
 * missing from Team Attendance?" had no answer visible anywhere on the screen
 * that controls it.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

const USERS = {
  u1: { name: 'Abid', email: 'abid@x.com', role: 'owner', active: true },
  u2: { name: 'Ahefaz Sheikh', email: 'ahefaz@x.com', role: 'staff', customRole: 'Production Head', active: false },
  u3: { name: 'Swati Gedam', email: 'swati@x.com', role: 'designer' }, // no flag at all = active
};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
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
    authApi: { ...actual.authApi, customRoles: vi.fn(async () => []) },
  };
});

const { default: PermissionsPage } = await import('../src/pages/PermissionsPage.jsx');

const rowFor = (name) => screen.getByText(name).closest('tr');

describe('the user list', () => {
  it('marks someone who cannot sign in', async () => {
    renderScreen(PermissionsPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Ahefaz Sheikh')).toBeTruthy());
    const badge = within(rowFor('Ahefaz Sheikh')).getByTestId('inactive-badge');
    expect(badge.textContent).toBe('inactive');
    // …and says what that means, since the consequence is felt on other screens.
    expect(badge.getAttribute('title')).toMatch(/Team Attendance/i);
  });

  it('leaves everyone else unmarked', async () => {
    renderScreen(PermissionsPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Abid')).toBeTruthy());
    expect(within(rowFor('Abid')).queryByTestId('inactive-badge')).toBeNull();
    // A user with no `active` field is active — the flag only counts when false.
    expect(within(rowFor('Swati Gedam')).queryByTestId('inactive-badge')).toBeNull();
    expect(screen.getAllByTestId('inactive-badge')).toHaveLength(1);
  });

  it('still lists the inactive teammate — this is where you switch them back on', async () => {
    renderScreen(PermissionsPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Ahefaz Sheikh')).toBeTruthy());
    expect(within(rowFor('Ahefaz Sheikh')).getByText('ahefaz@x.com')).toBeTruthy();
  });
});
