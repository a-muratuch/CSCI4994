"use server";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid, validateEstimate, validateEstimateDefaults } from "./validation";
import {
  bookingReady,
  estimateChangesReady,
  estimateDefaultsReady,
} from "./defaults";
import { validateDecline } from "./decline";

function refreshRecords() {
  for (const path of [
    "/admin/requests",
    "/admin/estimates",
    "/customer/estimates",
    "/customer/moves",
    "/customer",
  ])
    revalidatePath(path, "layout");
}
/**
 * Save a draft. With `publish`, the saved revision is published straight
 * away (the same database check as the review page). If publishing fails the
 * draft stays saved, so the administrator can review and publish it later.
 */
export async function saveEstimate(
  requestId: unknown,
  id: unknown,
  revision: unknown,
  value: unknown,
  publish = false,
): Promise<ActionResult<{ id?: string; message: string }>> {
  const { input, error } = validateEstimate(value);
  if (
    error ||
    !input ||
    !uuid(requestId) ||
    (id !== null && !uuid(id)) ||
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    return {
      ok: false,
      message: error ?? "Invalid draft. Reopen the request.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin")
      return {
        ok: false,
        message: "Only an administrator can save estimates.",
      };
    // Generated RPC types omit nullable arguments; SQL accepts null for a new draft.
    const { data, error } = await client.rpc("save_estimate_draft", {
      p_request_id: requestId,
      p_estimate_id: id as string,
      p_revision: revision,
      p_input: input,
    });
    if (error || !data)
      return {
        ok: false,
        message:
          error?.code === "40001"
            ? "This draft changed or was published. Reopen it before editing."
            : "The save could not be confirmed. Check Estimates before trying again.",
      };
    if (publish === true) {
      const published = await client.rpc("publish_reviewed_estimate", {
        p_estimate_id: data.id,
        p_revision: data.revision,
      });
      refreshRecords();
      if (published.error) {
        logFailure("estimates:save-publish", published.error);
        return {
          ok: true,
          id: data.id,
          message:
            "The draft was saved but not published. Review it and publish again.",
        };
      }
      return {
        ok: true,
        id: data.id,
        message: "Estimate published to the customer account.",
      };
    }
    refreshRecords();
    return { ok: true, id: data.id, message: "Draft saved." };
  } catch (error) {
    logFailure("estimates:action", error);
    return {
      ok: false,
      message:
        "The save could not be confirmed. Check Estimates before trying again.",
    };
  }
}
export async function publishEstimate(
  id: unknown,
  revision: unknown,
): Promise<ActionResult<{ message: string }>> {
  if (
    !uuid(id) ||
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return { ok: false, message: "Reopen the draft before publishing." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin")
      return {
        ok: false,
        message: "Only an administrator can publish estimates.",
      };
    const { error } = await client.rpc("publish_reviewed_estimate", {
      p_estimate_id: id,
      p_revision: revision,
    });
    if (error)
      return {
        ok: false,
        message:
          "This draft changed, was published, or is unavailable. Refresh and review it again.",
      };
    refreshRecords();
    return { ok: true, message: "Estimate published to the customer account." };
  } catch (error) {
    logFailure("estimates:action", error);
    return {
      ok: false,
      message:
        "Publication could not be confirmed. Refresh before trying again.",
    };
  }
}
/**
 * Accept or decline. A decline may carry a reason and note (Phase 8C); they
 * are saved together with the decision when that feature is available.
 */
export async function decideEstimate(
  id: unknown,
  decision: unknown,
  change?: { reason: unknown; note: unknown },
): Promise<ActionResult<{ message: string }>> {
  if (!uuid(id) || (decision !== "accepted" && decision !== "declined"))
    return { ok: false, message: "Invalid estimate decision." };
  const decline =
    decision === "declined" && change
      ? validateDecline(change.reason, change.note)
      : null;
  if (decline && "error" in decline)
    return { ok: false, message: decline.error };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "customer")
      return {
        ok: false,
        message: "Sign in as the owning customer to decide.",
      };
    // Acceptance books a proposed appointment when it is still free (8E).
    if (decision === "accepted" && (await bookingReady())) {
      const accepted = await client.rpc("accept_estimate", {
        p_estimate_id: id,
      });
      if (accepted.error)
        return {
          ok: false,
          message:
            "This estimate was already decided or is unavailable. Refresh to see its current status.",
        };
      refreshRecords();
      revalidatePath("/worker", "layout");
      revalidatePath("/admin", "layout");
      return {
        ok: true,
        message:
          accepted.data === "booked"
            ? "Estimate accepted and your move is booked for the proposed time."
            : "Estimate accepted and saved. Your moving date is not confirmed yet.",
      };
    }
    const { error } =
      decline && (await estimateChangesReady())
        ? await client.rpc("decline_estimate", {
            p_estimate_id: id,
            p_reason: decline.reason,
            p_note: decline.note as string,
          })
        : await client.rpc("decide_estimate", {
            p_estimate_id: id,
            p_decision: decision,
          });
    if (error)
      return {
        ok: false,
        message:
          "This estimate was already decided or is unavailable. Refresh to see its current status.",
      };
    refreshRecords();
    return {
      ok: true,
      message:
        decision === "accepted"
          ? "Estimate accepted and saved. Your moving date is not confirmed."
          : decline && decline.reason !== "not-moving"
            ? "Your change request was sent. We will prepare a revised estimate."
            : "Estimate declined and saved for administrator review.",
    };
  } catch (error) {
    logFailure("estimates:action", error);
    return {
      ok: false,
      message:
        "The decision could not be confirmed. Refresh before trying again.",
    };
  }
}

/** Replace the standard inclusions, exclusions and terms for new drafts. */
export async function saveEstimateDefaults(
  value: unknown,
): Promise<ActionResult<{ message: string; errors?: Record<string, string> }>> {
  const checked = validateEstimateDefaults(value);
  if ("errors" in checked)
    return {
      ok: false,
      errors: checked.errors,
      message: "Correct the highlighted fields.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin" || !(await estimateDefaultsReady()))
      return { ok: false, message: "Administrator access is required." };
    const { error } = await client.rpc("save_estimate_defaults", {
      p_inclusions: checked.input.inclusions,
      p_exclusions: checked.input.exclusions,
      p_terms: checked.input.terms,
    });
    if (error) {
      logFailure("estimates:defaults-save", error);
      return { ok: false, message: "The standard text could not be saved." };
    }
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: "Standard text saved. New estimate drafts start with it.",
    };
  } catch (error) {
    logFailure("estimates:defaults-save", error);
    return { ok: false, message: "The standard text could not be saved." };
  }
}
