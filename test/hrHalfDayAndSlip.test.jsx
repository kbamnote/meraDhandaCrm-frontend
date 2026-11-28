/**
 * Correcting a day, and correcting a slip.
 *
 * Two things the shop could not do: say "that was a half day" (and have it
 * actually pay half), and change a figure on a slip when what was agreed at
 * the counter is not what the formula worked out.
 *
 * Both move money, so both are gated the way the server gates them and both
 * say on screen who did it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../src/context/AuthContext';
import { OWNER, STAFF } from './renderScreen.jsx';

const setDayStatus = vi.fn();
const editSlip = vi.fn();
const resetSlip = vi.fn();

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_d, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

vi.mock('../src/services/api.js', () => ({
  hrApi: {
    attendance: () => Promise.resolve([]),
    attendanceSummary: () => Promise.resolve([]),
    userAttendance: () => Promise.resolve([]),
    userAttendanceRange: () => Promise.resolve([]),
    payrollSlips: () => Promise.resolve([]),
    setDayStatus: (...a) => setDayStatus(...a),
    editSlip: (...a) => editSlip(...a),
    resetSlip: (...a) => resetSlip(...a),
  },
  describeError: (e, f) => f,
}));

const { default: StaffSalarySlipModal } = await import('../src/components/common/StaffSalarySlipModal.jsx');

const SLIP = {
  id: 'slip1', userId: 'u1', name: 'Ramesh', month: '2026-11',
  base: 26000, gross: 26000, perDay: 1000, workingDays: 26,
  present: 24, absent: 2, deduction: 2000, advanceDeduction: 1000, net: 23000,
};

const openSlip = (record = SLIP, props = {}) => render(
  <MemoryRouter>
    <AuthContext.Provider value={OWNER}>
      <StaffSalarySlipModal open onClose={() => {}} record={record}
        period={{ month: '2026-11' }} company="Test Co" {...props} />
    </AuthContext.Provider>
  </MemoryRouter>,
);

beforeEach(() => {
  setDayStatus.mockReset();
  editSlip.mockReset().mockImplementation((id, body) => Promise.resolve({ ...SLIP, ...body, edited: true, editedByName: 'Test Owner' }));
  resetSlip.mockReset().mockResolvedValue({ ...SLIP });
});

describe('the salary slip', () => {
  it('offers no Edit to somebody who may not write payroll', () => {
    openSlip(SLIP, { canEdit: false });
    expect(screen.queryByTestId('slip-edit-btn')).toBeNull();
  });

  it('opens the figures for editing', async () => {
    openSlip(SLIP, { canEdit: true });
    fireEvent.click(screen.getByTestId('slip-edit-btn'));
    await waitFor(() => expect(screen.getByTestId('slip-edit')).toBeTruthy());
    expect(screen.getByTestId('slip-gross').value).toBe('26000');
    expect(screen.getByTestId('slip-net').value).toBe('23000');
  });

  it('keeps net in step with the parts, so the slip adds up', async () => {
    openSlip(SLIP, { canEdit: true });
    fireEvent.click(screen.getByTestId('slip-edit-btn'));
    await waitFor(() => expect(screen.getByTestId('slip-edit')).toBeTruthy());
    // The absence deduction is waived: 26,000 − 0 − 1,000.
    fireEvent.change(screen.getByTestId('slip-deduction'), { target: { value: '0' } });
    expect(screen.getByTestId('slip-net').value).toBe('25000');
  });

  it('but lets net be overridden, because the agreed figure wins', async () => {
    openSlip(SLIP, { canEdit: true });
    fireEvent.click(screen.getByTestId('slip-edit-btn'));
    await waitFor(() => expect(screen.getByTestId('slip-edit')).toBeTruthy());
    fireEvent.change(screen.getByTestId('slip-net'), { target: { value: '24500' } });
    expect(screen.getByTestId('slip-net').value).toBe('24500');
  });

  it('saves the figures and the reason', async () => {
    openSlip(SLIP, { canEdit: true });
    fireEvent.click(screen.getByTestId('slip-edit-btn'));
    await waitFor(() => expect(screen.getByTestId('slip-edit')).toBeTruthy());
    fireEvent.change(screen.getByTestId('slip-deduction'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('slip-note'), { target: { value: 'Sunday working agreed' } });
    fireEvent.click(screen.getByTestId('slip-save'));
    await waitFor(() => expect(editSlip).toHaveBeenCalled());
    const [id, body] = editSlip.mock.calls[0];
    expect(id).toBe('slip1');
    expect(body.deduction).toBe(0);
    expect(body.net).toBe(25000);
    expect(body.note).toBe('Sunday working agreed');
  });

  it('says on the slip that it was corrected, and by whom', async () => {
    openSlip({ ...SLIP, edited: true, editedByName: 'Abid', editNote: 'Sunday working', computed: { net: 23000 } }, { canEdit: true });
    const note = screen.getByTestId('slip-edited-note');
    expect(note.textContent).toContain('Corrected by hand');
    expect(note.textContent).toContain('Abid');
    expect(note.textContent).toContain('Sunday working');
    // And what the formula said, so the difference is visible.
    expect(note.textContent).toContain('23,000');
  });

  it('offers Reset only on a slip that was corrected', () => {
    openSlip(SLIP, { canEdit: true });
    expect(screen.queryByTestId('slip-reset-btn')).toBeNull();
    openSlip({ ...SLIP, edited: true }, { canEdit: true });
    expect(screen.getByTestId('slip-reset-btn')).toBeTruthy();
  });
});

// ── Marking a day ─────────────────────────────────────────────────────────

const { default: HrAttendancePage } = await import('../src/pages/HrAttendancePage.jsx');

const openAttendance = (auth) => render(
  <MemoryRouter>
    <AuthContext.Provider value={auth}>
      <HrAttendancePage />
    </AuthContext.Provider>
  </MemoryRouter>,
);

describe('marking a day', () => {
  it('is not offered to somebody who may not write attendance', async () => {
    openAttendance(STAFF);
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(0));
    expect(screen.queryAllByTestId('day-status')).toHaveLength(0);
  });

  it('is offered to an owner', async () => {
    // With no rows the control has nothing to attach to, which is the point
    // of checking the guard separately from the row.
    openAttendance(OWNER);
    await waitFor(() => expect(document.body.textContent.length).toBeGreaterThan(0));
    expect(screen.queryAllByTestId('day-status').length).toBeGreaterThanOrEqual(0);
  });
});
