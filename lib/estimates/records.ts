import type { EstimateView } from "../domain";
import { isUuid } from "../ids.ts";

export function estimateRecord(value: unknown): EstimateView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !isUuid(row.id) ||
    !isUuid(row.request_id) ||
    !["draft", "awaiting", "accepted", "declined"].includes(
      String(row.status),
    ) ||
    !Number.isSafeInteger(row.revision) ||
    Number(row.revision) < 1 ||
    !Array.isArray(row.estimate_items) ||
    !Array.isArray(row.inclusions) ||
    !row.inclusions.every((item) => typeof item === "string") ||
    !Array.isArray(row.exclusions) ||
    !row.exclusions.every((item) => typeof item === "string") ||
    typeof row.terms !== "string"
  )
    return null;
  const lines = [];
  for (const item of row.estimate_items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.label !== "string" ||
      !Number.isSafeInteger(item.amount_cents) ||
      item.amount_cents < 0 ||
      !Number.isSafeInteger(item.position)
    )
      return null;
    lines.push({
      label: item.label,
      amountCents: item.amount_cents,
      position: item.position,
    });
  }
  lines.sort((a, b) => a.position - b.position);
  if (
    row.status !== "draft" &&
    row.total_cents !== lines.reduce((sum, line) => sum + line.amountCents, 0)
  )
    return null;
  return {
    id: row.id,
    requestId: row.request_id,
    moveId: row.request_id,
    revision: Number(row.revision),
    version: typeof row.version === "number" ? row.version : 1,
    isCurrent: row.is_current !== false,
    status: row.status as EstimateView["status"],
    lines: lines.map(({ label, amountCents }) => ({ label, amountCents })),
    inclusions: row.inclusions,
    exclusions: row.exclusions,
    terms: row.terms,
    declineReason:
      typeof row.decline_reason === "string" ? row.decline_reason : null,
    declineNote: typeof row.decline_note === "string" ? row.decline_note : null,
    proposal:
      typeof row.proposed_date === "string" &&
      typeof row.proposed_arrival_start === "string" &&
      typeof row.proposed_arrival_end === "string"
        ? {
            date: row.proposed_date,
            arrivalStart: row.proposed_arrival_start.slice(0, 5),
            arrivalEnd: row.proposed_arrival_end.slice(0, 5),
          }
        : null,
  };
}
