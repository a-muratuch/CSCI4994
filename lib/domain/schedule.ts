import type { Day, Availability, WorkerJobView } from "./types";
export const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export function availabilityErrors(
  rows: Availability[],
): Partial<Record<Day, string>> {
  const errors: Partial<Record<Day, string>> = {};
  for (const day of days) {
    const matches = rows.filter((row) => row.day === day);
    const row = matches[0];
    if (matches.length !== 1) errors[day] = "Provide one entry for this day.";
    else if (
      row.available &&
      (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end) ||
        row.end <= row.start)
    )
      errors[day] =
        "Enter valid times with end later than start. Overnight availability is not supported in this version.";
  }
  return errors;
}
export function validDate(date: string) {
  const parsed = new Date(date + "T12:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}
export function validTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function intervalError(
  date: string,
  start: string,
  end: string,
): string | undefined {
  if (!validDate(date) || !validTime(start) || !validTime(end))
    return "Enter a valid date and both times in Central Time.";
  if (end <= start)
    return "End must be later than start on the same day. Overnight intervals are unavailable.";
}
export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return aStart < bEnd && bStart < aEnd;
}
export function dayForJob(job: WorkerJobView): Day {
  return days[(new Date(`${job.date}T12:00:00`).getDay() + 6) % 7];
}
