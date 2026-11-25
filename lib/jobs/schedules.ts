import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import "server-only";
import type { serverSupabase } from "@/lib/supabase/server";
import type { MoveView, WorkerJobView, History, JobStatus } from "@/lib/domain";
import { chicagoToday } from "@/lib/requests/validation";

export type PersistedJob = WorkerJobView & { truckId: string };

export async function loadSchedules(
  client: Awaited<ReturnType<typeof serverSupabase>>,
  moves: MoveView[],
  customers: { id: string; name: string }[],
  requestId?: string,
): Promise<PersistedJob[]> {
  if (!moves.length) return [];
  let query = client
    .from("jobs")
    .select("*,trucks(id,name),job_events(*)")
    .order("scheduled_date")
    .order("start_time")
    .order("id");
  if (requestId) query = query.eq("request_id", requestId);
  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows?.length) return [];
  const members: { job_id: string; worker_id: string; full_name: string }[] =
    [];
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const result = await client.rpc("get_job_teams", {
      p_job_ids: batch.map((row) => row.id),
    });
    // Compatibility only while hosted application of the new function awaits approval.
    if (result.error?.code === "PGRST202" || result.error?.code === "42883") {
      const legacy = await Promise.all(
        batch.map(async (row) => {
          const team = await client.rpc("get_job_team", { p_job_id: row.id });
          if (team.error) throw team.error;
          return (team.data ?? []).map((member) => ({
            ...member,
            job_id: row.id,
          }));
        }),
      );
      members.push(...legacy.flat());
    } else {
      if (result.error) throw result.error;
      members.push(...(result.data ?? []));
    }
  }
  const teams = new Map<string, typeof members>();
  for (const member of members) {
    const team = teams.get(member.job_id) ?? [];
    team.push(member);
    teams.set(member.job_id, team);
  }
  const movesById = new Map(moves.map((move) => [move.id, move]));
  const jobs = await Promise.all(
    rows
      .filter((row) => movesById.has(row.request_id))
      .map(async (row) => {
        const move = movesById.get(row.request_id);
        if (
          !move ||
          !["scheduled", "in-progress", "completed", "cancelled"].includes(
            row.status,
          ) ||
          !isUuid(row.id) ||
          ![
            row.start_time,
            row.end_time,
            row.arrival_start,
            row.arrival_end,
          ].every(
            (value) => typeof value === "string" && /^\d{2}:\d{2}/.test(value),
          )
        ) {
          logFailure("jobs:invalid-record", { code: "invalid_record" });
          return null;
        }
        const team = { data: teams.get(row.id) ?? [] };
        const status = row.status as JobStatus;
        const start = row.start_time.slice(0, 5),
          end = row.end_time.slice(0, 5),
          arrivalStart = row.arrival_start.slice(0, 5),
          arrivalEnd = row.arrival_end.slice(0, 5);
        const history: History[] = row.job_events
          .sort(
            (a, b) =>
              a.occurred_at.localeCompare(b.occurred_at) ||
              a.id.localeCompare(b.id),
          )
          .map((e) => ({
            id: e.id,
            entity: "job",
            recordId: row.id,
            label:
              e.action === "scheduled"
                ? "Move scheduled"
                : e.action === "rescheduled"
                  ? "Schedule and assignments updated"
                  : e.action === "on-the-way"
                    ? "Crew on the way"
                    : e.action === "photo-waived"
                      ? "Delivery photo waived by an administrator"
                      : e.action === "in-progress"
                        ? "Crew arrived · move in progress"
                        : e.action === "completed"
                          ? "Move completed"
                          : e.action === "cancelled"
                            ? "Move cancelled"
                            : e.action,
            date: chicagoToday(new Date(e.occurred_at)),
            detail:
              e.action === "scheduled" || e.action === "rescheduled"
                ? "Administrator saved schedule and assignments."
                : "",
          }));
        move.stage = status;
        move.jobId = row.id;
        move.crewOnTheWay = Boolean(
          "on_the_way_at" in row && row.on_the_way_at,
        );
        move.appointment = {
          date: row.scheduled_date,
          arrival: `${arrivalStart}–${arrivalEnd} CT`,
          start,
          end,
          ...("return_date" in row && row.return_date && row.end_date
            ? { deliveryDate: row.end_date }
            : {}),
        };
        move.team = (team.data ?? []).map(
          (p) => p.full_name.trim() || "Assigned worker",
        );
        move.history.push(...history);
        return {
          ...move,
          id: row.id,
          requestId: row.request_id,
          estimateId: row.estimate_id,
          date: row.scheduled_date,
          arrival: `${arrivalStart}–${arrivalEnd} CT`,
          start,
          end,
          arrivalStart,
          arrivalEnd,
          status,
          revision: row.revision,
          endDate:
            "end_date" in row && row.end_date
              ? row.end_date
              : row.scheduled_date,
          returnDate: "return_date" in row ? row.return_date : null,
          onTheWay: Boolean("on_the_way_at" in row && row.on_the_way_at),
          photoWaived: Boolean("photo_waived_at" in row && row.photo_waived_at),
          photoWaiverNote:
            "photo_waiver_note" in row ? row.photo_waiver_note : null,
          customer:
            customers.find((c) => c.id === move.customerId)?.name ?? "Customer",
          workerIds: (team.data ?? []).map((p) => p.worker_id),
          crew: move.team,
          truck: row.trucks?.name ?? "Assigned truck",
          truckId: row.truck_id,
          history,
        };
      }),
  );
  return jobs.filter((job) => job !== null);
}
