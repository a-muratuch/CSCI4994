import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import { estimateMiles } from "@/lib/distance/zip";
import { crewSize } from "@/lib/estimates/suggestion";
import { travelMinutes, type TravelSettings } from "./travel";
import type { ScheduleOptions } from "./suggest";
import { jobMinutes } from "./arrival";

type Client = Awaited<ReturnType<typeof serverSupabase>>;
const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42703"].includes(code ?? "");

/** Hide scheduling suggestions until the owner applies the Phase 7B migration. */
export const schedulingReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("scheduling_capabilities");
  if (error && !missing(error.code))
    logFailure("scheduling:capabilities", error);
  return !error && data === 8;
});

/** Travel settings plus a minutes-between-ZIPs helper using the server-only ZIP data. */
export async function travelHelper(client: Client) {
  const { data, error } = await client
    .from("pricing_settings")
    .select(
      "travel_mph,road_factor,turnaround_minutes,cubic_feet_per_worker_hour,minimum_hours",
    )
    .maybeSingle();
  if (error || !data) {
    if (error) logFailure("scheduling:settings", error);
    return null;
  }
  const settings: TravelSettings = {
    travelMph: data.travel_mph,
    turnaroundMinutes: data.turnaround_minutes,
  };
  const roadFactor = Number(data.road_factor);
  return {
    settings,
    minutesBetween: (fromZip: string | null, toZip: string | null) =>
      travelMinutes(estimateMiles(fromZip, toZip, roadFactor), settings),
    /** Driving only (no turnaround buffer), for the job's own length. */
    driveMinutes: (fromZip: string | null, toZip: string | null) => {
      const miles = estimateMiles(fromZip, toZip, roadFactor);
      return miles === null ? null : (miles / settings.travelMph) * 60;
    },
    cubicFeetPerWorkerHour: data.cubic_feet_per_worker_hour,
    minimumHours: Number(data.minimum_hours),
  };
}

type RawJob = {
  id: string;
  start: string;
  end: string;
  truckId: string;
  workerIds: string[];
  pickupZip: string | null;
  pickupPlace: string | null;
  destinationZip: string | null;
  destinationPlace: string | null;
};
type Raw = {
  pickupZip: string | null;
  pickupPlace: string | null;
  destinationZip: string | null;
  destinationPlace: string | null;
  volume: number;
  jobs: RawJob[];
  /** Present after the Phase 9 migration. */
  away?: ScheduleOptions["away"];
  workers: ScheduleOptions["workers"];
  trucks: ScheduleOptions["trucks"];
};

/**
 * Loads one day's scheduling context for an estimate (administrators only,
 * enforced again by the database) and adds travel minutes between this job and
 * every other job that day.
 */
export async function loadScheduleOptions(
  client: Client,
  estimateId: string,
  date: string,
  jobId: string | null,
  /** Phase 9: last day of a multi-day span (the return day). */
  until: string | null = null,
): Promise<
  | { state: "ready"; options: ScheduleOptions }
  | { state: "unavailable" }
  | { state: "error" }
> {
  if (
    !isUuid(estimateId) ||
    (jobId !== null && !isUuid(jobId)) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return { state: "error" };
  if (!(await schedulingReady())) return { state: "unavailable" };
  const [{ data, error }, travel] = await Promise.all([
    client.rpc("schedule_candidates", {
      p_estimate_id: estimateId,
      p_date: date,
      // Null includes every job; generated types omit nullable arguments.
      p_job_id: jobId as string,
      // Only sent for multi-day spans, so the call also works before Phase 9.
      ...(until && until > date ? { p_until: until } : {}),
    }),
    travelHelper(client),
  ]);
  if (error || !data || !travel) {
    if (error) logFailure("scheduling:candidates", error);
    return { state: "error" };
  }
  const raw = data as unknown as Raw;
  const volume = Number(raw.volume) || 0;
  const crewTarget = volume > 0 ? crewSize(volume) : 2;
  return {
    state: "ready",
    options: {
      pickupPlace: raw.pickupPlace,
      destinationPlace: raw.destinationPlace,
      volume: Math.round(volume * 10) / 10,
      crewTarget,
      // Undefined before the Phase 9 migration: multi-day moves stay hidden.
      away: raw.away,
      trip:
        travel.cubicFeetPerWorkerHour > 0
          ? {
              workMinutes:
                volume > 0
                  ? (volume / (travel.cubicFeetPerWorkerHour * crewTarget)) * 60
                  : 0,
              driveMinutes: travel.driveMinutes(
                raw.pickupZip,
                raw.destinationZip,
              ),
              minimumMinutes: volume > 0 ? travel.minimumHours * 60 : 240,
            }
          : undefined,
      jobMinutes: jobMinutes({
        volume,
        crew: crewTarget,
        cubicFeetPerWorkerHour: travel.cubicFeetPerWorkerHour,
        minimumHours: travel.minimumHours,
        driveMinutes: travel.driveMinutes(raw.pickupZip, raw.destinationZip),
      }),
      workers: raw.workers,
      trucks: raw.trucks,
      jobs: raw.jobs.map((job) => ({
        id: job.id,
        start: job.start,
        end: job.end,
        truckId: job.truckId,
        workerIds: job.workerIds,
        pickupPlace: job.pickupPlace,
        destinationPlace: job.destinationPlace,
        travelToThis: travel.minutesBetween(job.destinationZip, raw.pickupZip),
        travelFromThis: travel.minutesBetween(
          raw.destinationZip,
          job.pickupZip,
        ),
      })),
    },
  };
}
