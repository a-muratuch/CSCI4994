import { isUuid as uuid } from "../ids.ts";
export function messageInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.conversationId !== "string" ||
    !uuid(input.conversationId) ||
    typeof input.requestId !== "string" ||
    !uuid(input.requestId) ||
    typeof input.body !== "string"
  )
    return null;
  const body = input.body.trim();
  if (!body || Array.from(body).length > 2000) return null;
  return {
    conversationId: input.conversationId,
    requestId: input.requestId,
    body,
  };
}
