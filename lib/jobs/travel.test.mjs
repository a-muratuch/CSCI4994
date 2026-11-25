import test from "node:test";
import assert from "node:assert/strict";
import {
  checkResource,
  durationText,
  fromMinutes,
  issueText,
  tightTravel,
  toMinutes,
  travelMinutes,
} from "./travel.ts";

const settings = { travelMph: 35, turnaroundMinutes: 30 };
const job = (over) => ({
  id: "a",
  start: "08:00",
  end: "12:00",
  workerIds: ["w1"],
  truckId: "t1",
  pickupPlace: "Oxford 38655",
  destinationPlace: "Memphis 38103",
  travelToThis: null,
  travelFromThis: null,
  ...over,
});
const thisJob = {
  pickupPlace: "Oxford 38655",
  destinationPlace: "Water Valley 38965",
};

test("clock helpers convert and format", () => {
  assert.equal(toMinutes("13:05"), 785);
  assert.equal(toMinutes("13:05:00"), 785);
  assert.equal(fromMinutes(890), "14:50");
  assert.equal(fromMinutes(-5), "00:00");
  assert.equal(fromMinutes(2000), "23:59");
  assert.equal(durationText(170), "2 h 50 min");
  assert.equal(durationText(60), "1 h");
  assert.equal(durationText(45), "45 min");
});

test("travel time is driving plus turnaround, rounded up to 5 minutes", () => {
  // 79 mi at 35 mph = 135.4 min + 30 = 165.4 → 170.
  assert.equal(travelMinutes(79, settings), 170);
  assert.equal(travelMinutes(0, settings), 30);
  assert.equal(travelMinutes(35, settings), 90);
  assert.equal(travelMinutes(null, settings), null);
  assert.equal(travelMinutes(-1, settings), null);
});

test("Memphis → Oxford one hour later is refused with the earliest start", () => {
  const check = checkResource([job({ travelToThis: 170 })], "13:00", "16:00");
  assert.equal(check.ok, false);
  assert.equal(check.issues[0].kind, "before");
  assert.equal(check.issues[0].needed, 170);
  assert.equal(check.issues[0].available, 60);
  assert.equal(check.earliestStart, "14:50");
  assert.match(
    issueText(check.issues[0], thisJob),
    /needs about 2 h 50 min from Memphis 38103 \(job ends 12:00\) to Oxford 38655, only 1 h/,
  );
});

test("the same pair is fine when the gap is long enough", () => {
  const check = checkResource([job({ travelToThis: 170 })], "14:50", "17:00");
  assert.equal(check.ok, true);
  assert.equal(check.deadheadMinutes, 170);
  assert.equal(check.earliestStart, null);
});

test("the job after must still be reachable from this job's destination", () => {
  const later = job({
    id: "b",
    start: "15:00",
    end: "18:00",
    travelFromThis: 90,
  });
  const check = checkResource([later], "10:00", "14:00");
  assert.equal(check.ok, false);
  assert.equal(check.issues[0].kind, "after");
  assert.equal(check.issues[0].available, 60);
  assert.match(issueText(check.issues[0], thisJob), /next job/);
});

test("only the nearest earlier and later jobs matter", () => {
  const early = job({
    id: "early",
    start: "06:00",
    end: "07:00",
    travelToThis: 600,
  });
  const near = job({
    id: "near",
    start: "08:00",
    end: "11:00",
    travelToThis: 60,
  });
  const check = checkResource([early, near], "12:30", "15:00");
  assert.equal(check.ok, true);
  assert.equal(check.deadheadMinutes, 60);
});

test("overlaps and unknown distances are reported separately", () => {
  const overlap = checkResource([job({ travelToThis: 30 })], "11:00", "13:00");
  assert.equal(overlap.issues[0].kind, "overlap");
  const unknown = checkResource([job()], "15:00", "17:00");
  assert.equal(unknown.ok, true);
  assert.equal(unknown.unknown.length, 1);
  const none = checkResource([], "09:00", "10:00");
  assert.deepEqual(
    [none.ok, none.unknown.length, none.deadheadMinutes],
    [true, 0, 0],
  );
});

test("tight pairs are flagged per worker and per truck in saved schedules", () => {
  const saved = (over) => ({
    id: "x",
    start: "08:00",
    end: "12:00",
    workerIds: [],
    truckId: "t1",
    pickupZip: "38655",
    destinationZip: "38103",
    pickupPlace: "Oxford 38655",
    destinationPlace: "Memphis 38103",
    ...over,
  });
  const minutes = (from, to) =>
    from === "38103" && to === "38655" ? 170 : from && to ? 30 : null;
  const flags = tightTravel(
    [
      saved({ id: "a", workerIds: ["w1"], truckId: "t1" }),
      saved({
        id: "b",
        start: "13:00",
        end: "16:00",
        workerIds: ["w1"],
        truckId: "t2",
      }),
      saved({
        id: "c",
        start: "09:00",
        end: "10:00",
        workerIds: ["w2"],
        truckId: "t3",
        destinationZip: null,
      }),
      saved({
        id: "d",
        start: "10:30",
        end: "11:00",
        workerIds: ["w2"],
        truckId: "t4",
      }),
    ],
    minutes,
  );
  assert.deepEqual([...flags.keys()], ["b"]);
  assert.match(flags.get("b"), /needs about 2 h 50 min from Memphis 38103/);
});
