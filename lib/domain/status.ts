import type { Job, JobStatus, MoveView, EstimateView } from "./types";
export const statusDefinitions = {
  requested: { label: "Request pending", tone: "neutral" },
  "estimate-draft": { label: "Estimate draft", tone: "neutral" },
  "estimate-ready": { label: "Estimate ready", tone: "warning" },
  "coordinator-review": { label: "Coordinator review needed", tone: "warning" },
  "awaiting-scheduling": { label: "Awaiting scheduling", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
  awaiting: { label: "Awaiting decision", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "neutral" },
  "in-progress": { label: "In progress", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
} as const;
export type Status = keyof typeof statusDefinitions;
export function statusLabel(status: Status) {
  return statusDefinitions[status].label;
}
export const statusLabels: Record<JobStatus, string> = {
  cancelled: statusLabel("cancelled"),
  scheduled: statusLabel("scheduled"),
  "in-progress": statusLabel("in-progress"),
  completed: statusLabel("completed"),
};
export function moveStatusKey(move: MoveView, estimate?: EstimateView): Status {
  if (move.stage !== "requested") return move.stage;
  return estimate?.status === "draft"
    ? "estimate-draft"
    : estimate?.status === "accepted"
      ? "awaiting-scheduling"
      : estimate?.status === "declined"
        ? "coordinator-review"
        : estimate?.status === "awaiting"
          ? "estimate-ready"
          : "requested";
}
export function moveStatus(move: MoveView, estimate?: EstimateView) {
  return statusLabel(moveStatusKey(move, estimate));
}
export function nextMove(moves: MoveView[]) {
  return moves
    .filter(
      (move) =>
        move.appointment &&
        (move.stage === "scheduled" || move.stage === "in-progress"),
    )
    .sort((a, b) =>
      `${a.appointment!.date}${a.appointment!.start}`.localeCompare(
        `${b.appointment!.date}${b.appointment!.start}`,
      ),
    )[0];
}
export type ProgressState = "complete" | "current" | "upcoming";
export type ProgressStep = { label: string; state: ProgressState };

/** Marks every step before `current` complete, `current` itself current. */
function stepsFrom(labels: string[], current: number): ProgressStep[] {
  const last = labels.length - 1;
  return labels.map((label, i) => ({
    label,
    state:
      i < current || (current === last && i === last)
        ? "complete"
        : i === current
          ? "current"
          : "upcoming",
  }));
}

/**
 * Customer move steps. A pending request moves to the estimate step once an
 * estimate awaits a decision, and to scheduling once it is accepted.
 */
export function progressFor(
  move: Pick<MoveView, "stage">,
  estimate?: Pick<EstimateView, "status">,
): ProgressStep[] {
  const current =
    move.stage === "completed"
      ? 4
      : move.stage === "in-progress"
        ? 3
        : move.stage === "scheduled"
          ? 2
          : estimate?.status === "accepted"
            ? 2
            : estimate?.status === "awaiting"
              ? 1
              : 0;
  return stepsFrom(
    ["Request", "Estimate", "Booked", "Move day", "Delivered"],
    current,
  );
}

/** Crew-side steps. A cancelled job has no current step. */
export function workerProgressFor(
  job: Pick<Job, "status" | "onTheWay">,
): ProgressStep[] {
  const current =
    job.status === "completed"
      ? 3
      : job.status === "in-progress"
        ? 2
        : job.status === "scheduled"
          ? job.onTheWay
            ? 1
            : 0
          : -1;
  return stepsFrom(
    ["Scheduled", "On the way", "In progress", "Completed"],
    current,
  );
}
