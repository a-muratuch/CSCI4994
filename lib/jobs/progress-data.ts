import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";

const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "");

// "On the way", the delivery-photo rule and its waiver (Phase 8G).
export const crewProgressReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("crew_progress_capabilities");
  if (error && !missing(error.code))
    logFailure("jobs:progress-capabilities", error);
  return !error && data === 14;
});

// Multi-day (long-distance) jobs (Phase 9).
export const longDistanceReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("long_distance_capabilities");
  if (error && !missing(error.code))
    logFailure("jobs:long-distance-capabilities", error);
  return !error && data === 15;
});
