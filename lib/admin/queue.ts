// The administrator's "Needs action" list (Phase 8F): one entry per move that
// is waiting on someone, oldest and most urgent first. Pure, so it is tested
// without a database. Dates are Central Time "YYYY-MM-DD" strings.
import type { EstimateView, History, Job, MoveView } from "../domain";

export type QueueKind =
  "changes" | "schedule" | "estimate" | "draft" | "awaiting";

export type QueueItem = {
  kind: QueueKind;
  moveId: string;
  referenceNumber?: number;
  /** The estimate to open, when there is one. */
  estimateId: string | null;
  customer: string;
  requestedDate: string;
  preferredWindow: string | null;
  /** When the move started waiting for this step. */
  since: string;
  days: number;
  /** Waiting too long, or the requested move date is close. */
  urgent: boolean;
  declineReason: string | null;
};

/** Administrator steps come before waiting on customers. */
const order: QueueKind[] = [
  "changes",
  "schedule",
  "estimate",
  "draft",
  "awaiting",
];
/** Customers get three days to decide before a follow-up is suggested. */
const followUpDays = 3;

export function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );
}

export function needsAction(
  data: {
    moves: MoveView[];
    estimates: EstimateView[];
    jobs: Pick<Job, "requestId">[];
    history: History[];
    customers: { id: string; name: string }[];
  },
  today: string,
): QueueItem[] {
  const items: QueueItem[] = [];
  for (const move of data.moves) {
    if (move.stage !== "requested" || move.requestStatus === "cancelled")
      continue;
    if (data.jobs.some((job) => job.requestId === move.id)) continue;
    const estimate = data.estimates.find(
      (e) => e.requestId === move.id && e.isCurrent !== false,
    );
    const lastEvent = (label: string) =>
      data.history
        .filter((h) => h.recordId === estimate?.id && h.label === label)
        .at(-1)?.date;
    const requested =
      move.history.find((h) => h.entity === "request")?.date ?? today;
    let kind: QueueKind, since: string;
    if (!estimate) [kind, since] = ["estimate", requested];
    else if (estimate.status === "draft")
      [kind, since] = [
        "draft",
        lastEvent("Revised estimate created") ?? requested,
      ];
    else if (estimate.status === "awaiting")
      [kind, since] = [
        "awaiting",
        lastEvent("Estimate published") ?? requested,
      ];
    else if (estimate.status === "declined")
      [kind, since] = ["changes", lastEvent("Estimate declined") ?? requested];
    else
      [kind, since] = ["schedule", lastEvent("Estimate accepted") ?? requested];
    const days = Math.max(0, daysBetween(since, today));
    const soon = daysBetween(today, move.requestedDate) <= 3;
    items.push({
      kind,
      moveId: move.id,
      referenceNumber: move.referenceNumber,
      estimateId: estimate?.id ?? null,
      customer:
        data.customers.find((c) => c.id === move.customerId)?.name ??
        "Customer",
      requestedDate: move.requestedDate,
      preferredWindow: move.preferredWindow ?? null,
      since,
      days,
      urgent:
        kind === "awaiting"
          ? days >= followUpDays
          : days >= 1 || (kind !== "changes" && soon),
      declineReason: estimate?.declineReason ?? null,
    });
  }
  return items.sort(
    (a, b) =>
      Number(b.urgent) - Number(a.urgent) ||
      order.indexOf(a.kind) - order.indexOf(b.kind) ||
      a.since.localeCompare(b.since) ||
      a.requestedDate.localeCompare(b.requestedDate),
  );
}

/** Short counts for the summary line, in queue order. */
export function queueSummary(items: QueueItem[]) {
  const labels: Record<QueueKind, string> = {
    changes: "changes requested",
    schedule: "to schedule",
    estimate: "to estimate",
    draft: "drafts to publish",
    awaiting: "awaiting customers",
  };
  return order
    .map((kind) => ({
      kind,
      count: items.filter((i) => i.kind === kind).length,
    }))
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.count} ${labels[entry.kind]}`);
}
