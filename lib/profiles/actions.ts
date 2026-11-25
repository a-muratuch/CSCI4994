"use server";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { revalidatePath } from "next/cache";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import {
  validateContact,
  type ContactDetails,
  type ContactErrors,
} from "./validation";

type ContactResult = ActionResult<{
  ok: boolean;
  message: string;
  errors?: ContactErrors;
  profile?: ContactDetails;
}>;

export async function saveContact(value: unknown): Promise<ContactResult> {
  const checked = validateContact(value);
  if (!checked.input)
    return {
      ok: false,
      errors: checked.errors,
      message: "Please correct the highlighted fields.",
    };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (account?.role !== "customer")
      return {
        ok: false,
        message: "Sign in to your customer account before saving.",
      };
    // Only these two columns are writable. Identity, role and Auth email never come from the form.
    const { data, error } = await client
      .from("profiles")
      .update({ full_name: checked.input.name, phone: checked.input.phone })
      .eq("id", account.id)
      .eq("role", "customer")
      .select("full_name,phone")
      .single();
    if (error || !data)
      return {
        ok: false,
        message:
          "The save could not be confirmed. Reload account settings before retrying.",
      };
    revalidatePath("/", "layout");
    return {
      ok: true,
      profile: { name: data.full_name, phone: data.phone },
      message:
        "Profile saved to your account. Your sign-in email has not changed.",
    };
  } catch (error) {
    logFailure("profiles:action", error);
    return {
      ok: false,
      message:
        "The save could not be confirmed. Reload account settings before retrying.",
    };
  }
}
