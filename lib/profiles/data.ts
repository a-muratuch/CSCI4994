import { logFailure } from "@/lib/server-log";
import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";

export async function customerProfile() {
  const account = await requireRole("customer");
  try {
    const client = await serverSupabase();
    const { data, error } = await client
      .from("profiles")
      .select("full_name,phone")
      .eq("id", account.id)
      .eq("role", "customer")
      .single();
    if (error || !data) return { profile: null };
    return {
      profile: {
        name: data.full_name,
        phone: data.phone,
        email: account.email,
      },
    };
  } catch (error) {
    logFailure("data:load", error);
    return { profile: null };
  }
}
