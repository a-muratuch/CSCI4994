"use server";
import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { isUuid } from "@/lib/ids";
import { revalidatePath } from "next/cache";
import { logFailure } from "@/lib/server-log";
import type { ActionResult } from "@/lib/action-result";
export async function workflowAction(
  kind: "cancel-job" | "cancel-request" | "revise-estimate",
  id: string,
  revision: number,
): Promise<ActionResult<{ id?: string; message: string }>> {
  if (
    !["cancel-job", "cancel-request", "revise-estimate"].includes(kind) ||
    !isUuid(id) ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return {
      ok: false,
      message: "Reopen the record before making this change.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== (kind === "cancel-request" ? "customer" : "admin"))
      return {
        ok: false,
        message: "This action is not available to your account.",
      };
    const result =
      kind === "cancel-request"
        ? await client.rpc("change_request", {
            p_id: id,
            p_revision: revision,
            p_input: {},
            p_cancel: true,
          })
        : kind === "cancel-job"
          ? await client.rpc("cancel_job", { p_id: id, p_revision: revision })
          : await client.rpc("revise_estimate", {
              p_id: id,
              p_revision: revision,
            });
    if (result.error) {
      logFailure("workflow:change", result.error);
      return {
        ok: false,
        message:
          result.error.code === "40001"
            ? "This record changed or is no longer eligible. Refresh before trying again."
            : "The change could not be confirmed. Refresh before retrying.",
      };
    }
    for (const role of ["customer", "worker", "admin"])
      revalidatePath("/" + role, "layout");
    return {
      ok: true,
      id: result.data.id,
      message:
        kind === "revise-estimate"
          ? "New estimate version created. Review and publish it separately."
          : "Cancellation saved.",
    };
  } catch (error) {
    logFailure("workflow:change", error);
    return {
      ok: false,
      message: "The change could not be confirmed. Refresh before retrying.",
    };
  }
}
export async function bookings(date: string) {
  const client = await serverSupabase();
  const { account } = await readAccount(client);
  if (account?.role !== "admin" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { data: [], error: true };
  const { data, error } = await client.rpc("resource_bookings", {
    p_date: date,
  });
  return { data: data ?? [], error: !!error };
}
