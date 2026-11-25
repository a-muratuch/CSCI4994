import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import type { EstimateDefaults } from "./validation";

const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "");

// Hidden until the owner applies the Phase 8B migration.
export const estimateDefaultsReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("estimate_default_capabilities");
  if (error && !missing(error.code))
    logFailure("estimates:defaults-capabilities", error);
  return !error && data === 10;
});

// Declining with a reason, hidden until the Phase 8C migration is applied.
export const estimateChangesReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("estimate_change_capabilities");
  if (error && !missing(error.code))
    logFailure("estimates:changes-capabilities", error);
  return !error && data === 11;
});

// Proposed appointments and booking on acceptance (Phase 8E).
export const bookingReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("booking_capabilities");
  if (error && !missing(error.code))
    logFailure("estimates:booking-capabilities", error);
  return !error && data === 13;
});

/** Standard estimate text for administrators; null when unavailable. */
export async function loadEstimateDefaults(): Promise<EstimateDefaults | null> {
  if (!(await estimateDefaultsReady())) return null;
  const client = await serverSupabase();
  const { data, error } = await client
    .from("pricing_settings")
    .select("default_inclusions, default_exclusions, default_terms")
    .maybeSingle();
  if (error || !data) {
    if (error) logFailure("estimates:defaults", error);
    return null;
  }
  return {
    inclusions: data.default_inclusions,
    exclusions: data.default_exclusions,
    terms: data.default_terms,
  };
}
