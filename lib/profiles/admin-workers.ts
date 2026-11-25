import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";
import { days, type Availability } from "@/lib/domain";

export type SavedWorker = { id: string; name: string };

export async function adminWorkers(
  id?: string,
): Promise<{ workers: SavedWorker[]; error: boolean }> {
  await requireRole("admin");
  if (id && !uuid(id)) return { workers: [], error: false };
  try {
    const client = await serverSupabase();
    let query = client
      .from("profiles")
      .select("id,full_name")
      .eq("role", "worker")
      .order("full_name")
      .order("id");
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return { workers: [], error: true };
    return {
      workers: (data ?? []).map((row) => ({
        id: row.id,
        name: row.full_name.trim(),
      })),
      error: false,
    };
  } catch (error) {
    logFailure("admin-workers:load", error);
    return { workers: [], error: true };
  }
}

export async function adminWorkerAvailability(
  id: string,
): Promise<{ availability: Availability[]; error: boolean }> {
  await requireRole("admin");
  if (!uuid(id)) return { availability: [], error: false };
  try {
    const client = await serverSupabase();
    const { data, error } = await client
      .from("worker_availability")
      .select("day,available,start_time,end_time")
      .eq("worker_id", id)
      .order("day");
    if (error) return { availability: [], error: true };
    return {
      availability: (data ?? []).map((row) => ({
        day: days[row.day - 1],
        available: row.available,
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
      })),
      error: false,
    };
  } catch (error) {
    logFailure("admin-workers:load", error);
    return { availability: [], error: true };
  }
}
