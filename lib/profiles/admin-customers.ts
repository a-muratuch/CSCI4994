import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";

export type SavedCustomer = { id: string; name: string; phone: string };

export async function adminCustomers(
  id?: string,
): Promise<{ customers: SavedCustomer[]; error: boolean }> {
  await requireRole("admin");
  if (id && !uuid(id)) return { customers: [], error: false };
  try {
    const client = await serverSupabase();
    let query = client
      .from("profiles")
      .select("id,full_name,phone")
      .eq("role", "customer")
      .order("full_name")
      .order("id");
    if (id) query = query.eq("id", id);
    const { data, error } = await query;
    if (error) return { customers: [], error: true };
    return {
      customers: (data ?? []).map((row) => ({
        id: row.id,
        name: row.full_name.trim(),
        phone: row.phone,
      })),
      error: false,
    };
  } catch (error) {
    logFailure("admin-customers:load", error);
    return { customers: [], error: true };
  }
}
