"use server";
import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { serverSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/config";
import { readAccount } from "./account";
import { roleLogin } from "./roles";
import {
  passwordErrors,
  recentEmailProof,
  type PasswordErrors,
} from "./password";
type PasswordResult = ActionResult<{
  message: string;
  errors?: PasswordErrors;
}>;
function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export async function requestPasswordReset(
  form: FormData,
): Promise<PasswordResult> {
  const email = text(form, "email").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return {
      ok: false,
      message: "Enter a valid email address.",
      errors: { email: "Enter a valid email address." },
    };
  try {
    const client = await serverSupabase(true);
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/callback`,
    });
    if (error && error.status !== 400 && error.status !== 422) {
      logFailure("auth:reset-request", error);
      return {
        ok: false,
        message:
          error.status === 429
            ? "Too many attempts. Wait a moment before trying again."
            : "Password recovery is temporarily unavailable. Please try again.",
      };
    }
    return {
      ok: true,
      message:
        "If an account matches that address, you will receive a password reset link. Open it in this browser.",
    };
  } catch (error) {
    logFailure("auth:reset-request", error);
    return {
      ok: false,
      message:
        "Password recovery is temporarily unavailable. Please try again.",
    };
  }
}

export async function savePassword(form: FormData): Promise<PasswordResult> {
  const change = text(form, "mode") === "change";
  if (!change && text(form, "mode") !== "reset")
    return { ok: false, message: "Reopen the password form." };
  const value = {
    password: text(form, "password"),
    confirmation: text(form, "confirmation"),
    currentPassword: text(form, "currentPassword"),
  };
  const errors = passwordErrors(value, change);
  if (Object.keys(errors).length)
    return {
      ok: false,
      message: "Please correct the highlighted fields.",
      errors,
    };
  let destination: string;
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (!account || (change && account.role !== "customer"))
      return {
        ok: false,
        message:
          "Sign in to the correct account before changing your password.",
      };
    if (change) {
      const result = await client.auth.signInWithPassword({
        email: account.email,
        password: value.currentPassword,
      });
      if (result.error || result.data.user?.id !== account.id)
        return {
          ok: false,
          message: "Your current password could not be verified.",
          errors: { currentPassword: "Check your current password." },
        };
    } else {
      const claims = await client.auth.getClaims();
      if (claims.error || !recentEmailProof(claims.data?.claims, account.id))
        return {
          ok: false,
          message:
            "This reset session is unavailable or expired. Request a new reset link.",
        };
    }
    const { error } = await client.auth.updateUser({
      password: value.password,
    });
    if (error) {
      logFailure("auth:password-update", error);
      return {
        ok: false,
        message:
          error.code === "same_password"
            ? "Choose a different password."
            : error.code === "weak_password"
              ? "Choose a stronger password."
              : "The password change could not be confirmed. Please try again.",
      };
    }
    const ended = await client.auth.signOut({ scope: "local" });
    if (ended.error) {
      logFailure("auth:password-sign-out", ended.error);
      return {
        ok: true,
        message:
          "Password changed. Sign out before signing in with the new password.",
      };
    }
    destination = `${roleLogin(account.role)}?password=updated`;
  } catch (error) {
    logFailure("auth:password-update", error);
    return {
      ok: false,
      message: "The password change could not be confirmed. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  redirect(destination, RedirectType.replace);
}
