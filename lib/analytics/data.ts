import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { analyticsResult } from "./model";
export async function analyticsData(weeks: number) {
  await requireRole("admin");
  const client = await serverSupabase();
  const { data, error } = await client.rpc("admin_analytics", {
    p_weeks: weeks,
  });
  if (error) {
    if (["PGRST202", "42883"].includes(error.code))
      return { state: "setup" as const };
    logFailure("analytics:load", error);
    return { state: "error" as const };
  }
  const summary = analyticsResult(data);
  return summary
    ? { state: "ready" as const, summary }
    : { state: "error" as const };
}
