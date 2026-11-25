"use server";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";
import { validateSchedule } from "./validation";
import { scheduleError } from "./errors";
import { loadScheduleOptions } from "./schedule-options";
import { checkSelection } from "./suggest";

type Client = Awaited<ReturnType<typeof serverSupabase>>;
type ScheduleValues = NonNullable<ReturnType<typeof validateSchedule>["input"]>;

/**
 * Travel-time rule: re-check the chosen crew and truck on the server, so
 * hand-picked assignments are covered too. The database still guards overlaps.
 * Returns null when the selection may be saved.
 */
async function travelProblem(
  client: Client,
  estimateId: string,
  input: ScheduleValues,
  jobId: string | null,
  confirmedUnknown: boolean,
): Promise<{ message: string; needsTravelConfirmation?: boolean } | null> {
  const day = await loadScheduleOptions(
    client,
    estimateId,
    input.date,
    jobId,
    input.returnDate ?? null,
  );
  if (day.state === "error")
    return {
      message:
        "Travel times could not be checked. Refresh and try again before saving.",
    };
  if (day.state !== "ready") return null;
  const travel = checkSelection(
    day.options,
    input.start,
    input.end,
    input.workerIds,
    input.truckId,
    Boolean(input.returnDate),
  );
  if (travel.blocking.length)
    return {
      message:
        travel.blocking.join(" ") +
        (travel.earliestStart
          ? ` Earliest feasible start for this team: ${travel.earliestStart}.`
          : "") +
        " Choose another team or time.",
    };
  if (travel.unknown.length && !confirmedUnknown)
    return {
      needsTravelConfirmation: true,
      message:
        travel.unknown.join(" ") +
        " Confirm the team can travel between these jobs before saving.",
    };
  return null;
}

/** Day context for the scheduling suggestion panel (administrators only). */
export async function scheduleOptions(
  estimateId: unknown,
  date: unknown,
  jobId: unknown,
  /** Phase 9: return day of a multi-day span. */
  until: unknown = null,
) {
  try {
    const client = await serverSupabase();
    const { account } = await readAccount(client);
    if (
      account?.role !== "admin" ||
      typeof estimateId !== "string" ||
      typeof date !== "string" ||
      (jobId !== null && typeof jobId !== "string")
    )
      return { state: "error" as const };
    return await loadScheduleOptions(
      client,
      estimateId,
      date,
      jobId,
      typeof until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(until)
        ? until
        : null,
    );
  } catch (error) {
    logFailure("scheduling:options", error);
    return { state: "error" as const };
  }
}

export async function saveSchedule(
  estimateId: unknown,
  jobId: unknown,
  revision: unknown,
  value: unknown,
): Promise<
  ActionResult<{
    id?: string;
    message: string;
    needsTravelConfirmation?: boolean;
  }>
> {
  const checked = validateSchedule(value);
  if (
    !checked.input ||
    !uuid(estimateId) ||
    (jobId !== null && !uuid(jobId)) ||
    (jobId === null
      ? revision !== null
      : typeof revision !== "number" ||
        !Number.isSafeInteger(revision) ||
        revision < 1)
  )
    return {
      ok: false,
      message:
        checked.error ??
        "Invalid schedule context. Reopen the estimate or job.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin")
      return {
        ok: false,
        message: "Only an administrator can schedule and assign moves.",
      };
    const input = checked.input;
    const travel = await travelProblem(
      client,
      estimateId as string,
      input,
      jobId as string | null,
      Reflect.get(value as object, "confirmUnknownTravel") === true,
    );
    if (travel) return { ok: false, ...travel };
    const { data, error } = await client.rpc("save_job", {
      p_estimate_id: estimateId,
      p_date: input.date,
      p_start: input.start,
      p_end: input.end,
      p_arrival_start: input.arrivalStart,
      p_arrival_end: input.arrivalEnd,
      p_worker_ids: input.workerIds,
      p_truck_id: input.truckId,
      ...(jobId
        ? { p_job_id: jobId as string, p_expected_revision: revision as number }
        : {}),
      // Long-distance only, so same-day saves also work before Phase 9.
      ...(input.returnDate
        ? { p_end_date: input.endDate, p_return_date: input.returnDate }
        : {}),
    });
    if (error || !data) {
      logFailure("jobs:save", error);
      return { ok: false, message: scheduleError(error?.code) };
    }

    for (const path of ["/admin", "/customer", "/worker"])
      revalidatePath(path, "layout");
    return {
      ok: true,
      id: data.id,
      message: "Schedule and assignments saved.",
    };
  } catch (error) {
    logFailure("jobs:action", error);
    return {
      ok: false,
      message:
        "The save could not be confirmed. Check Jobs & schedule before retrying.",
    };
  }
}

