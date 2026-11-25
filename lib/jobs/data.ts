import { administrationReady } from "@/lib/administration/data";
import { logFailure } from "@/lib/server-log";
import "server-only";
import { estimateWorkspace } from "@/lib/estimates/data";
import { serverSupabase } from "@/lib/supabase/server";
import { days, type Availability } from "@/lib/domain";
export type JobWorkspace = Awaited<ReturnType<typeof jobWorkspace>>["data"];
export async function jobWorkspace(scope?: {
  jobId?: string;
  estimateId?: string;
}) {
  const result = await estimateWorkspace("admin", scope);
  const empty = {
    ...result.data,
    workers: [] as { id: string; name: string; availability: Availability[] }[],
    trucks: [] as { id: string; name: string }[],
    assignments: [] as {
      jobId: string;
      workerIds: string[];
      truckId: string;
    }[],
  };
  if (result.error) return { data: empty, error: true };
  try {
    const client = await serverSupabase();
    const manage = await administrationReady();
    let workerQuery = client
      .from("profiles")
      .select("id,full_name")
      .eq("role", "worker")
      .order("full_name")
      .order("id");
    let truckQuery = client
      .from("trucks")
      .select("id,name")
      .order("name")
      .order("id");
    if (manage) {
      workerQuery = workerQuery.eq("active", true);
      truckQuery = truckQuery.eq("active", true);
    }
    const [workers, trucks, availability] = await Promise.all([
      workerQuery,
      truckQuery,
      client.from("worker_availability").select("*").order("day"),
    ]);
    if (workers.error || trucks.error || availability.error)
      return { data: empty, error: true };
    return {
      data: {
        ...result.data,
        workers: (workers.data ?? []).map((w) => ({
          id: w.id,
          name: w.full_name.trim() || "Worker",
          availability: (availability.data ?? [])
            .filter((a) => a.worker_id === w.id)
            .map((a) => ({
              day: days[a.day - 1],
              available: a.available,
              start: a.start_time.slice(0, 5),
              end: a.end_time.slice(0, 5),
            })),
        })),
        trucks: trucks.data ?? [],
        assignments: result.data.jobs.map((j) => ({
          jobId: j.id,
          workerIds: j.workerIds,
          truckId: j.truckId,
        })),
      },
      error: false,
    };
  } catch (error) {
    logFailure("jobs:load", error);
    return { data: empty, error: true };
  }
}
