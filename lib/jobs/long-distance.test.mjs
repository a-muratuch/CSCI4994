import test from "node:test";
import assert from "node:assert/strict";
import { addDays, missingTripDays, planTrip } from "./long-distance.ts";

const base = { date: "2027-01-08", start: "08:00", minimumMinutes: 120 };

test("local moves stay on one day, rounded to the half hour", () => {
  // About 3 h of work and 1 h of driving (Oxford → Tupelo).
  assert.deepEqual(planTrip({ ...base, workMinutes: 175, driveMinutes: 60 }), {
    longDistance: false,
    endDate: "2027-01-08",
    endTime: "12:00",
    returnDate: null,
    outboundDays: 1,
    returnDays: 0,
  });
  // Minimum hours still apply.
  assert.equal(
    planTrip({ ...base, workMinutes: 30, driveMinutes: 10 }).endTime,
    "10:00",
  );
  // Unknown distance is treated as no driving.
  assert.equal(
    planTrip({ ...base, workMinutes: 180, driveMinutes: null }).longDistance,
    false,
  );
});

test("long-distance moves use 10-hour days and include the drive back", () => {
  // Oxford → Miami: ~3 h of work, ~17 h driving each way.
  const plan = planTrip({ ...base, workMinutes: 180, driveMinutes: 1020 });
  // Day 1: load 1.5 h + drive 8.5 h. Day 2: drive 8.5 h + unload 1.5 h (17:30).
  assert.equal(plan.longDistance, true);
  assert.equal(plan.endDate, "2027-01-09");
  assert.equal(plan.endTime, "18:00");
  assert.equal(plan.outboundDays, 2);
  // Return: 17 h → days 3 and 4 (10 h + 7 h).
  assert.equal(plan.returnDate, "2027-01-11");
  assert.equal(plan.returnDays, 2);
});

test("a move that cannot finish by 8 PM becomes long-distance", () => {
  // An afternoon local move that ends by 8 PM stays local.
  assert.equal(
    planTrip({ ...base, start: "14:00", workMinutes: 180, driveMinutes: 60 })
      .endTime,
    "18:00",
  );
  // 16:00 + 5 h would end at 21:00: day 1 has 4 h (load 1.5 h, drive 2 h,
  // unload 0.5 h); day 2 unloads 1 h from 08:00 and drives back 2 h.
  const plan = planTrip({
    ...base,
    start: "16:00",
    workMinutes: 180,
    driveMinutes: 120,
  });
  assert.equal(plan.longDistance, true);
  assert.equal(plan.endDate, "2027-01-09");
  assert.equal(plan.endTime, "09:00");
  assert.equal(plan.returnDate, "2027-01-09");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("trip days without availability are listed", () => {
  const weekdaysOnly = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ].map((day) => ({ day, available: true }));
  // Friday 2027-01-08 → Wednesday 2027-01-13 misses the weekend.
  assert.deepEqual(missingTripDays(weekdaysOnly, "2027-01-08", "2027-01-13"), [
    "2027-01-09",
    "2027-01-10",
  ]);
  assert.deepEqual(
    missingTripDays(weekdaysOnly, "2027-01-11", "2027-01-11"),
    [],
  );
  assert.deepEqual(
    missingTripDays(
      [{ day: "Saturday", available: false }],
      "2027-01-08",
      "2027-01-09",
    ),
    ["2027-01-09"],
  );
});
