/** Find the first matching element. */
export function $(selector, root) {
  return (root || document).querySelector(selector);
}

/** Create a reasonably unique client-side identifier. */
export function uid() {
  return 'id-' + new Date().getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Convert input to a finite number, defaulting invalid values to zero. */
export function num(value) {
  var result = Number(value);
  return isFinite(result) ? result : 0;
}

/** Escape text before inserting it into HTML markup. */
export function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function(character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

/** Format a number as Russian rubles. */
export function fmt(value) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num(value)) + ' ₽';
}

/** Format a number using Russian separators without currency. */
export function fmtN(value) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(num(value));
}

/** Format a day quantity with up to two fractional digits. */
export function fmtDays(value) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(num(value));
}

/** Return a two-digit decimal field without String.padStart. */
function twoDigits(value) {
  return value < 10 ? '0' + value : String(value);
}

/** Format a date using local calendar fields. */
export function ymd(date) {
  return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

/** Return today's local date in YYYY-MM-DD format. */
export function today() {
  return ymd(new Date());
}

/** Check if a date string lies within an inclusive date range. */
export function inR(date, from, to) {
  return !!date && date >= from && date <= to;
}

/** Normalize common Russian phone number inputs to +7XXXXXXXXXX. */
export function normalizePhone(value) {
  var digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && (digits.charAt(0) === '8' || digits.charAt(0) === '7')) digits = digits.slice(1);
  if (digits.length === 10) return '+7' + digits;
  return '';
}

/** Format a phone number for display. */
export function formatPhone(value) {
  var digits = String(value || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return value || '—';
  return '+7 ' + digits.slice(0, 3) + ' ' + digits.slice(3, 6) + '-' + digits.slice(6, 8) + '-' + digits.slice(8);
}
