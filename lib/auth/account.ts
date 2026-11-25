import { connection } from "next/server";
import { logFailure } from "@/lib/server-log";
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import {
  accountFromProfile,
  roleHome,
  roleLogin,
  type Account,
  type Role,
} from "./roles";

type AccountResult = {
  account: Account | null;
  issue: "configuration" | "unavailable" | "profile" | null;
};

export async function readAccount(
  client: Awaited<ReturnType<typeof serverSupabase>>,
): Promise<AccountResult> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    const unavailable =
      error &&
      (!error.status || error.status >= 500) &&
      error.name !== "AuthSessionMissingError";
    if (unavailable) logFailure("auth:user-read", error);
    return { account: null, issue: unavailable ? "unavailable" : null };
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();
  if (profileError) logFailure("auth:profile-read", profileError);
  const account = profileError
    ? null
    : accountFromProfile(data.user.id, data.user.email ?? "", profile);
  return { account, issue: account ? null : "profile" };
}

// Memoize only within a server render, never across users or requests.
export const currentAccount = cache(async (): Promise<AccountResult> => {
  // Authentication is request-time work; do not catch Next prerender control flow.
  await connection();
  if (!supabaseConfig()) return { account: null, issue: "configuration" };
  try {
    return await readAccount(await serverSupabase());
  } catch (error) {
    logFailure("auth:account-load", error);
    return { account: null, issue: "unavailable" };
  }
});

export async function requireRole(role: Role) {
  const { account, issue } = await currentAccount();
  if (issue) redirect(`/auth/error?reason=${issue}`);
  if (!account) redirect(roleLogin(role));
  if (account.role !== role) redirect(roleHome(account.role));
  return account;
}
