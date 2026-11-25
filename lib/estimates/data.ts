import { workflowReady } from "@/lib/workflow/data";
import { isUuid } from "@/lib/ids";
import { estimateRecord } from "./records";
import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { requestMove } from "@/lib/requests/data";
import { chicagoToday } from "@/lib/requests/validation";
import type { EstimateView, MoveView, History } from "@/lib/domain";
import { loadSchedules, type PersistedJob } from "@/lib/jobs/schedules";
import type { Role } from "@/lib/auth/roles";
import { unstable_rethrow } from "next/navigation";
export type EstimateWorkspace = {
  jobs: PersistedJob[];
  moves: MoveView[];
  estimates: EstimateView[];
  customers: { id: string; name: string }[];
  history: History[];
};

export async function estimateWorkspace(
  role: Extract<Role, "customer" | "admin">,
  scope?: { requestId?: string; estimateId?: string; jobId?: string },
): Promise<{ data: EstimateWorkspace; error: boolean; partial?: boolean }> {
  const account = await requireRole(role);
  const empty: EstimateWorkspace = {
    jobs: [],
    moves: [],
    estimates: [],
    customers: [],
    history: [],
  };
  if (scope && Object.values(scope).some((id) => !isUuid(id)))
    return { data: empty, error: false };
  let step = "client";
  try {
    const client = await serverSupabase();
    let requestId = scope?.requestId;
    if (scope?.estimateId || scope?.jobId) {
      step = "linked-request";
      const linked = scope.estimateId
        ? await client
            .from("estimates")
            .select("request_id")
            .eq("id", scope.estimateId)
            .maybeSingle()
        : await client
            .from("jobs")
            .select("request_id")
            .eq("id", scope.jobId!)
            .maybeSingle();
      if (linked.error) throw linked.error;
      if (!linked.data) return { data: empty, error: false };
      requestId = linked.data.request_id;
    }
    step = "requests";
    let requests = client
      .from("move_requests")
      .select(
        "*,estimates(*,estimate_items(*),estimate_events(*)),profiles(id,full_name)",
      )
      .order("created_at", { ascending: false })
      .order("id");
    if (role === "customer") requests = requests.eq("customer_id", account.id);
    if (requestId) requests = requests.eq("id", requestId);
    const { data: rows, error: requestError } = await requests;
    if (requestError) throw requestError;
    step = "request-records";
    const moves = (rows ?? []).map(requestMove);
    if (!moves.length) return { data: empty, error: false };
    if (await workflowReady()) {
      step = "request-events";
      let query = client
        .from("request_events")
        .select("*")
        .order("occurred_at")
        .order("id");
      if (requestId) query = query.eq("request_id", requestId);
      const result = await query;
      if (result.error) throw result.error;
      for (const event of result.data ?? [])
        moves
          .find((m) => m.id === event.request_id)
          ?.history.push({
            id: event.id,
            entity: "request",
            recordId: event.request_id,
            label:
              event.action === "cancelled"
                ? "Request cancelled"
                : "Request edited",
            date: chicagoToday(new Date(event.occurred_at)),
            detail: "",
          });
    }
    step = "estimate-records";
    const estimates = {
      data: (rows ?? []).flatMap((row) =>
        Array.isArray(row.estimates)
          ? row.estimates
          : row.estimates
            ? [row.estimates]
            : [],
      ),
    };
    const profiles = {
      data:
        role === "admin"
          ? (rows ?? []).flatMap((row) => (row.profiles ? [row.profiles] : []))
          : [{ id: account.id, full_name: account.name }],
    };
    const unsafe = new Set<string>();
    const mapped: EstimateView[] = estimates.data.flatMap((row) => {
      const parsed = estimateRecord(row);
      if (parsed) return [parsed];
      unsafe.add(row.request_id);
      logFailure("estimates:invalid-record", { code: "invalid_record" });
      return [];
    });
    // Quarantine the related route too, so an invalid estimate is never mistaken for a missing estimate.
    const safeMoves = moves.filter((move) => !unsafe.has(move.id));
    const events = {
      data: (estimates.data ?? [])
        .flatMap((estimate) => estimate.estimate_events)
        .sort(
          (a, b) =>
            a.occurred_at.localeCompare(b.occurred_at) ||
            a.id.localeCompare(b.id),
        ),
    };
    const history: History[] = (events.data ?? []).map((e) => ({
      id: e.id,
      entity: "estimate",
      recordId: e.estimate_id,
      label:
        e.new_status === "draft"
          ? "Revised estimate created"
          : e.new_status === "awaiting"
            ? "Estimate published"
            : e.new_status === "accepted"
              ? "Estimate accepted"
              : "Estimate declined",
      date: chicagoToday(new Date(e.occurred_at)),
      detail:
        e.new_status === "accepted"
          ? "Acceptance does not confirm an appointment."
          : "",
    }));
    moves.forEach((move) => {
      const related = mapped.find((e) => e.requestId === move.id);
      if (related)
        move.history.push(
          ...history.filter((h) =>
            mapped.some((e) => e.requestId === move.id && e.id === h.recordId),
          ),
        );
    });
    const customers = (profiles.data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name.trim() || "Customer",
    }));
    step = "schedules";
    const jobs = await loadSchedules(client, safeMoves, customers, requestId);
    return {
      data: {
        moves: safeMoves,
        estimates: mapped.sort(
          (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
        ),
        customers,
        history,
        jobs,
      },
      partial: unsafe.size > 0,
      error: false,
    };
  } catch (error) {
    // Let Next handle its own navigation/render control flow.
    unstable_rethrow(error);
    logFailure(`estimates:load:${step}`, error);
    return { data: empty, error: true };
  }
}
