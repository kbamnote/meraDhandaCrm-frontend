/**
 * What a line is measured in.
 *
 * It was a free-text box, which is how the same unit ends up spelled three
 * ways and no report can group by it. It is now a picker: four defaults, the
 * shop's own saved alongside them, and an add that keeps what you type.
 *
 * A print shop needs the add. The job sheet this was built from uses Inch,
 * Sqft, Sqft/Pcs, Sqft/Pcs/Min and Pcs/Other-Typing on one page.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listed = vi.fn();
const added = vi.fn();

vi.mock('../src/services/api.js', () => ({
  accountingApi: {
    units: (...a) => listed(...a),
    addUnit: (...a) => added(...a),
  },
  describeError: (e, f) => f,
}));

const { default: UnitSelect, DEFAULT_UNITS, resetUnitCache } =
  await import('../src/components/common/UnitSelect.jsx');

const show = (value = '', onChange = () => {}) =>
  render(<UnitSelect value={value} onChange={onChange} />);
const box = () => screen.getByTestId('unit-select');
const options = () => [...box().options].map((o) => o.textContent);

beforeEach(() => {
  resetUnitCache();
  listed.mockReset();
  added.mockReset();
  listed.mockResolvedValue({ units: [{ name: 'Sqft' }, { name: 'Inch' }, { name: 'Pcs' }, { name: 'Other' }, { name: 'Sqft/Pcs' }] });
  added.mockImplementation((name) => Promise.resolve({ name, added: true }));
});
afterEach(() => resetUnitCache());

describe('the unit picker', () => {
  it('offers the shop’s units and a way to add one', async () => {
    show();
    await waitFor(() => expect(options()).toContain('Sqft/Pcs'));
    expect(options()).toEqual(expect.arrayContaining(['Sqft', 'Inch', 'Pcs', 'Other', 'Sqft/Pcs']));
    expect(options()).toContain('+ Add unit…');
  });

  it('falls back to the defaults when the list cannot be fetched', async () => {
    // A bill has to stay writable when the network is having a bad morning.
    listed.mockRejectedValue(new Error('offline'));
    show();
    await waitFor(() => expect(options()).toContain('Sqft'));
    for (const u of DEFAULT_UNITS) expect(options()).toContain(u);
  });

  it('keeps a unit the line already carries, even if it is not on the list', async () => {
    // A bill written before the picker existed, or on another device.
    // Dropping it would quietly change what was billed.
    show('Running ft');
    await waitFor(() => expect(listed).toHaveBeenCalled());
    expect(options()).toContain('Running ft');
    expect(box().value).toBe('Running ft');
  });

  it('asks only once however many lines a bill has', async () => {
    // Twenty lines used to mean twenty identical requests on open.
    render(<><UnitSelect value="" onChange={() => {}} /><UnitSelect value="" onChange={() => {}} /><UnitSelect value="" onChange={() => {}} /></>);
    await waitFor(() => expect(listed).toHaveBeenCalled());
    expect(listed).toHaveBeenCalledTimes(1);
  });
});

describe('adding one', () => {
  it('saves it, selects it, and keeps it for next time', async () => {
    const onChange = vi.fn();
    show('', onChange);
    await waitFor(() => expect(listed).toHaveBeenCalled());
    fireEvent.change(box(), { target: { value: '__add_unit__' } });
    const input = await screen.findByTestId('unit-select-new');
    fireEvent.change(input, { target: { value: 'Sqft/Pcs/Min' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(added).toHaveBeenCalledWith('Sqft/Pcs/Min'));
    expect(onChange).toHaveBeenCalledWith('Sqft/Pcs/Min');
    await waitFor(() => expect(options()).toContain('Sqft/Pcs/Min'));
  });

  it('puts it on every other line too, not just the one that added it', async () => {
    render(<><UnitSelect value="" onChange={() => {}} testId="a" /><UnitSelect value="" onChange={() => {}} testId="b" /></>);
    await waitFor(() => expect(listed).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('a'), { target: { value: '__add_unit__' } });
    const input = await screen.findByTestId('a-new');
    fireEvent.change(input, { target: { value: 'Running ft' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(added).toHaveBeenCalled());
    const other = () => [...screen.getByTestId('b').options].map((o) => o.textContent);
    await waitFor(() => expect(other()).toContain('Running ft'));
  });

  it('typing nothing just goes back, and saves no empty unit', async () => {
    show();
    await waitFor(() => expect(listed).toHaveBeenCalled());
    fireEvent.change(box(), { target: { value: '__add_unit__' } });
    const input = await screen.findByTestId('unit-select-new');
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByTestId('unit-select')).toBeTruthy());
    expect(added).not.toHaveBeenCalled();
  });

  it('Escape abandons it', async () => {
    show();
    await waitFor(() => expect(listed).toHaveBeenCalled());
    fireEvent.change(box(), { target: { value: '__add_unit__' } });
    const input = await screen.findByTestId('unit-select-new');
    fireEvent.change(input, { target: { value: 'Oops' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('unit-select')).toBeTruthy());
    expect(added).not.toHaveBeenCalled();
  });

  it('a refused save leaves the box alone rather than losing what was typed', async () => {
    const onChange = vi.fn();
    added.mockRejectedValue(new Error('nope'));
    show('', onChange);
    await waitFor(() => expect(listed).toHaveBeenCalled());
    fireEvent.change(box(), { target: { value: '__add_unit__' } });
    const input = await screen.findByTestId('unit-select-new');
    fireEvent.change(input, { target: { value: 'Bad' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(added).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('unit-select-new')).toBeTruthy();
  });
});
