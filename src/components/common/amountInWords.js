/**
 * Indian-system number-to-words for invoice "Amount (in words)".
 *
 * Uses the Indian grouping (thousand → lakh → crore), NOT the western
 * million/billion scale — an Indian tax invoice reading "one million" would be
 * wrong. Paise are rendered only when there is a non-zero fractional part.
 */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

// 0–99
function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10); const r = n % 10;
  return TENS[t] + (r ? ' ' + ONES[r] : '');
}

// 0–999
function threeDigits(n) {
  const h = Math.floor(n / 100); const r = n % 100;
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigits(r) : '');
}

// Whole rupees → words, Indian grouping.
export function numberToWordsIndian(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Full invoice line, e.g.
 *   5782      -> "Five Thousand Seven Hundred Eighty Two Rupees Only"
 *   1250.50   -> "One Thousand Two Hundred Fifty Rupees and Fifty Paise Only"
 */
export function amountInWords(amount) {
  const value = Number(amount) || 0;
  // Round to paise first so 0.005 float noise can't produce "and Zero Paise".
  const totalPaise = Math.round(Math.abs(value) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  const sign = value < 0 ? 'Minus ' : '';
  const head = `${numberToWordsIndian(rupees)} Rupees`;
  return paise
    ? `${sign}${head} and ${twoDigits(paise)} Paise Only`
    : `${sign}${head} Only`;
}

export default amountInWords;
