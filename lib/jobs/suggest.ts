/**
 * Crew and truck suggestions for one job. Pure; the server supplies the day's
 * jobs with travel minutes already computed. Suggestions are advisory: the
 * administrator applies them and saving re-checks everything.
 */
import {
  checkResource,
  durationText,
  issueText,
  toMinutes,
  type DayJob,
  type ResourceCheck,
} from "./travel.ts";

export type ScheduleOptions = {
  pickupPlace: string | null;
  destinationPlace: string | null;
  /** Inventory volume in cubic feet; 0 when no inventory was listed. */
  volume: number;
  /** Suggested crew size (from the inventory suggestion; 2 otherwise). */
  crewTarget: number;
  /** Expected job length in minutes (Phase 8D); four hours when absent. */
  jobMinutes?: number;
  /** Phase 9 trip planning inputs (see lib/jobs/long-distance.ts). */
  trip?: {
    workMinutes: number;
    driveMinutes: number | null;
    minimumMinutes: number;
  };
  /** Phase 9: other jobs occupying a day of the span (multi-day moves). */
  away?: {
    id: string;
    from: string;
    until: string;
    workerIds: string[];
    truckId: string;
  }[];
  jobs: DayJob[];
  workers: {
    id: string;
    name: string;
    available: boolean;
    availableStart: string | null;
    availableEnd: string | null;
    weekMinutes: number;
    fourWeekMinutes: number;
    /** Phase 9: available on every later day of a multi-day span. */
    availableEveryDay?: boolean;
    /** Readable later trip days without availability (added by the form). */
    missingDays?: string[];
  }[];
  trucks: { id: string; name: string; capacity: number | null }[];
};

