import test from "node:test";
import assert from "node:assert/strict";
import { checkSelection, listText, suggestTeam } from "./suggest.ts";

const worker = (id, over = {}) => ({
  id,
  name: id.toUpperCase(),
  available: true,
  availableStart: "07:00",
  availableEnd: "19:00",
  weekMinutes: 0,
  fourWeekMinutes: 0,
  ...over,
});
const memphisJob = {
  id: "a",
  start: "08:00",
  end: "12:00",
  workerIds: ["busy"],
  truckId: "small",
  pickupPlace: "Oxford 38655",
  destinationPlace: "Memphis 38103",
  travelToThis: 170,
  travelFromThis: 170,
};
const options = (over = {}) => ({
  pickupPlace: "Oxford 38655",
  destinationPlace: "Water Valley 38965",
  volume: 300,
  crewTarget: 2,
  jobs: [memphisJob],
  workers: [
    worker("busy"),
    worker("heavy", { weekMinutes: 600 }),
    worker("light", { weekMinutes: 60 }),
    worker("off", {
      available: false,
      availableStart: null,
      availableEnd: null,
    }),
    worker("late", { availableStart: "14:00" }),
  ],
  trucks: [
    { id: "small", name: "Small", capacity: 400 },
    { id: "tiny", name: "Tiny", capacity: 200 },
    { id: "large", name: "Large", capacity: 1200 },
    { id: "unsized", name: "Unsized", capacity: null },
  ],
  ...over,
});

test("a crew that cannot reach the pickup in time is excluded with the reason", () => {
  const result = suggestTeam(options(), "13:00", "16:00");
  assert.deepEqual(
    result.crew.map((c) => c.id),
    ["light", "heavy"],
  );
  const busy = result.excludedWorkers.find((w) => w.id === "busy");
  assert.match(
    busy.reason,
    /Can't reach in time.*Memphis 38103.*Earliest feasible start: 14:50/,
  );
  assert.match(
    result.excludedWorkers.find((w) => w.id === "off").reason,
    /Not available/,
  );
  assert.match(
    result.excludedWorkers.find((w) => w.id === "late").reason,
    /only 14:00–19:00/,
  );
  assert.equal(result.shortBy, 0);
});

test("trucks: too small, unreachable and best fit", () => {
  const result = suggestTeam(options(), "13:00", "16:00");
  // "small" is stuck in Memphis; "tiny" is too small; best fit is "large", unsized last.
  assert.equal(result.truck.id, "large");
  assert.deepEqual(
    result.eligibleTrucks.map((t) => t.id),
    ["large", "unsized"],
  );
  assert.match(
    result.excludedTrucks.find((t) => t.id === "tiny").reason,
    /Holds 200/,
  );
  assert.match(
    result.excludedTrucks.find((t) => t.id === "small").reason,
    /Can't reach/,
  );
});

test("with enough time the earlier crew becomes eligible and ranks by fairness", () => {
  const result = suggestTeam(options(), "15:00", "17:00");
  assert.ok(result.eligibleWorkers.some((w) => w.id === "busy"));
  assert.ok(result.eligibleWorkers.find((w) => w.id === "late"));
  // All have 0 week minutes except heavy/light; ties break by empty driving, then name.
  assert.deepEqual(
    result.eligibleWorkers.map((w) => w.id),
    ["late", "busy", "light", "heavy"],
  );
  assert.equal(result.truck.id, "small");
});

test("too few eligible workers reports the shortfall", () => {
  const result = suggestTeam(options({ crewTarget: 4 }), "13:00", "16:00");
  assert.equal(result.crew.length, 2);
  assert.equal(result.shortBy, 2);
});

test("checkSelection blocks hand-picked infeasible crews and trucks", () => {
  const blocked = checkSelection(
    options(),
    "13:00",
    "16:00",
    ["busy", "light"],
    "small",
  );
  assert.equal(blocked.blocking.length, 2);
  assert.match(blocked.blocking[0], /^BUSY: Can't reach in time/);
  assert.match(blocked.blocking[1], /^Small: Can't reach in time/);
  assert.equal(blocked.earliestStart, "14:50");
  const fine = checkSelection(options(), "15:00", "17:00", ["busy"], "small");
  assert.deepEqual(fine, { blocking: [], unknown: [], earliestStart: null });
});

test("unknown distances need confirmation but do not block", () => {
  const unknownJob = { ...memphisJob, travelToThis: null };
  const result = checkSelection(
    options({ jobs: [unknownJob] }),
    "13:00",
    "16:00",
    ["busy"],
    "large",
  );
  assert.deepEqual(result.blocking, []);
  assert.equal(result.unknown.length, 1);
  assert.match(result.unknown[0], /BUSY: travel time .* unknown/);
});

test("long-distance trips leave out crews and trucks that are away or off", () => {
  const trip = options({
    jobs: [],
    away: [
      {
        id: "far",
        from: "2027-01-06",
        until: "2027-01-09",
        workerIds: ["light"],
        truckId: "small",
      },
    ],
    workers: [
      worker("light", { weekMinutes: 0 }),
      worker("heavy", { weekMinutes: 600 }),
      worker("tired", { availableEveryDay: false }),
      worker("short", { availableEnd: "12:00" }),
    ],
    trucks: [
      { id: "small", name: "Small", capacity: 400 },
      { id: "big", name: "Big", capacity: 800 },
    ],
  });
  const team = suggestTeam(trip, "08:00", "06:00", true);
  const reasons = Object.fromEntries(
    [...team.excludedWorkers, ...team.excludedTrucks].map((x) => [
      x.id,
      x.reason,
    ]),
  );
  assert.equal(reasons.light, "Away on another move until 2027-01-09.");
  assert.equal(reasons.small, "Away on another move until 2027-01-09.");
  assert.equal(reasons.tired, "Not available on every day of the trip.");
  // The workday end does not matter on a multi-day trip.
  assert.deepEqual(
    team.crew.map((w) => w.id),
    ["short", "heavy"],
  );
  assert.equal(team.truck.id, "big");
  // Hand-picked away resources are blocked before saving.
  assert.match(
    checkSelection(
      trip,
      "08:00",
      "06:00",
      ["light"],
      "big",
      true,
    ).blocking.join(" "),
    /LIGHT: away on another move until 2027-01-09/,
  );
});

test("the reason names the trip days a worker is not available", () => {
  const trip = options({
    jobs: [],
    away: [],
    workers: [
      worker("casey", {
        missingDays: ["Sat, Jan 9, 2027", "Sun, Jan 10, 2027"],
      }),
    ],
  });
  const [excluded] = suggestTeam(trip, "08:00", "16:00", true).excludedWorkers;
  assert.equal(
    excluded.reason,
    "Not available on Sat, Jan 9, 2027 and Sun, Jan 10, 2027 (during the trip).",
  );
  assert.equal(listText(["A"]), "A");
  assert.equal(listText(["A", "B", "C"]), "A, B and C");
});
