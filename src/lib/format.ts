export const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function dateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Turns 2026-11-25 into 25 Nov 2026. Date-only values have no time zone to convert. */
export function niceDate(day: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(day + 'T00:00:00Z'));
}

/** Turns 2027-01 and 2027-12 into Jan 2027 to Dec 2027. */
export function monthRange(from: string, to: string) {
  const label = (month: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short', year: 'numeric' }).format(new Date(month + '-01T00:00:00Z'));
  return label(from) + ' to ' + label(to);
}

export function dayParts(iso: string, timeZone: string) {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(new Date(iso));
  return { day: part({ weekday: 'short' }).toUpperCase(), num: part({ day: 'numeric' }) };
}

export function timeOf(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

export function monthTitle(month: string) {
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year!, value! - 1, 1)));
}

export function shortDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** How far ahead of UTC a zone is at a moment, in milliseconds. */
function zoneOffset(utcMs: number, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(utcMs))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Turns "2027-03-01T17:30", as typed for the academy's time zone, into a UTC instant. */
export function zonedToUtc(local: string, timeZone: string): string {
  const guess = new Date(`${local}:00Z`).getTime();
  const first = guess - zoneOffset(guess, timeZone);
  // The second pass corrects a guess that landed on the other side of a clock change.
  return new Date(guess - zoneOffset(first, timeZone)).toISOString();
}

/** The reverse, for filling in an edit form. */
export function utcToZonedInput(iso: string, timeZone: string): string {
  const ms = new Date(iso).getTime();
  return new Date(ms + zoneOffset(ms, timeZone)).toISOString().slice(0, 16);
}

export function monthIn(timeZone: string, now = new Date()): string {
  return utcToZonedInput(now.toISOString(), timeZone).slice(0, 7);
}

export function todayIn(timeZone: string, now = new Date()): string {
  return utcToZonedInput(now.toISOString(), timeZone).slice(0, 10);
}
