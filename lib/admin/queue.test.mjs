import test from "node:test";
import assert from "node:assert/strict";
import { daysBetween, needsAction, queueSummary } from "./queue.ts";

const today = "2026-12-10";
const move = (id, extra = {}) => ({
  id,
  customerId: "c1",
  stage: "requested",
  requestStatus: "pending",
  requestedDate: "2026-12-30",
  history: [
    {
      entity: "request",
      recordId: id,
      label: "Request saved",
      date: "2026-12-08",
    },
  ],
  ...extra,
});
const estimate = (id, requestId, status, extra = {}) => ({
  id,
  requestId,
  status,
  isCurrent: true,
  ...extra,
});
const event = (recordId, label, date) => ({
  entity: "estimate",
  recordId,
  label,
  date,
});

test("each waiting move appears once with the step it waits for", () => {
  const items = needsAction(
    {
      moves: [
        move("m1"),
        move("m2"),
        move("m3"),
        move("m4"),
        move("m5"),
        move("m6", { requestStatus: "cancelled" }),
        move("m7"),
      ],
      estimates: [
        estimate("e2", "m2", "draft"),
        estimate("e3", "m3", "awaiting"),
        estimate("e4", "m4", "declined", { declineReason: "price" }),
        estimate("e5", "m5", "accepted"),
        estimate("e7", "m7", "accepted"),
      ],
      jobs: [{ requestId: "m7" }],
      history: [
        event("e3", "Estimate published", "2026-12-09"),
        event("e4", "Estimate declined", "2026-12-10"),
        event("e5", "Estimate accepted", "2026-12-09"),
      ],
      customers: [{ id: "c1", name: "Pat Example" }],
    },
    today,
  );
  assert.deepEqual(
    items.map((i) => [i.moveId, i.kind, i.days, i.urgent]),
    [
      ["m5", "schedule", 1, true],
      ["m1", "estimate", 2, true],
      ["m2", "draft", 2, true],
      ["m4", "changes", 0, false],
      ["m3", "awaiting", 1, false],
    ],
  );
  assert.equal(items.find((i) => i.kind === "changes").declineReason, "price");
  assert.equal(items[0].customer, "Pat Example");
  assert.deepEqual(queueSummary(items), [
    "1 changes requested",
    "1 to schedule",
    "1 to estimate",
    "1 drafts to publish",
    "1 awaiting customers",
  ]);
});

test("customers get three days; close move dates are urgent", () => {
  const data = (status, published, requestedDate = "2026-12-30") => ({
    moves: [move("m1", { requestedDate })],
    estimates: [estimate("e1", "m1", status)],
    jobs: [],
    history: [
      event("e1", "Estimate published", published),
      event("e1", "Estimate accepted", published),
    ],
    customers: [],
  });
  assert.equal(
    needsAction(data("awaiting", "2026-12-08"), today)[0].urgent,
    false,
  );
  assert.equal(
    needsAction(data("awaiting", "2026-12-07"), today)[0].urgent,
    true,
  );
  // Accepted today but moving in two days: urgent to schedule.
  assert.equal(
    needsAction(data("accepted", "2026-12-10", "2026-12-12"), today)[0].urgent,
    true,
  );
  assert.equal(
    needsAction(data("accepted", "2026-12-10"), today)[0].urgent,
    false,
  );
  assert.equal(daysBetween("2026-12-31", "2027-01-02"), 2);
});
