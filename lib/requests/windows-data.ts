import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { chicagoToday } from "./validation";

const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "");

// Arrival windows stay hidden until the owner applies the Phase 8D migration.
export const arrivalWindowsReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("arrival_window_capabilities");
  if (error && !missing(error.code))
    logFailure("requests:window-capabilities", error);
  return !error && data === 12;
});

export type DayHint = { day: string; status: "open" | "limited" | "full" };

/**
 * Busy-day hints for the next 62 days (Phase 8E): only open, limited or full
 * per day. Null when unavailable; the form then works without hints.
 */
export async function loadDayHints(): Promise<DayHint[] | null> {
  const client = await serverSupabase();
  const { data: ready, error: readyError } = await client.rpc(
    "booking_capabilities",
  );
  if (readyError || ready !== 13) return null;
  const { data, error } = await client.rpc("day_availability", {
    p_from: chicagoToday(),
    p_days: 62,
  });
  if (error || !data) {
    if (error) logFailure("requests:day-hints", error);
    return null;
  }
  return data.filter((row): row is DayHint =>
    ["open", "limited", "full"].includes(row.status),
  );
}
