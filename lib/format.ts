/** Civil dates and appointment times are displayed in Central Time. Prices are integer cents. */
export function formatDate(value: string) {
  return date(value, { month: "long", day: "numeric", year: "numeric" });
}
export function formatShortDate(value: string) {
  return date(value, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
/** Compact "Dec 12" for button labels and tight summaries. */
export function formatMonthDay(value: string) {
  return date(value, { month: "short", day: "numeric" });
}
function date(value: string, options: Intl.DateTimeFormatOptions) {
  const parsed = new Date(`${value}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: "America/Chicago",
  }).format(parsed);
}
function clock(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const hour = Number(match[1]);
  return {
    time: `${hour % 12 || 12}:${match[2]}`,
    period: hour < 12 ? "AM" : "PM",
  };
}
export function formatTimeRange(start: string, end: string) {
  const a = clock(start),
    b = clock(end);
  if (!a || !b) return "Not set";
  return `${a.time}${a.period === b.period ? "" : ` ${a.period}`}–${b.time} ${b.period} CT`;
}
/** One Central Time clock time, for example "8:00 AM CT". */
export function formatTime(value: string) {
  const a = clock(value);
  return a ? `${a.time} ${a.period} CT` : "Not set";
}
/** Work time of a job; long-distance jobs show delivery and return days (Phase 9). */
export function formatWork(job: {
  start: string;
  end: string;
  endDate?: string;
  returnDate?: string | null;
}) {
  return job.returnDate && job.endDate
    ? `Long-distance: starts ${formatTime(job.start)}, delivery ${formatShortDate(job.endDate)} by ${formatTime(job.end)}, crew and truck back ${formatShortDate(job.returnDate)}`
    : formatTimeRange(job.start, job.end);
}
/** Compatibility for existing arrival-window fields; inputs are not reformatted. */
export function formatArrival(value: string) {
  const match = /^(\d{2}:\d{2})[–-](\d{2}:\d{2})(?: CT)?$/.exec(value);
  return match ? formatTimeRange(match[1], match[2]) : value;
}
export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
export function formatMessageTime(value: string) {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Chicago",
    }).format(new Date(value)) + " CT"
  );
}
