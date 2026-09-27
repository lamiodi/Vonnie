// All attendance "days" are Lagos calendar days (Africa/Lagos, UTC+1, no DST).
// Timestamps are stored in Postgres as timestamptz (UTC); these helpers convert
// between the storage format and Lagos wall-clock labels without re-parsing
// locale strings (which silently yields Invalid Date on some ICU builds).

const LAGOS_TZ = 'Africa/Lagos';

/**
 * Get the Lagos wall-clock components for an instant.
 * @param {Date} date
 * @returns {{date: string, hour: number, minute: number, second: number}}
 *   date is 'YYYY-MM-DD' (en-CA format).
 */
export function getLagosParts(date = new Date()) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date)) {
    parts[p.type] = p.value;
  }
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

/**
 * Today's (or the given instant's) calendar date in Lagos as 'YYYY-MM-DD'.
 */
export function getLagosDateStr(date = new Date()) {
  return getLagosParts(date).date;
}

/**
 * Is the current Lagos wall clock strictly after the given resumption time?
 * Matches the previous Date-comparison semantics (exactly 09:00 is not late).
 */
export function isLateNow(resumption = { hour: 9, minute: 0 }) {
  const { hour, minute } = getLagosParts();
  return hour * 60 + minute > resumption.hour * 60 + resumption.minute;
}

/**
 * Format an instant as a Lagos wall-clock time string, e.g. "09:45 AM".
 */
export function formatLagosTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * UTC Date boundaries for a Lagos calendar day.
 * @param {string} lagosDateStr 'YYYY-MM-DD'
 * @returns {{startUTC: Date, endUTC: Date}} endUTC is exclusive
 */
export function lagosDayBoundsUTC(lagosDateStr) {
  // Lagos is fixed UTC+1, so midnight Lagos = 23:00 UTC of the previous day.
  const startUTC = new Date(`${lagosDateStr}T00:00:00+01:00`);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { startUTC, endUTC };
}
