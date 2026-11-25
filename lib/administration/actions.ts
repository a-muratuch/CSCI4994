"use server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { siteUrl, supabaseConfig } from "@/lib/supabase/config";
import { isUuid } from "@/lib/ids";
import { administrationReady, invitationsConfigured } from "./data";
import { workerInvitation } from "./validation";
import type { ActionResult } from "@/lib/action-result";
async function adminClient() {
  const client = await serverSupabase(true);
  const { account } = await readAccount(client);
  if (account?.role !== "admin" || !(await administrationReady()))
    throw new Error("Unavailable");
  return client;
}
function refreshed() {
  for (const role of ["admin", "customer", "worker"])
    revalidatePath("/" + role, "layout");
}
export async function setAccountActive(
  id: string,
  active: boolean,
): Promise<ActionResult<{ message: string }>> {
  if (!isUuid(id) || typeof active !== "boolean")
    return { ok: false, message: "Reopen the account." };
  try {
    const client = await adminClient();
    const { error } = await client.rpc("set_account_active", {
      p_id: id,
      p_active: active,
    });
    if (error)
      return {
        ok: false,
        message:
          error.code === "22023"
            ? "This change is not allowed. Reassign or close active jobs first. Administrator access requires owner review."
            : "Access could not be changed. Refresh and try again.",
      };
    refreshed();
    return {
      ok: true,
      message: active
        ? "Account reactivated."
        : "Account deactivated. Existing records remain.",
    };
  } catch {
    return { ok: false, message: "Administrator access is required." };
  }
}
export async function saveTruck(
  id: string | null,
  name: string,
  active: boolean,
): Promise<ActionResult<{ message: string }>> {
  if (
    (id !== null && !isUuid(id)) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100 ||
    typeof active !== "boolean"
  )
    return { ok: false, message: "Enter a truck name of 1–100 characters." };
  try {
    const client = await adminClient();
    const { error } = await client.rpc("save_truck", {
      p_id: id as unknown as string,
      p_name: name.trim(),
      p_active: active,
    });
    if (error)
      return {
        ok: false,
        message:
          error.code === "22023"
            ? "Check the name and reassign or close active jobs before deactivating."
            : "The truck could not be saved.",
      };
    refreshed();
    return { ok: true, message: "Truck saved." };
  } catch {
    return { ok: false, message: "Administrator access is required." };
  }
}
export async function inviteWorker(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  const value = workerInvitation(input);
  if (!value)
    return { ok: false, message: "Enter a name and valid email address." };
  try {
    const client = await adminClient();
    if (!invitationsConfigured())
      return {
        ok: false,
        message: "Worker invitations have not been configured.",
      };
    const config = supabaseConfig()!;
    const reserved = await client.rpc("prepare_worker_invitation", {
      p_email: value.email,
      p_name: value.name,
    });
    if (reserved.error)
      return {
        ok: false,
        message:
          reserved.error.hint === "rate_limit"
            ? "Too many invitations. Try again later."
            : "An account or pending invitation may already exist. Existing roles are never changed.",
      };
    // This privileged client is created only after current account and schema checks.
    // It is never exported or used for operational reads, and never reaches client props.
    const privileged = createClient(
      config.url,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { data, error } = await privileged.auth.admin.inviteUserByEmail(
      value.email,
      { redirectTo: siteUrl() + "/auth/invite" },
    );
    if (error)
      return {
        ok: false,
        message:
          "The invitation could not be confirmed. Wait five minutes before retrying. No existing role was changed.",
      };
    if (!data.user?.id)
      return { ok: false, message: "Invitation setup could not be confirmed." };
    const completed = await client.rpc("complete_worker_invitation", {
      p_invitation: reserved.data,
      p_user: data.user.id,
    });
    if (completed.error)
      return {
        ok: false,
        message:
          "An invitation email was sent, but worker access could not be confirmed. Contact the project owner before retrying.",
      };
    refreshed();
    return {
      ok: true,
      message:
        "Worker invitation sent. The recipient must open the email and set a password.",
    };
  } catch {
    return {
      ok: false,
      message:
        "The invitation could not be sent. Check administrator access and invitation configuration.",
    };
  }
}
