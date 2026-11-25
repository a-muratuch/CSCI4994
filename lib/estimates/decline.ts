// Reasons a customer gives when declining an estimate (Phase 8C). The keys
// match the database check on estimates.decline_reason.
export const declineReasons = [
  { key: "price", label: "The price is too high", changes: true },
  { key: "date", label: "The date or timing does not work", changes: true },
  { key: "scope", label: "Items or services need changes", changes: true },
  { key: "not-moving", label: "I am no longer moving", changes: false },
  { key: "other", label: "Something else", changes: true },
] as const;

export type DeclineReason = (typeof declineReasons)[number]["key"];

export function declineReasonLabel(key: string | null | undefined) {
  return declineReasons.find((reason) => reason.key === key)?.label ?? null;
}

/** Checks the reason and optional note; "Something else" needs a note. */
export function validateDecline(
  reason: unknown,
  note: unknown,
): { reason: DeclineReason; note: string | null } | { error: string } {
  if (!declineReasons.some((r) => r.key === reason))
    return { error: "Choose a reason." };
  const text = typeof note === "string" ? note.trim() : "";
  if (text.length > 500)
    return { error: "Keep the note under 500 characters." };
  if (reason === "other" && !text)
    return { error: "Describe what should change." };
  return { reason: reason as DeclineReason, note: text || null };
}
