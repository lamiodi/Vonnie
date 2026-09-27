// Customer phone validation shared by booking forms.
// Accepts Nigerian numbers (08012345678, +2348012345678, 2348012345678) and
// international numbers in E.164-style format (+44 7911 123456), since some
// customers book from abroad. Spaces, dashes and parentheses are ignored.

export function sanitizePhone(raw) {
  return String(raw || '').replace(/[\s\-\(\)]/g, '');
}

// 0-prefixed local format and +234/234 country-code formats
const NIGERIAN = /^(?:\+?234|0)[789][01]\d{8}$/;
// Any other country: optional +, then 7–15 digits (E.164), no leading zero
const INTERNATIONAL = /^\+?[1-9]\d{6,14}$/;

/**
 * Returns an error message when the phone number is invalid, or null when
 * valid. An empty value is the caller's responsibility (required-field check).
 */
export function validatePhoneFormat(raw) {
  if (!raw || !String(raw).trim()) return null;
  let sanitized = sanitizePhone(raw);
  // Some countries use a 00 international prefix instead of +
  if (sanitized.startsWith('00')) sanitized = `+${sanitized.slice(2)}`;
  if (NIGERIAN.test(sanitized)) return null;
  if (INTERNATIONAL.test(sanitized)) return null;
  return 'Please enter a valid phone number (e.g. 08012345678 or +447911123456). International customers: include your country code starting with +.';
}
