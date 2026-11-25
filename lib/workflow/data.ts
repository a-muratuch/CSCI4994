import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
// Hide migration-dependent controls until the owner applies the hosted proposal.
export const workflowReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("workflow_capabilities");
  if (error && !["PGRST202", "42883"].includes(error.code))
    logFailure("workflow:capabilities", error);
  return !error && data === 4;
});
export async function assignedPhone(jobId: string) {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("assigned_customer_phone", {
    p_job_id: jobId,
  });
  if (error && !["PGRST202", "42883"].includes(error.code))
    logFailure("worker:phone", error);
  return error ? undefined : data || undefined;
}
export const unreadCount = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("unread_messages");
  if (error && !["PGRST202", "42883"].includes(error.code))
    logFailure("messages:unread", error);
  return error ? 0 : (data ?? 0);
});

export function recordAge(value: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`;
}
