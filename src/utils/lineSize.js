/**
 * The size rule shared by every document that carries priced lines — the
 * invoice, the purchase bill and the job card.
 *
 * A print shop quotes some work by the piece and some by the area it covers,
 * so a line carries both: length x width x qty is the area, and `rateOn` says
 * which of the two the rate multiplies. One copy, because three copies drift
 * and a job card that priced a line differently from the invoice raised off
 * it would be a bug nobody could see.
 *
 * Mirrors sizeOf()/priceLines() in the server's accounting routes.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The area a line covers, in whatever unit the line names.
 *
 * Nothing is converted: an 8 x 5 inch offset job and a 4 x 8 foot flex job
 * each multiply out in their own unit, which is the one shown beside the
 * figure. Converting would quietly restate a size the customer agreed to.
 *
 * Both sides must be known — one of them alone is a measurement, not an area.
 */
export const lineArea = (it) => {
  const l = Number(it && it.length) || 0;
  const w = Number(it && it.width) || 0;
  const q = Number(it && it.qty) || 0;
  return l > 0 && w > 0 ? round2(l * w * q) : 0;
};

/**
 * What the line comes to before any discount — the rate times whichever
 * basis it is charged on.
 *
 * Falls back to qty when there is no area to charge against, so a line set to
 * "rate per area" before its size was filled in prices at the qty rather than
 * at zero.
 */
export const lineGross = (it) => {
  const area = lineArea(it);
  const basis = it && it.rateOn === 'area' && area > 0 ? area : (Number(it && it.qty) || 0);
  return round2(basis * (Number(it && it.rate) || 0));
};
