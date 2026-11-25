"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { logFailure } from "@/lib/server-log";
import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";
import { messageInput } from "./validation";

export async function openChat(
  kind: unknown,
  target: unknown,
): Promise<
  ActionResult<{
    id?: string;
    role?: "customer" | "worker" | "admin";
    error?: string;
  }>
> {
  if (
    typeof kind !== "string" ||
    !["customer-support", "worker-support", "move-team"].includes(kind) ||
    typeof target !== "string" ||
    !uuid(target)
  )
    return { ok: false, error: "Conversation unavailable." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (!account)
      return { ok: false, error: "Sign in before opening messages." };
    const { data, error } = await client.rpc("open_conversation", {
      p_kind: kind,
      p_target_id: target,
    });
    if (error || !data)
      return {
        ok: false,
        error:
          "This conversation could not be opened. Check your access or try again.",
      };
    return { ok: true, id: data.id, role: account.role };
  } catch (error) {
    logFailure("messages:action", error);
    return { ok: false, error: "Messages are unavailable. Try again." };
  }
}
export async function sendChat(
  value: unknown,
): Promise<ActionResult<{ message: string }>> {
  const input = messageInput(value);
  if (!input)
    return { ok: false, message: "Enter a message of 1–2000 characters." };
  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (!account) return { ok: false, message: "Sign in before sending." };
    const { error } = await client.rpc("send_message", {
      p_conversation_id: input.conversationId,
      p_body: input.body,
      p_request_id: input.requestId,
    });
    if (error)
      return {
        ok: false,
        message:
          error.hint === "rate_limit"
            ? "Too many messages. Wait a minute, then retry this message."
            : error.code === "42501"
              ? "You no longer have access to this conversation. Refresh the page."
              : error.code === "22023"
                ? "This message could not be sent. The team chat may be closed; refresh to check."
                : "Sending could not be confirmed. Retry the same message or refresh to check its history.",
      };
    return { ok: true, message: "Message sent." };
  } catch (error) {
    logFailure("messages:action", error);
    return {
      ok: false,
      message:
        "Sending could not be confirmed. Retry the same message or refresh to check its history.",
    };
  }
}

export async function markRead(id: string, messageId: string) {
  if (!uuid(id) || !uuid(messageId)) return false;
  const client = await serverSupabase(true);
  const { error } = await client.rpc("mark_conversation_read", {
    p_id: id,
    p_message_id: messageId,
  });
  if (error && !["PGRST202", "42883"].includes(error.code))
    logFailure("messages:mark-read", error);
  if (!error)
    for (const role of ["customer", "worker", "admin"])
      revalidatePath("/" + role, "layout");
  return !error;
}
