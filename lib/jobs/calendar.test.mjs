import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarWeek,
  calendarLanes,
  resourceJobs,
  calendarHref,
  tripDays,
} from "./calendar.ts";

test("calendar weeks use Monday–Sunday civil dates through leap days, year changes and DST", () => {
  for (const [selected, start, end] of [
    ["2026-10-25", "2026-10-19", "2026-10-25"],
    ["2026-10-26", "2026-10-26", "2026-11-01"],
    ["2026-01-01", "2025-12-29", "2026-01-04"],
    ["2024-02-29", "2024-02-26", "2024-03-03"],
    ["2026-03-08", "2026-03-02", "2026-03-08"],
  ]) {
    const week = calendarWeek(selected, "2026-10-21");
    assert.equal(week.start, start);
    assert.equal(week.end, end);
    assert.equal(new Set(week.dates).size, 7);
    assert.equal(week.invalid, false);
  }
});
test("invalid or repeated date parameters fall back; calendar navigation stays within supported years", () => {
  for (const value of [
    "2026-02-30",
    "bad",
    ["2026-10-21"],
    "1999-12-31",
    "2100-01-01",
  ]) {
    const week = calendarWeek(value, "2026-10-21");
    assert.equal(week.start, "2026-10-19");
    assert.equal(week.invalid, true);
  }
  assert.equal(calendarWeek(undefined, "2026-10-21").invalid, false);
  assert.equal(calendarWeek("2000-01-03", "2026-10-21").previous, null);
  assert.equal(calendarWeek("2099-12-27", "2026-10-21").next, null);
  assert.equal(
    calendarHref("2026-10-19", "trucks"),
    "/admin/jobs/calendar?week=2026-10-19&view=trucks",
  );
});
const base = {
  date: "2026-10-21",
  start: "09:00",
  end: "12:00",
  arrivalStart: "09:00",
  arrivalEnd: "10:00",
  status: "scheduled",
  customer: "Test customer",
  truckId: "truck",
  truck: "Test truck",
  workers: [
    { id: "a", name: "Alex" },
    { id: "b", name: "Blair" },
  ],
};
test("a team job appears for each assigned worker and once for its truck without losing inactive history", () => {
  const jobs = [
    { ...base, id: "first" },
    { ...base, id: "later", start: "13:00", end: "15:00" },
  ];
  const resources = [
    { id: "a", name: "Alex", active: true },
    { id: "b", name: "Blair", active: false },
    { id: "c", name: "Inactive without work", active: false },
  ];
  const lanes = calendarLanes(jobs, resources, "workers");
  assert.deepEqual(
    lanes.map((l) => l.id),
    ["a", "b"],
  );
  assert.deepEqual(
    lanes[1].jobs.map((j) => j.id),
    ["first", "later"],
  );
  assert.equal(calendarLanes(jobs, [], "trucks")[0].jobs.length, 2);
  assert.equal(resourceJobs(jobs, "workers", "other").length, 0);
  assert.equal(jobs[0].id, "first");
});
test("empty active lanes and unexpected unassigned jobs remain visible", () => {
  assert.equal(
    calendarLanes([], [{ id: "a", name: "Alex", active: true }], "workers")[0]
      .jobs.length,
    0,
  );
  const jobs = [{ ...base, id: "unassigned", workers: [] }];
  assert.equal(calendarLanes(jobs, [], "workers")[0].id, "unassigned");
  assert.equal(resourceJobs(jobs, "workers", "unassigned").length, 1);
});

test("long-distance trips appear on each day of the shown week", () => {
  const trip = {
    date: "2027-01-08",
    endDate: "2027-01-10",
    returnDate: "2027-01-12",
  };
  const days = tripDays(trip, "2027-01-04", "2027-01-10");
  assert.deepEqual(
    days.map((d) => [d.date, d.trip.day, d.trip.phase]),
    [
      ["2027-01-08", 1, "Loading and driving"],
      ["2027-01-09", 2, "Driving"],
      ["2027-01-10", 3, "Delivering, then starting back"],
    ],
  );
  assert.equal(days[0].trip.days, 5);
  assert.deepEqual(
    tripDays(trip, "2027-01-11", "2027-01-17").map((d) => d.trip.phase),
    ["Driving back", "Driving back"],
  );
  assert.equal(
    tripDays(
      { date: "2027-01-08", endDate: "2027-01-08", returnDate: "2027-01-09" },
      "2027-01-08",
      "2027-01-08",
    )[0].trip.phase,
    "Loading, delivering, then driving back",
  );
});
