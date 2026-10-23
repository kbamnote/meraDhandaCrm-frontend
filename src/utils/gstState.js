/**
 * Indian GST state codes — the first two digits of any GSTIN identify the state
 * it was issued in.
 *
 * A GST document is expected to show the party's state and its code, and the
 * GSTIN already carries both: asking anyone to type them again is asking for a
 * document whose code and GSTIN disagree.
 *
 * Mirrors the backend's src/config/gstStates.js. Kept in step by hand — the two
 * are only ever appended to, when a new code is notified.
 */
export const STATE_CODES = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh',
  '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

/** The two-digit code, or '' when the GSTIN isn't a plausible one. */
export function stateCodeFromGstin(gstin) {
  const code = String(gstin || '').trim().slice(0, 2);
  return STATE_CODES[code] ? code : '';
}

/** The state name, or '' — never throws; this feeds a printed document. */
export function stateFromGstin(gstin) {
  return STATE_CODES[stateCodeFromGstin(gstin)] || '';
}

/**
 * The code for a state the user picked by name (Place of Supply), so a party
 * without a GSTIN — an unregistered customer — can still show a state code.
 */
export function codeForState(name) {
  const want = String(name || '').trim().toLowerCase();
  if (!want) return '';
  const hit = Object.entries(STATE_CODES).find(([, n]) => n.toLowerCase() === want);
  return hit ? hit[0] : '';
}

export const STATE_LIST = Object.entries(STATE_CODES).map(([code, name]) => ({ code, name }));
