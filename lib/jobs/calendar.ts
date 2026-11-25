import type { JobStatus } from "../domain/types";

export type CalendarJob = {
  id: string;
  date: string;
  start: string;
  end: string;
  arrivalStart: string;
  arrivalEnd: string;
  status: Exclude<JobStatus, "cancelled">;
  customer: string;
  truckId: string;
  truck: string;
  workers: { id: string; name: string }[];
  /** Set when this job cannot be reached in time from a crew's or truck's previous job. */
  travelWarning?: string;
  /** Phase 9: one day of a long-distance trip (the job repeats on each day). */
  trip?: TripDay;
};
export type TripDay = {
  day: number;
  days: number;
  phase: string;
  endDate: string;
  returnDate: string;
};

const dayNumber = (date: string) =>
  Math.floor(Date.parse(`${date}T12:00:00Z`) / 86400000);

/**
 * The days of a long-distance trip between `from` and `to` (inclusive), with
 * what the crew is doing: loading, driving, delivering or returning.
 */
export function tripDays(
  trip: { date: string; endDate: string; returnDate: string },
  from: string,
  to: string,
): { date: string; trip: TripDay }[] {
  const first = dayNumber(trip.date),
    delivery = dayNumber(trip.endDate) - first,
    last = dayNumber(trip.returnDate) - first;
  const result: { date: string; trip: TripDay }[] = [];
  for (let i = 0; i <= last; i++) {
    const date = new Date((first + i) * 86400000 + 43200000)
      .toISOString()
      .slice(0, 10);
    if (date < from || date > to) continue;
    const phase =
      i === 0 && delivery === 0
        ? "Loading, delivering, then driving back"
        : i === 0
          ? "Loading and driving"
          : i < delivery
            ? "Driving"
            : i === delivery
              ? i === last
                ? "Delivering, then driving back"
                : "Delivering, then starting back"
              : "Driving back";
    result.push({
      date,
      trip: {
        day: i + 1,
        days: last + 1,
        phase,
        endDate: trip.endDate,
        returnDate: trip.returnDate,
      },
    });
  }
  return result;
}
export type CalendarResource = { id: string; name: string; active: boolean };
export type CalendarView = "workers" | "trucks";

function civilDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
    value < "2000-01-03" ||
    value > "2099-12-27"
  )
    return false;
  const parsed = new Date(value + "T12:00:00Z");
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
// Work with civil dates at UTC noon, not elapsed hours across a Central Time DST change.
export function calendarDateOffset(value: string, days: number) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function calendarWeek(value: unknown, today: string) {
  const valid = civilDate(value);
  const selected = valid ? value : today;
  const weekday = new Date(selected + "T12:00:00Z").getUTCDay();
  const start = calendarDateOffset(selected, -((weekday + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, i) =>
    calendarDateOffset(start, i),
  );
  const previous = calendarDateOffset(start, -7),
    next = calendarDateOffset(start, 7);
  return {
    start,
    end: dates[6],
    dates,
    previous: civilDate(previous) ? previous : null,
    next: civilDate(next) ? next : null,
    invalid: value !== undefined && !valid,
  };
}
export function calendarHref(week: string, view: CalendarView) {
  return "/admin/jobs/calendar?" + new URLSearchParams({ week, view });
}
export function resourceJobs(
  jobs: CalendarJob[],
  view: CalendarView,
  id: string,
) {
  return jobs.filter((j) =>
    view === "trucks"
      ? j.truckId === id
      : id === "unassigned"
        ? j.workers.length === 0
        : j.workers.some((w) => w.id === id),
  );
}
export function calendarLanes(
  jobs: CalendarJob[],
  resources: CalendarResource[],
  view: CalendarView,
) {
  const all = new Map(resources.map((r) => [r.id, r]));
  for (const job of jobs) {
    const assigned =
      view === "trucks"
        ? [{ id: job.truckId, name: job.truck }]
        : job.workers.length
          ? job.workers
          : [{ id: "unassigned", name: "No assigned workers" }];
    for (const r of assigned)
      if (!all.has(r.id)) all.set(r.id, { ...r, active: true });
  }
  return [...all.values()]
    .filter((r) => r.active || resourceJobs(jobs, view, r.id).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((r) => ({
      ...r,
      jobs: resourceJobs(jobs, view, r.id).sort(
        (a, b) =>
          (a.date + a.start).localeCompare(b.date + b.start) ||
          a.id.localeCompare(b.id),
      ),
    }));
}
