import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";

export type SavedTruck = { id: string; name: string; active: boolean };

export async function adminTrucks(
  id?: string,
): Promise<{ trucks: SavedTruck[]; error: boolean }> {
  await requireRole("admin");
  if (id && !uuid(id)) return { trucks: [], error: false };
  try {
    const client = await serverSupabase();
    let query = client.from("trucks").select("*").order("name").order("id");
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return { trucks: [], error: true };
    return {
      trucks: (data ?? []).map((row) => ({
        id: row.id,
        name: row.name.trim(),
        active: row.active ?? true,
      })),
      error: false,
    };
  } catch (error) {
    logFailure("admin-trucks:load", error);
    return { trucks: [], error: true };
  }
}
