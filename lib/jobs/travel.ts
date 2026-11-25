/**
 * Travel-time rule between same-day jobs. Pure; no I/O.
 *
 * A worker or truck finishing one job must have enough time to drive from that
 * job's destination to the next job's pickup, plus a turnaround buffer, before
 * the next job starts. Distances are computed on the server (ZIP data) and
 * passed in as minutes; null means the distance is unknown.
 */

/** "HH:MM" (or "HH:MM:SS") → minutes after midnight. */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes after midnight → "HH:MM" (clamped to the same day). */
export function fromMinutes(minutes: number) {
  const value = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** "2 h 50 min", "45 min", "1 h". */
export function durationText(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h && m ? `${h} h ${m} min` : h ? `${h} h` : `${m} min`;
}

export type TravelSettings = { travelMph: number; turnaroundMinutes: number };

/**
 * Driving time plus turnaround, rounded up to 5 minutes. Null when the
 * distance is unknown.
 */
export function travelMinutes(miles: number | null, settings: TravelSettings) {
  if (miles === null || !Number.isFinite(miles) || miles < 0) return null;
  const minutes =
    (miles / settings.travelMph) * 60 + settings.turnaroundMinutes;
  return Math.ceil(minutes / 5 - 1e-9) * 5;
}

/** Another job on the same day, with travel already worked out on the server. */
export type DayJob = {
  id: string;
  start: string;
  end: string;
  workerIds: string[];
  truckId: string;
  pickupPlace: string | null;
  destinationPlace: string | null;
  /** Minutes from this other job's destination to the job being scheduled's pickup. */
  travelToThis: number | null;
  /** Minutes from the job being scheduled's destination to this other job's pickup. */
  travelFromThis: number | null;
};

export type TravelIssue =
  | { kind: "overlap"; job: DayJob }
  | { kind: "before"; job: DayJob; needed: number; available: number }
  | { kind: "after"; job: DayJob; needed: number; available: number };

export type ResourceCheck = {
  ok: boolean;
  issues: TravelIssue[];
  /** Neighbouring jobs whose travel time is unknown (needs confirmation). */
  unknown: DayJob[];
  /** Earliest start that would allow arrival from the previous job, if travel is the problem. */
  earliestStart: string | null;
  /** Empty driving minutes from the previous job (for ranking); 0 when none. */
  deadheadMinutes: number;
};

/**
 * Checks one worker's or truck's day: no overlap, can reach this job from the
 * job right before it, and can reach the job right after it in time.
 */
export function checkResource(
  jobs: readonly DayJob[],
  start: string,
  end: string,
): ResourceCheck {
  const s = toMinutes(start),
    e = toMinutes(end);
  const issues: TravelIssue[] = [];
  const unknown: DayJob[] = [];
  let previous: DayJob | undefined, next: DayJob | undefined;
  for (const job of jobs) {
    const js = toMinutes(job.start),
      je = toMinutes(job.end);
    if (js < e && s < je) issues.push({ kind: "overlap", job });
    else if (je <= s) {
      if (!previous || je > toMinutes(previous.end)) previous = job;
    } else if (!next || js < toMinutes(next.start)) next = job;
  }
  let earliestStart: string | null = null;
  let deadheadMinutes = 0;
  if (previous) {
    const available = s - toMinutes(previous.end);
    const needed = previous.travelToThis;
    if (needed === null) unknown.push(previous);
    else {
      deadheadMinutes = needed;
      if (available < needed) {
        issues.push({ kind: "before", job: previous, needed, available });
        earliestStart = fromMinutes(toMinutes(previous.end) + needed);
      }
    }
  }
  if (next) {
    const available = toMinutes(next.start) - e;
    const needed = next.travelFromThis;
    if (needed === null) unknown.push(next);
    else if (available < needed)
      issues.push({ kind: "after", job: next, needed, available });
  }
  return {
    ok: issues.length === 0,
    issues,
    unknown,
    earliestStart,
    deadheadMinutes,
  };
}

/** Plain-language explanation of one issue for administrators. */
export function issueText(
  issue: TravelIssue,
  thisJob: { pickupPlace: string | null; destinationPlace: string | null },
) {
  const where = (place: string | null) => place ?? "an unknown address";
  if (issue.kind === "overlap")
    return `Booked ${issue.job.start}–${issue.job.end} on another job.`;
  if (issue.kind === "before")
    return `Can't reach in time: needs about ${durationText(issue.needed)} from ${where(issue.job.destinationPlace)} (job ends ${issue.job.end}) to ${where(thisJob.pickupPlace)}, only ${durationText(Math.max(0, issue.available))} between jobs.`;
  return `Can't reach the next job in time: needs about ${durationText(issue.needed)} from ${where(thisJob.destinationPlace)} to ${where(issue.job.pickupPlace)} (job starts ${issue.job.start}), only ${durationText(Math.max(0, issue.available))} between jobs.`;
}

/** Saved jobs for a whole day, used to flag already-booked tight pairs. */
export type SavedDayJob = {
  id: string;
  start: string;
  end: string;
  workerIds: string[];
  truckId: string;
  pickupZip: string | null;
  destinationZip: string | null;
  pickupPlace: string | null;
  destinationPlace: string | null;
};

/**
 * Finds consecutive jobs (per worker and per truck) that break the travel rule.
 * Returns a message per later job ID. `minutesBetween` returns null when unknown.
 */
export function tightTravel(
  jobs: readonly SavedDayJob[],
  minutesBetween: (
    fromZip: string | null,
    toZip: string | null,
  ) => number | null,
) {
  const flags = new Map<string, string>();
  const resources = new Set<string>();
  for (const job of jobs) {
    resources.add("t:" + job.truckId);
    for (const w of job.workerIds) resources.add("w:" + w);
  }
  for (const resource of resources) {
    const own = jobs
      .filter((job) =>
        resource.startsWith("t:")
          ? job.truckId === resource.slice(2)
          : job.workerIds.includes(resource.slice(2)),
      )
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < own.length; i++) {
      const before = own[i - 1],
        after = own[i];
      const needed = minutesBetween(before.destinationZip, after.pickupZip);
      const available = toMinutes(after.start) - toMinutes(before.end);
      if (
        needed !== null &&
        available >= 0 &&
        available < needed &&
        !flags.has(after.id)
      )
        flags.set(
          after.id,
          `Tight travel: needs about ${durationText(needed)} from ${before.destinationPlace ?? "the previous job"} (ends ${before.end}), only ${durationText(available)} before this job.`,
        );
    }
  }
  return flags;
}

/** ZIP and a "City ZIP" label from a saved structured address (JSON), if any. */
export function addressPoint(address: unknown) {
  if (!address || typeof address !== "object")
    return { zip: null, place: null };
  const zip = Reflect.get(address, "zip"),
    city = Reflect.get(address, "city");
  const z = typeof zip === "string" && zip.trim() ? zip.trim() : null;
  const c = typeof city === "string" && city.trim() ? city.trim() : null;
  return { zip: z, place: [c, z].filter(Boolean).join(" ") || null };
}
