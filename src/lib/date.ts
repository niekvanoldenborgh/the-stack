/**
 * Minimal date helpers working in local time on `YYYY-MM-DD` strings.
 *
 * Everything schedule-related in this app is date-based rather than
 * instant-based: "your Tuesday dose" should stay on Tuesday regardless of
 * timezone travel or DST. Storing plain date strings and only attaching a wall
 * clock time at notification-scheduling time is what makes that hold.
 */

export type ISODate = string;

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses to local midnight, avoiding the UTC shift of `new Date('2026-01-01')`. */
export function fromISODate(iso: ISODate): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addWeeks(iso: ISODate, weeks: number): ISODate {
  return addDays(iso, weeks * 7);
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = fromISODate(from).getTime();
  const b = fromISODate(to).getTime();
  // Round rather than floor so a DST transition inside the span cannot shift
  // the answer by a day.
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: ISODate): number {
  const jsDay = fromISODate(iso).getDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatShort(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatLong(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${WEEKDAY_LABELS[weekdayIndex(iso)]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Cycle plans routinely run past new year. Omitting the year there turns a
 * 60-week plan into something that reads as eight weeks, so the year is shown
 * whenever the range leaves the current one.
 */
export function formatRange(from: ISODate, to: ISODate): string {
  const fromYear = fromISODate(from).getFullYear();
  const toYear = fromISODate(to).getFullYear();
  const currentYear = new Date().getFullYear();

  if (fromYear === toYear) {
    return fromYear === currentYear
      ? `${formatShort(from)} – ${formatShort(to)}`
      : `${formatShort(from)} – ${formatShort(to)} ${toYear}`;
  }
  const fromLabel = fromYear === currentYear ? formatShort(from) : `${formatShort(from)} ${fromYear}`;
  return `${fromLabel} – ${formatShort(to)} ${toYear}`;
}

/** Human-friendly relative label used across the dashboard. */
export function relativeLabel(iso: ISODate): string {
  const delta = diffDays(today(), iso);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta < 7) return WEEKDAY_LABELS[weekdayIndex(iso)]!;
  return formatShort(iso);
}

/** Parses "HH:mm" into minutes past midnight, for sorting. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function formatTime(time: string): string {
  return time;
}

/** The Monday of the week `iso` falls in. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso));
}

/** Inclusive list of dates from `from` to `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const total = diffDays(from, to);
  for (let i = 0; i <= total; i++) out.push(addDays(from, i));
  return out;
}
