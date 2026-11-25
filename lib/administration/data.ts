import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
export const administrationReady = cache(async () => {
  const { data, error } = await (
    await serverSupabase()
  ).rpc("security_capabilities");
  return !error && data === 5;
});
export function invitationsConfigured() {
  return Boolean(
    process.env.SUPABASE_SECRET_KEY &&
    process.env.REBEL_WORKER_INVITES_READY === "true",
  );
}
