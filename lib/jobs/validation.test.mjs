import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
// Next resolves extensionless TypeScript imports; mirror only that resolution for Node.
registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === "../estimates/validation"
        ? new URL("../estimates/validation.ts", context.parentURL).href
        : specifier,
      context,
    );
  },
});
const { validateSchedule } = await import("./validation.ts");
const worker = "00000000-0000-0000-0000-000000000001",
  truck = "00000000-0000-0000-0000-000000000002";
const value = {
  date: "2026-11-20",
  start: "09:00",
  end: "13:00",
  arrivalStart: "09:00",
  arrivalEnd: "10:00",
  workerIds: [worker],
  truckId: truck,
};
test("valid same-day schedule ignores client status and role fields", () => {
  const result = validateSchedule({
    ...value,
    status: "completed",
    role: "admin",
  });
  assert.ok(result.input);
  assert.equal(result.input.status, undefined);
  assert.equal(result.input.role, undefined);
});
test("invalid, infinite, year-zero and rolled calendar dates are rejected", () => {
  for (const date of ["infinity", "0000-01-01", "2026-02-30", "bad", null])
    assert.ok(validateSchedule({ ...value, date }).error);
  assert.ok(validateSchedule({ ...value, date: "2028-02-29" }).input);
});
test("time order and contained arrival windows are enforced", () => {
  for (const change of [
    { end: "08:00" },
    { start: "09:00:01" },
    { arrivalStart: "08:00" },
    { arrivalEnd: "14:00" },
    { arrivalEnd: "09:00" },
    { end: "00:00" },
  ])
    assert.ok(validateSchedule({ ...value, ...change }).error);
});
test("only unique UUID workers and a UUID truck form a valid assignment", () => {
  for (const change of [
    { workerIds: [] },
    { workerIds: [worker, worker] },
    { workerIds: ["customer-alex"] },
    { truckId: "" },
    { truckId: null },
  ])
    assert.ok(validateSchedule({ ...value, ...change }).error);
});

test("long-distance schedules need a later delivery day and a return day", () => {
  const trip = {
    date: "2027-01-08",
    start: "08:00",
    end: "06:00",
    arrivalStart: "08:00",
    arrivalEnd: "10:00",
    workerIds: ["10000000-0000-4000-8000-000000000002"],
    truckId: "20000000-0000-4000-8000-000000000001",
  };
  // End before start is fine when delivery is on a later day.
  const ok = validateSchedule({
    ...trip,
    endDate: "2027-01-09",
    returnDate: "2027-01-11",
  });
  assert.equal(ok.input?.returnDate, "2027-01-11");
  assert.equal(ok.input?.endDate, "2027-01-09");
  // Same-day jobs keep the old rules and carry no dates.
  assert.ok(validateSchedule(trip).error);
  const local = validateSchedule({ ...trip, end: "12:00" });
  assert.equal(local.input?.returnDate, undefined);
  for (const bad of [
    { endDate: "2027-01-09" }, // later delivery without a return day
    { endDate: "2027-01-09", returnDate: "2027-01-08" }, // back before delivery
    { endDate: "2027-01-07", returnDate: "2027-01-09" }, // delivery before start
    { endDate: "2027-01-09", returnDate: "2027-02-20" }, // over 30 days
    { endDate: "2027-01-09", returnDate: "2027-01-11", arrivalStart: "07:00" },
  ])
    assert.ok(validateSchedule({ ...trip, ...bad }).error, JSON.stringify(bad));
});
