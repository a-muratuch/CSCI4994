import { isUuid } from "@/lib/ids";
import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { requestMove } from "@/lib/requests/data";
import { loadSchedules, type PersistedJob } from "@/lib/jobs/schedules";
import { days, type Availability } from "@/lib/domain";

export type WorkerWorkspace = {
  jobs: PersistedJob[];
  availability: Availability[];
  error?: boolean;
};

export async function workerWorkspace(id?: string): Promise<WorkerWorkspace> {
  const account = await requireRole("worker");
  if (id && !isUuid(id)) return { jobs: [], availability: [] };
  try {
    const client = await serverSupabase();
    const preferences = await client
      .from("worker_availability")
      .select("day,available,start_time,end_time")
      .eq("worker_id", account.id);
    if (preferences.error) throw preferences.error;
    const availability = days.map((day, index) => {
      const row = preferences.data?.find((item) => item.day === index + 1);
      return {
        day,
        available: row?.available ?? false,
        start: row?.start_time.slice(0, 5) ?? "08:00",
        end: row?.end_time.slice(0, 5) ?? "17:00",
      };
    });
    let query = client.from("jobs").select("id,move_requests(*)");
    if (id) query = query.eq("id", id);
    const linked = await query;
    if (linked.error) throw linked.error;
    const moves = (linked.data ?? []).flatMap((row) =>
      row.move_requests ? [requestMove(row.move_requests)] : [],
    );
    // RLS limits these joined jobs/routes to current assignments.
    const jobs = await loadSchedules(
      client,
      moves,
      [],
      id ? moves[0]?.id : undefined,
    );
    return { jobs, availability };
  } catch (error) {
    logFailure("worker:load", error);
    return { jobs: [], availability: [], error: true };
  }
}
