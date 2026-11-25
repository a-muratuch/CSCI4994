import "server-only";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { notificationSnapshot } from "./model";
export async function loadNotifications(
  client: Awaited<ReturnType<typeof serverSupabase>>,
  unread = false,
  page = 1,
) {
  const { data, error } = await client.rpc("notification_snapshot", {
    p_unread: unread,
    p_page: page,
  });
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      return { state: "setup" as const };
    logFailure("notifications:load", error);
    return { state: "error" as const };
  }
  const snapshot = notificationSnapshot(data);
  return snapshot
    ? { state: "ready" as const, snapshot }
    : { state: "error" as const };
}
