import test from "node:test";
import assert from "node:assert/strict";
import { addMinutes, defaultArrival, jobMinutes } from "./arrival.ts";

test("arrival window defaults to one hour from the work start", () => {
  assert.deepEqual(defaultArrival("08:00", "12:00"), {
    arrivalStart: "08:00",
    arrivalEnd: "09:00",
  });
  assert.deepEqual(defaultArrival("09:30", ""), {
    arrivalStart: "09:30",
    arrivalEnd: "10:30",
  });
});

test("arrival window stays inside the work interval and the day", () => {
  assert.deepEqual(defaultArrival("08:00", "08:30"), {
    arrivalStart: "08:00",
    arrivalEnd: "08:30",
  });
  assert.deepEqual(defaultArrival("23:30", ""), {
    arrivalStart: "23:30",
    arrivalEnd: "23:59",
  });
  assert.deepEqual(defaultArrival("", "12:00"), {
    arrivalStart: "",
    arrivalEnd: "",
  });
});

test("job length follows the inventory, crew and driving time", () => {
  const base = { crew: 2, cubicFeetPerWorkerHour: 40, minimumHours: 2 };
  // 400 cu ft / (40 × 2) = 5 h, + 50 min driving → 5 h 50 → 6 h.
  assert.equal(jobMinutes({ ...base, volume: 400, driveMinutes: 50 }), 360);
  // Small moves use the minimum billed hours.
  assert.equal(jobMinutes({ ...base, volume: 40, driveMinutes: 10 }), 120);
  // Unknown inventory or pricing falls back to four hours.
  assert.equal(jobMinutes({ ...base, volume: 0, driveMinutes: null }), 240);
  assert.equal(
    jobMinutes({
      ...base,
      volume: 80,
      cubicFeetPerWorkerHour: null,
      driveMinutes: 0,
    }),
    240,
  );
  assert.equal(addMinutes("14:00", 360), "20:00");
  assert.equal(addMinutes("20:00", 600), "23:59");
});
