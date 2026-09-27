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
 * Today's (or the given instant's) day of the week in Lagos (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 */
export function getLagosDayOfWeek(date = new Date()) {
  const dateStr = getLagosDateStr(date);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Shop operating schedule (Lagos time).
// Resumption is 8:30 AM Monday–Saturday and 12:30 PM on Sunday; the shop is
// closed every Tuesday, so attendance is not recorded that day.
export const BUSINESS_SCHEDULE = {
  CLOSED_DAY: 2, // Tuesday
  RESUMPTION: {
    DEFAULT: { hour: 8, minute: 30 },  // Mon–Sat
    0: { hour: 12, minute: 30 },       // Sunday
  },
  CLOSING: {
    DEFAULT: { hour: 20, minute: 30 }, // Mon–Sat 8:30 PM
    0: { hour: 19, minute: 0 },        // Sunday 7:00 PM
  },
};

/**
 * Is the given Lagos day of week a non-working day for the shop?
 */
export function isShopClosedDay(dayOfWeek = getLagosDayOfWeek()) {
  return dayOfWeek === BUSINESS_SCHEDULE.CLOSED_DAY;
}

/**
 * The shop's resumption time for the given Lagos day of week,
 * or null on the closed day.
 */
export function getBusinessResumption(dayOfWeek = getLagosDayOfWeek()) {
  if (isShopClosedDay(dayOfWeek)) return null;
  return BUSINESS_SCHEDULE.RESUMPTION[dayOfWeek] || BUSINESS_SCHEDULE.RESUMPTION.DEFAULT;
}

/**
 * Is the current Lagos wall clock strictly after the given resumption time?
 * Matches the previous Date-comparison semantics (exactly the resumption time
 * is not late). When no resumption is passed, the day-aware shop schedule is
 * used and a closed day is never late.
 */
export function isLateNow(resumption = null) {
  const effective = resumption || getBusinessResumption();
  if (!effective) return false;
  const { hour, minute } = getLagosParts();
  return hour * 60 + minute > effective.hour * 60 + effective.minute;
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
