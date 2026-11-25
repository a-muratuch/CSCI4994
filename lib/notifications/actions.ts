"use server";
import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { isUuid } from "@/lib/ids";
import { notificationPath } from "./model";
export async function markNotifications(id: unknown, through: unknown = null) {
  if ((!isUuid(id) && !isUuid(through)) || (id !== null && through !== null))
    return false;
  const client = await serverSupabase(true);
  const { account } = await readAccount(client);
  if (!account) return false;
  const { error } = await client.rpc(
    "mark_notifications",
    isUuid(id) ? { p_id: id } : { p_through: through as string },
  );
  return !error;
}
// Mounted only after an existing destination has loaded successfully.
export async function readDestination(id: unknown, path: unknown) {
  if (!isUuid(id) || typeof path !== "string") return false;
  const client = await serverSupabase(true);
  const { account } = await readAccount(client);
  if (!account) return false;
  const { data: n, error } = await client
    .from("notifications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !n) return false;
  let targetKind: "estimate" | "job" | "move" | "conversation";
  let targetId: string | null;
  if (n.kind === "message") {
    targetKind = "conversation";
    targetId = n.conversation_id;
  } else if (
    n.kind === "estimate-published" ||
    n.kind === "estimate-declined"
  ) {
    targetKind = "estimate";
    targetId = n.estimate_id;
  } else if (account.role === "customer") {
    const { data: job } = await client
      .from("jobs")
      .select("request_id")
      .eq("id", n.job_id!)
      .maybeSingle();
    targetKind = "move";
    targetId = job?.request_id ?? null;
  } else {
    targetKind = "job";
    targetId = n.job_id;
  }
  if (
    !targetId ||
    notificationPath(
      { target_kind: targetKind, target_id: targetId },
      account.role,
    ) !== path
  )
    return false;
  const { error: failed } = await client.rpc("mark_notifications", {
    p_id: id,
  });
  return !failed;
}