/**
 * Propose an appointment on a draft estimate (Phase 8E), with the same checks
 * as scheduling. A null value removes the proposal. The customer's acceptance
 * books it only if nothing changed for that crew and truck since.
 */
export async function saveProposal(
  estimateId: unknown,
  value: unknown,
): Promise<
  ActionResult<{ message: string; needsTravelConfirmation?: boolean }>
> {
  const checked = value === null ? null : validateSchedule(value);
  if (!uuid(estimateId) || (checked && !checked.input))
    return {
      ok: false,
      message: checked?.error ?? "Invalid proposal. Reopen the estimate.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin")
      return { ok: false, message: "Only an administrator can propose times." };
    const input = checked?.input;
    if (input) {
      const travel = await travelProblem(
        client,
        estimateId as string,
        input,
        null,
        Reflect.get(value as object, "confirmUnknownTravel") === true,
      );
      if (travel) return { ok: false, ...travel };
    }
    // Generated RPC types omit nullable arguments; null clears the proposal.
    const { error } = await client.rpc("set_estimate_proposal", {
      p_estimate_id: estimateId as string,
      p_date: (input?.date ?? null) as string,
      p_start: (input?.start ?? null) as string,
      p_end: (input?.end ?? null) as string,
      p_arrival_start: (input?.arrivalStart ?? null) as string,
      p_arrival_end: (input?.arrivalEnd ?? null) as string,
      p_worker_ids: (input?.workerIds ?? null) as string[],
      p_truck_id: (input?.truckId ?? null) as string,
      ...(input?.returnDate
        ? { p_end_date: input.endDate, p_return_date: input.returnDate }
        : {}),
    });
    if (error) {
      logFailure("jobs:proposal", error);
      return {
        ok: false,
        message:
          error.code === "22023"
            ? "That crew or truck is unavailable or booked then, or the estimate is no longer a draft."
            : "The proposal could not be saved. Refresh and try again.",
      };
    }
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: input
        ? "Proposed appointment saved. Accepting the estimate books it if it is still free."
        : "Proposed appointment removed.",
    };
  } catch (error) {
    logFailure("jobs:proposal", error);
    return {
      ok: false,
      message: "The proposal could not be saved. Refresh and try again.",
    };
  }
}

/**
 * Let the crew complete a job without a delivery photo (Phase 8G), for
 * example when a phone is broken. Recorded in the job history.
 */
export async function waiveDeliveryPhoto(
  jobId: unknown,
  note: unknown,
): Promise<ActionResult<{ message: string }>> {
  const text = typeof note === "string" ? note.trim() : "";
  if (!uuid(jobId) || text.length > 200)
    return { ok: false, message: "Keep the note under 200 characters." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "admin")
      return { ok: false, message: "Administrator access is required." };
    const { error } = await client.rpc("waive_delivery_photo", {
      p_job_id: jobId as string,
      p_note: (text || null) as string,
    });
    if (error) {
      logFailure("jobs:waive-photo", error);
      return {
        ok: false,
        message:
          error.code === "22023"
            ? "This job is closed or already has a waiver. Reload the job."
            : "The waiver could not be saved. Reload and try again.",
      };
    }
    for (const path of ["/admin", "/worker"]) revalidatePath(path, "layout");
    return {
      ok: true,
      message: "Delivery photo waived. The crew can complete the job.",
    };
  } catch (error) {
    logFailure("jobs:waive-photo", error);
    return {
      ok: false,
      message: "The waiver could not be saved. Reload and try again.",
    };
  }
}
