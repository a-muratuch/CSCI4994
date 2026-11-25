"use server";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { validateAvailability, validProgress } from "./validation";

function refreshWorkspaces() {
  for (const path of ["/worker", "/admin", "/customer"])
    revalidatePath(path, "layout");
}

export async function saveAvailability(
  value: unknown,
): Promise<ActionResult<{ message: string }>> {
  const rows = validateAvailability(value);
  if (!rows)
    return {
      ok: false,
      message: "Choose seven distinct weekdays and valid same-day times.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "worker")
      return {
        ok: false,
        message: "Sign in to your worker account before saving.",
      };
    const { error } = await client.rpc("save_worker_availability", {
      p_days: rows,
    });
    if (error) throw new Error("Availability save failed");
    refreshWorkspaces();
    return {
      ok: true,
      message:
        "Availability saved to your account. Existing appointments have not changed.",
    };
  } catch (error) {
    logFailure("workers:action", error);
    return {
      ok: false,
      message:
        "The save could not be confirmed. Reload availability before retrying.",
    };
  }
}

export async function advanceJob(
  id: string,
  status: string,
  revision: number,
): Promise<ActionResult<{ message: string }>> {
  if (!validProgress(id, status, revision))
    return { ok: false, message: "Invalid progress update. Reload this job." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "worker")
      return {
        ok: false,
        message: "Only assigned workers can update progress.",
      };
    const { data, error } = await client.rpc("advance_job", {
      p_job_id: id,
      p_expected_status: status,
      p_expected_revision: revision,
    });
    if (error || !data) {
      logFailure("workers:save", error);
      return {
        ok: false,
        message:
          error?.hint === "delivery_photo"
            ? "Add at least one delivery photo before completing, or ask an administrator to waive it."
            : error?.code === "40001"
              ? "This job changed. Reload before updating progress."
              : error?.code === "42501"
                ? "This job is unavailable or not assigned to you."
                : "The update could not be confirmed. Reload the job before retrying.",
      };
    }
    refreshWorkspaces();
    return {
      ok: true,
      message:
        data.status === "completed"
          ? "Progress saved: Completed."
          : "Progress saved: Arrived. The job is in progress.",
    };
  } catch (error) {
    logFailure("workers:action", error);
    return {
      ok: false,
      message:
        "The update could not be confirmed. Reload the job before retrying.",
    };
  }
}

/** Tell the customer the crew is on the way (moving day only; Phase 8G). */
export async function markOnTheWay(
  id: string,
  revision: number,
): Promise<ActionResult<{ message: string }>> {
  if (!validProgress(id, "scheduled", revision))
    return { ok: false, message: "Invalid progress update. Reload this job." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "worker")
      return {
        ok: false,
        message: "Only assigned workers can update progress.",
      };
    const { error } = await client.rpc("mark_on_the_way", {
      p_job_id: id,
      p_expected_revision: revision,
    });
    if (error) {
      logFailure("workers:on-the-way", error);
      return {
        ok: false,
        message:
          error.code === "40001"
            ? "This job changed. Reload before updating progress."
            : error.code === "22023"
              ? "You can mark on the way only on the moving day, before arriving."
              : "The update could not be confirmed. Reload the job before retrying.",
      };
    }
    refreshWorkspaces();
    return {
      ok: true,
      message: "Progress saved: On the way. The customer has been notified.",
    };
  } catch (error) {
    logFailure("workers:action", error);
    return {
      ok: false,
      message:
        "The update could not be confirmed. Reload the job before retrying.",
    };
  }
}
