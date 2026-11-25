import test from "node:test";
import assert from "node:assert/strict";
import { validateAvailability, validProgress } from "./validation.ts";
const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const rows = days.map((day) => ({
  day,
  available: true,
  start: "08:00",
  end: "17:00",
}));
test("availability maps weekdays to ISO days and strips supplied identities", () => {
  const mapped = validateAvailability(
    rows.map((row) => ({ ...row, worker_id: "someone-else" })),
  );
  assert.equal(mapped.length, 7);
  assert.equal(mapped[6].day, 7);
  assert.equal(mapped[0].worker_id, undefined);
});
test("availability requires exactly seven unique days with booleans and valid minute times", () => {
  for (const value of [
    null,
    [],
    rows.slice(1),
    [...rows.slice(1), rows[1]],
    rows.map((row) => ({ ...row, available: "true" })),
    rows.map((row) => ({ ...row, start: "24:00" })),
    rows.map((row) => ({ ...row, start: "08:00:01" })),
    rows.map((row) => ({ ...row, end: "08:00" })),
  ])
    assert.equal(validateAvailability(value), null);
  assert.ok(
    validateAvailability(
      rows.map((row) => ({ ...row, available: false, end: "07:00" })),
    ),
  );
});
test("progress requires a UUID, active expected state and positive integer revision", () => {
  const id = "1e9baf98-c454-45ef-bed1-8aacf6438166";
  assert.ok(validProgress(id, "scheduled", 2));
  assert.ok(validProgress(id, "in-progress", 3));
  for (const [job, status, rev] of [
    [id, "completed", 4],
    ["fixture-job", "scheduled", 2],
    [id, "scheduled", 0],
    [id, "scheduled", 1.5],
    [id, "scheduled", "2"],
  ])
    assert.equal(validProgress(job, status, rev), false);
});
