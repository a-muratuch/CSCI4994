import test from "node:test";
import assert from "node:assert/strict";
import { parseCents, estimateTotal, estimateError } from "./estimates.ts";
import {
  nextMove,
  moveStatus,
  progressFor,
  workerProgressFor,
} from "./status.ts";
import {
  overlaps,
  intervalError,
  availabilityErrors,
  days,
} from "./schedule.ts";
test("prices use exact integer cents and reject malformed or excessive amounts", () => {
  assert.equal(parseCents("10.01"), 1001);
  assert.equal(parseCents("0.1"), 10);
  assert.equal(parseCents("9999999.99"), 999999999);
  for (const s of ["-1", "1.001", "1e2", "NaN", "10000000"])
    assert.equal(parseCents(s), null);
  const input = {
    lines: [
      { label: "Labor", amountCents: 1001 },
      { label: "Truck", amountCents: 2002 },
    ],
    inclusions: ["Moving"],
    exclusions: ["Packing"],
    terms: "Review scope.",
  };
  assert.equal(estimateTotal(input), 3003);
  assert.equal(estimateError(input), undefined);
  assert.ok(estimateError({ ...input, lines: [] }));
});
test("upcoming selection uses confirmed date/time, excluding completed and unconfirmed requests without reordering input", () => {
  const late = {
    id: "late",
    stage: "scheduled",
    requestedDate: "2026-01-01",
    appointment: { date: "2026-12-01", start: "12:00" },
  };
  const early = {
    id: "early",
    stage: "in-progress",
    appointment: { date: "2026-12-01", start: "09:00" },
  };
  const rows = [
    late,
    {
      id: "done",
      stage: "completed",
      appointment: { date: "2026-10-01", start: "08:00" },
    },
    { id: "pending", stage: "requested" },
    early,
  ];
  assert.equal(nextMove(rows), early);
  assert.equal(rows[0], late);
  assert.equal(nextMove([{ stage: "requested" }]), undefined);
});
test("status and progress distinguish scheduling, estimates and completed work", () => {
  assert.equal(
    moveStatus({ stage: "requested" }, { status: "awaiting" }),
    "Estimate ready",
  );
  assert.equal(
    moveStatus({ stage: "requested" }, { status: "accepted" }),
    "Awaiting scheduling",
  );
  assert.equal(moveStatus({ stage: "in-progress" }), "In progress");
  assert.ok(
    progressFor({ stage: "completed" }).every((s) => s.state === "complete"),
  );
  assert.equal(progressFor({ stage: "scheduled" })[2].state, "current");
  const current = (...args) =>
    progressFor(...args).findIndex((s) => s.state === "current");
  assert.equal(current({ stage: "requested" }), 0);
  assert.equal(current({ stage: "requested" }, { status: "awaiting" }), 1);
  assert.equal(current({ stage: "requested" }, { status: "accepted" }), 2);
  assert.equal(current({ stage: "requested" }, { status: "draft" }), 0);
});
test("worker progress follows the job status and the on-the-way flag", () => {
  const current = (job) =>
    workerProgressFor(job).findIndex((s) => s.state === "current");
  assert.equal(current({ status: "scheduled" }), 0);
  assert.equal(current({ status: "scheduled", onTheWay: true }), 1);
  assert.equal(current({ status: "in-progress" }), 2);
  assert.ok(
    workerProgressFor({ status: "completed" }).every(
      (s) => s.state === "complete",
    ),
  );
  assert.ok(
    workerProgressFor({ status: "cancelled" }).every(
      (s) => s.state === "upcoming",
    ),
  );
});
test("half-open scheduling intervals allow adjacency and reject invalid dates or overnight work", () => {
  assert.equal(overlaps("09:00", "10:00", "10:00", "11:00"), false);
  assert.equal(overlaps("09:00", "10:01", "10:00", "11:00"), true);
  assert.equal(intervalError("2026-12-07", "09:00", "10:00"), undefined);
  for (const values of [
    ["2026-02-30", "09:00", "10:00"],
    ["2026-12-07", "23:00", "01:00"],
    ["2026-12-07", "09:00", "09:00"],
  ])
    assert.ok(intervalError(...values));
});
test("availability requires each weekday once and valid available intervals", () => {
  const rows = days.map((day) => ({
    day,
    available: true,
    start: "08:00",
    end: "17:00",
  }));
  assert.deepEqual(availabilityErrors(rows), {});
  assert.ok(availabilityErrors(rows.slice(1)).Monday);
  assert.ok(availabilityErrors([...rows, rows[0]]).Monday);
  assert.ok(
    availabilityErrors(
      rows.map((r) => (r.day === "Friday" ? { ...r, end: "07:00" } : r)),
    ).Friday,
  );
});
