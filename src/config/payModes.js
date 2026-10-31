/**
 * How money moves — the one list of payment modes.
 *
 * There were five of these hardcoded across the app and no two matched: a
 * sales invoice could not take a cheque, while a purchase could; the order
 * differed on every screen. They are one list now, so a mode offered in one
 * place is offered in all of them.
 *
 * The strings are the stored values, not labels — they are written onto
 * payments, invoices and purchases, and the server reads 'cash' from them
 * case-insensitively to decide the drawer. Renaming one here renames it only
 * for new records, so don't.
 */
export const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'];

/** Does this mode mean the cash drawer? Mirrors the server's own test. */
export const isCashMode = (m) => String(m || '').trim().toLowerCase() === 'cash';

/**
 * The list to show for a record that already has a mode.
 *
 * A mode that is not in PAY_MODES — imported data, or one typed back when
 * this was a free-text box — is kept as an option rather than dropped. A
 * plain <select> would otherwise show the first entry and silently rewrite
 * the record to it on the next save.
 */
export function modeOptions(current) {
  const v = String(current || '').trim();
  if (!v || PAY_MODES.some((m) => m.toLowerCase() === v.toLowerCase())) return PAY_MODES;
  return [...PAY_MODES, v];
}
