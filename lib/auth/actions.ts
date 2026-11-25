"use server";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { siteUrl, supabaseConfig } from "@/lib/supabase/config";
import { readAccount } from "./account";
import { roleHome, roleLabel } from "./roles";
import { readAuthInput, validateAuth, type AuthResult } from "./validation";

export async function authenticate(form: FormData): Promise<AuthResult> {
  const input = readAuthInput(form);
  if (!input)
    return {
      ok: false,
      status: "error",
      message: "Choose a valid sign-in form.",
    };
  const { mode, values } = input;
  const errors = validateAuth(mode, values);
  if (Object.keys(errors).length) return { ok: false, status: "error", errors };
  if (!supabaseConfig())
    return {
      ok: false,
      status: "error",
      message:
        "Sign-in is not configured yet. Please contact the project owner.",
    };
  let destination: string;
  try {
    const client = await serverSupabase(true);
    if (mode === "register") {
      const { data, error } = await client.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: {
          data: { full_name: values.fullName.trim() },
          emailRedirectTo: `${siteUrl()}/auth/callback`,
        },
      });
      if (error)
        return {
          ok: false,
          status: "error",
          message:
            error.status === 429
              ? "Too many attempts. Wait a moment and try again."
              : error.code === "weak_password"
                ? "Choose a stronger password with at least 12 characters."
                : "Registration could not be completed. Please try again.",
        };
      if (!data.session)
        return {
          ok: true,
          status: "confirmation",
          message:
            "Check your email for a confirmation link. If this address can be registered, you can confirm it and then sign in.",
        };
    } else {
      const { error } = await client.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });
      if (error)
        return {
          ok: false,
          status: "error",
          message:
            error.code === "email_not_confirmed"
              ? "Confirm your email before signing in."
              : error.status === 429
                ? "Too many attempts. Wait a moment and try again."
                : "Could not sign in. Check your email and password, then try again.",
        };
    }
    const { account, issue } = await readAccount(client);
    if (issue || !account) {
      await client.auth.signOut({ scope: "local" });
      return {
        ok: false,
        status: "error",
        message:
          "Your account profile could not be loaded. Please contact the project owner.",
      };
    }
    const expected =
      mode === "worker-login"
        ? "worker"
        : mode === "admin-login"
          ? "admin"
          : "customer";
    if (account.role !== expected) {
      await client.auth.signOut({ scope: "local" });
      return {
        ok: false,
        status: "error",
        message: `This account does not have ${roleLabel(expected).toLowerCase()} access. Use the sign-in page for your assigned role.`,
      };
    }
    destination = roleHome(account.role);
  } catch (error) {
    logFailure("auth:action", error);
    return {
      ok: false,
      status: "error",
      message: "Sign-in is temporarily unavailable. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  // Return only a verified destination; the client replaces its route cache after cookies are written.
  return { ok: true, status: "success", destination };
}

export async function signOut(): Promise<ActionResult<{ message: string }>> {
  try {
    const client = await serverSupabase(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      return { ok: false, message: "Could not sign out. Please try again." };
  } catch (error) {
    logFailure("auth:action", error);
    return {
      ok: false,
      message: "Sign-out is temporarily unavailable. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/");
}
