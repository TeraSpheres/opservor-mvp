/* Dates and times, written so they cannot be misread.
 *
 * Two places rendered timestamps with toLocaleString() and no locale, which
 * means the browser decides. On a machine set to en-US that produced
 * "8/29/2026" — month first.
 *
 * In logistics that is not a cosmetic problem. 03/04 is March in one country
 * and April in another, and the people this product is for read delivery
 * dates, service dates and expiry dates for a living, often on somebody
 * else's screen. A date that has to be interpreted is a date that will
 * eventually be interpreted wrongly, and the product's whole argument is
 * that it does not ask you to guess.
 *
 * So the month is always a name. "29 Aug 2026" cannot be read as anything
 * else anywhere in the world.
 *
 * en-GB is passed explicitly rather than left to the browser: without it the
 * same code produces a different string on a colleague's laptop, and two
 * people comparing screenshots of the same finding would see two dates.
 */

const DATE: Intl.DateTimeFormatOptions = {
  day: 'numeric', month: 'short', year: 'numeric',
};

const DATE_TIME: Intl.DateTimeFormatOptions = {
  ...DATE, hour: '2-digit', minute: '2-digit', hour12: false,
};

/** "29 Aug 2026". Use wherever only the day matters. */
export function fmtDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-GB', DATE) : '—';
}

/** "29 Aug 2026, 11:45". Use for anything that records when something ran. */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleString('en-GB', DATE_TIME) : '—';
}

/* An em dash rather than "Invalid Date" or a crash. A missing timestamp is a
 * real state — a connector that has never run, a check never executed — and
 * the interface should say so quietly rather than fail. */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