export type Candidate = {
  id: string;
  name: string;
  reasons: string[];
  check: ResourceCheck;
};
export type Excluded = { id: string; name: string; reason: string };

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} h`;

function travelReason(check: ResourceCheck) {
  if (check.unknown.length)
    return "Travel time from a neighbouring job is unknown; confirm before saving.";
  return check.deadheadMinutes
    ? `Previous job is about ${durationText(check.deadheadMinutes)} away (with turnaround).`
    : "No earlier job that day.";
}

function firstProblem(
  check: ResourceCheck,
  options: ScheduleOptions,
): string | null {
  if (check.ok) return null;
  const issue =
    check.issues.find((i) => i.kind === "overlap") ?? check.issues[0];
  const text = issueText(issue, options);
  return check.earliestStart && issue.kind === "before"
    ? `${text} Earliest feasible start: ${check.earliestStart}.`
    : text;
}

/** "A", "A and B", "A, B and C". */
export function listText(items: readonly string[]) {
  return items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The other move keeping a worker or truck away during this job, if any. */
function awayUntil(
  options: ScheduleOptions,
  match: (job: NonNullable<ScheduleOptions["away"]>[number]) => boolean,
) {
  return (options.away ?? [])
    .filter(match)
    .map((job) => job.until)
    .sort()
    .at(-1);
}

/**
 * Suggested crew and truck. `multiDay` is true for a long-distance job: the
 * crew must be available from the start time and on every later day, and
 * nothing else may be booked for them that day after the start.
 */
export function suggestTeam(
  options: ScheduleOptions,
  start: string,
  end: string,
  multiDay = false,
) {
  // A long-distance job occupies the rest of its first day.
  if (multiDay) end = "23:59";
  const s = toMinutes(start),
    e = toMinutes(end);
  const eligibleWorkers: Candidate[] = [];
  const excludedWorkers: Excluded[] = [];
  for (const worker of options.workers) {
    const away = awayUntil(options, (job) => job.workerIds.includes(worker.id));
    if (away) {
      excludedWorkers.push({
        id: worker.id,
        name: worker.name,
        reason: `Away on another move until ${away}.`,
      });
      continue;
    }
    if (
      multiDay &&
      (worker.availableEveryDay === false || worker.missingDays?.length)
    ) {
      excludedWorkers.push({
        id: worker.id,
        name: worker.name,
        reason: worker.missingDays?.length
          ? `Not available on ${listText(worker.missingDays)} (during the trip).`
          : "Not available on every day of the trip.",
      });
      continue;
    }
    if (
      !worker.available ||
      !worker.availableStart ||
      !worker.availableEnd ||
      toMinutes(worker.availableStart) > s ||
      (!multiDay && toMinutes(worker.availableEnd) < e)
    ) {
      excludedWorkers.push({
        id: worker.id,
        name: worker.name,
        reason:
          worker.available && worker.availableStart && worker.availableEnd
            ? `Available only ${worker.availableStart}–${worker.availableEnd}.`
            : "Not available that day.",
      });
      continue;
    }
    const check = checkResource(
      options.jobs.filter((job) => job.workerIds.includes(worker.id)),
      start,
      end,
    );
    const problem = firstProblem(check, options);
    if (problem) {
      excludedWorkers.push({
        id: worker.id,
        name: worker.name,
        reason: problem,
      });
      continue;
    }
    eligibleWorkers.push({
      id: worker.id,
      name: worker.name,
      check,
      reasons: [
        `Available ${worker.availableStart}–${worker.availableEnd}.`,
        `${hours(worker.weekMinutes)} booked this week, ${hours(worker.fourWeekMinutes)} over four weeks.`,
        travelReason(check),
      ],
    });
  }
  // Fairness first (least booked), then least empty driving, then name.
  const workerFacts = new Map(options.workers.map((w) => [w.id, w]));
  eligibleWorkers.sort((a, b) => {
    const wa = workerFacts.get(a.id)!,
      wb = workerFacts.get(b.id)!;
    return (
      wa.weekMinutes - wb.weekMinutes ||
      wa.fourWeekMinutes - wb.fourWeekMinutes ||
      a.check.deadheadMinutes - b.check.deadheadMinutes ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    );
  });

  const eligibleTrucks: (Candidate & { capacity: number | null })[] = [];
  const excludedTrucks: Excluded[] = [];
  for (const truck of options.trucks) {
    const away = awayUntil(options, (job) => job.truckId === truck.id);
    if (away) {
      excludedTrucks.push({
        id: truck.id,
        name: truck.name,
        reason: `Away on another move until ${away}.`,
      });
      continue;
    }
    if (
      options.volume > 0 &&
      truck.capacity !== null &&
      truck.capacity < options.volume
    ) {
      excludedTrucks.push({
        id: truck.id,
        name: truck.name,
        reason: `Holds ${truck.capacity} cu ft; the inventory is ${options.volume} cu ft.`,
      });
      continue;
    }
    const check = checkResource(
      options.jobs.filter((job) => job.truckId === truck.id),
      start,
      end,
    );
    const problem = firstProblem(check, options);
    if (problem) {
      excludedTrucks.push({ id: truck.id, name: truck.name, reason: problem });
      continue;
    }
    eligibleTrucks.push({
      id: truck.id,
      name: truck.name,
      capacity: truck.capacity,
      check,
      reasons: [
        truck.capacity === null
          ? "Capacity not set."
          : options.volume > 0
            ? `Holds ${truck.capacity} cu ft for ${options.volume} cu ft.`
            : `Holds ${truck.capacity} cu ft.`,
        travelReason(check),
      ],
    });
  }
  // Best fit: smallest known capacity that fits, unknown capacities last.
  eligibleTrucks.sort(
    (a, b) =>
      (a.capacity ?? Infinity) - (b.capacity ?? Infinity) ||
      a.check.deadheadMinutes - b.check.deadheadMinutes ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );

  const crew = eligibleWorkers.slice(0, options.crewTarget);
  return {
    crew,
    truck: eligibleTrucks[0] ?? null,
    eligibleWorkers,
    eligibleTrucks,
    excludedWorkers,
    excludedTrucks,
    /** Workers still needed to reach the crew target. */
    shortBy: Math.max(0, options.crewTarget - crew.length),
  };
}

/**
 * Checks a chosen crew and truck (suggested or hand-picked). Used by the form
 * and again by the server before saving.
 */
export function checkSelection(
  options: ScheduleOptions,
  start: string,
  end: string,
  workerIds: readonly string[],
  truckId: string,
  multiDay = false,
) {
  if (multiDay) end = "23:59";
  const blocking: string[] = [];
  const unknown: string[] = [];
  let earliestStart: string | null = null;
  const names = new Map([
    ...options.workers.map((w) => [w.id, w.name] as const),
    ...options.trucks.map((t) => [t.id, t.name] as const),
  ]);
  const resources = [
    ...workerIds.map((id) => ({
      id,
      jobs: options.jobs.filter((job) => job.workerIds.includes(id)),
    })),
    {
      id: truckId,
      jobs: options.jobs.filter((job) => job.truckId === truckId),
    },
  ];
  for (const resource of resources) {
    const name = names.get(resource.id) ?? "Selected resource";
    const away = awayUntil(
      options,
      (job) =>
        job.truckId === resource.id || job.workerIds.includes(resource.id),
    );
    if (away) blocking.push(`${name}: away on another move until ${away}.`);
    const check = checkResource(resource.jobs, start, end);
    for (const issue of check.issues)
      if (issue.kind !== "overlap")
        // Overlaps are already reported by the existing booking check and save_job.
        blocking.push(`${name}: ${issueText(issue, options)}`);
    if (
      check.earliestStart &&
      (!earliestStart || check.earliestStart > earliestStart)
    )
      earliestStart = check.earliestStart;
    for (const job of check.unknown)
      unknown.push(
        `${name}: travel time to or from the job at ${job.start}–${job.end} is unknown.`,
      );
  }
  return {
    blocking: [...new Set(blocking)],
    unknown: [...new Set(unknown)],
    earliestStart,
  };
}
