"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
export async function confirmInvitation(form: FormData) {
  const token = form.get("token_hash");
  let destination = "/auth/error?reason=confirmation";
  if (typeof token === "string" && /^[a-f0-9]{32,128}$/i.test(token)) {
    try {
      const client = await serverSupabase(true);
      const { error } = await client.auth.verifyOtp({
        token_hash: token,
        type: "invite",
      });
      if (!error) {
        const { account } = await readAccount(client);
        if (account?.role === "worker") destination = "/reset-password";
        else await client.auth.signOut({ scope: "local" });
      }
    } catch {
      /* No tokens or invitation details are logged. */
    }
  }
  redirect(destination);
}
