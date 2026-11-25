import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseTruck,
  crewSize,
  roundUpToHalfHour,
  suggestEstimate,
} from "./suggestion.ts";

const settings = {
  workerHourlyCents: 4500,
  truckFeeCents: 12500,
  cubicFeetPerWorkerHour: 40,
  minimumHours: 2,
  perMileCents: 200,
  travelMph: 35,
  roadFactor: 1.2,
};
const trucks = [
  { id: "large", name: "Large", capacityCubicFeet: 1200, active: true },
  { id: "small", name: "Small", capacityCubicFeet: 400, active: true },
  { id: "medium", name: "Medium", capacityCubicFeet: 800, active: true },
  { id: "retired", name: "Retired", capacityCubicFeet: 600, active: false },
  { id: "unsized", name: "Unsized", capacityCubicFeet: null, active: true },
];
const line = (cubicFeet, quantity = 1, weightLb = 0) => ({
  catalogId: null,
  label: "Item",
  room: "Other",
  quantity,
  cubicFeet,
  weightLb,
});

test("crew size steps up with volume", () => {
  assert.deepEqual(
    [1, 400, 401, 900, 901, 1500, 1501, 5000].map(crewSize),
    [2, 2, 3, 3, 4, 4, 5, 5],
  );
});

test("hours round up to the next half hour without float drift", () => {
  assert.equal(roundUpToHalfHour(2), 2);
  assert.equal(roundUpToHalfHour(2.01), 2.5);
  assert.equal(roundUpToHalfHour(2.5), 2.5);
  assert.equal(roundUpToHalfHour(0.1 + 0.2 + 2.2), 2.5);
});

test("truck choice is the smallest active fit, else the largest with trips", () => {
  assert.equal(chooseTruck(300, trucks).id, "small");
  assert.equal(chooseTruck(400, trucks).id, "small");
  // The inactive 600 cu ft truck is skipped.
  assert.equal(chooseTruck(500, trucks).id, "medium");
  const tooBig = chooseTruck(2500, trucks);
  assert.equal(tooBig.id, "large");
  assert.equal(tooBig.trips, 3);
  assert.equal(chooseTruck(100, [trucks[4]]), null);
  assert.equal(chooseTruck(100, []), null);
});

test("empty inventory has no suggestion", () => {
  assert.equal(
    suggestEstimate({ lines: [], settings, trucks, miles: 10 }),
    null,
  );
});

test("a small local move uses minimum hours, the small truck and mileage", () => {
  // 120 cu ft, 2 movers at 40 cu ft/h each = 1.5 h; 10 mi at 35 mph ≈ 0.29 h.
  const s = suggestEstimate({
    lines: [line(30, 4, 50)],
    settings,
    trucks,
    miles: 10,
  });
  assert.equal(s.crew, 2);
  assert.equal(s.truck.id, "small");
  assert.equal(s.drivenMiles, 10);
  assert.equal(s.billedHours, 2);
  assert.deepEqual(
    s.lines.map((l) => l.amountCents),
    [2 * 2 * 4500, 12500, 10 * 200],
  );
  assert.equal(s.totalCents, 18000 + 12500 + 2000);
  assert.equal(s.totals.weightLb, 200);
  assert.match(s.reasons.at(-1), /\(minimum\)/);
});

test("a large move adds travel time, crew and extra truck trips", () => {
  // 2000 cu ft → crew 5, largest truck 1200 → 2 trips, 3 legs of 30 mi = 90 mi.
  const s = suggestEstimate({
    lines: [line(50, 40)],
    settings,
    trucks,
    miles: 30,
  });
  assert.equal(s.crew, 5);
  assert.deepEqual(s.truck, { id: "large", name: "Large", trips: 2 });
  assert.equal(s.drivenMiles, 90);
  // 2000 / (40 × 5) = 10 h, plus 90 / 35 ≈ 2.57 h → 12.57 → 13 h.
  assert.equal(s.billedHours, 13);
  assert.equal(s.lines[0].amountCents, 5 * 13 * 4500);
  assert.equal(s.lines[1].amountCents, 2 * 12500);
  assert.match(s.lines[1].label, /2 trips/);
  assert.equal(s.lines[2].amountCents, 90 * 200);
});

test("unknown distance and unsized trucks still suggest labor with notes", () => {
  const s = suggestEstimate({
    lines: [line(100)],
    settings,
    trucks: [trucks[4]],
    miles: null,
  });
  assert.equal(s.truck, null);
  assert.equal(s.miles, null);
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[1].label, "Truck fee");
  assert.ok(s.reasons.some((r) => r.includes("Distance unknown")));
  assert.ok(s.reasons.some((r) => r.includes("capacity")));
});

test("zero-price settings drop empty lines", () => {
  const s = suggestEstimate({
    lines: [line(100)],
    settings: { ...settings, truckFeeCents: 0, perMileCents: 0 },
    trucks,
    miles: 25,
  });
  assert.equal(s.lines.length, 1);
  assert.equal(s.totalCents, s.lines[0].amountCents);
});

test("long-distance suggestions mention driving days but do not charge the return", () => {
  const far = suggestEstimate({
    lines: [
      {
        catalogId: null,
        label: "Crate",
        room: "Other",
        quantity: 1,
        cubicFeet: 80,
        weightLb: 100,
      },
    ],
    settings: {
      workerHourlyCents: 4500,
      truckFeeCents: 12500,
      cubicFeetPerWorkerHour: 40,
      minimumHours: 2,
      perMileCents: 200,
      travelMph: 35,
      roadFactor: 1.2,
      turnaroundMinutes: 30,
    },
    trucks: [{ id: "t", name: "Truck", capacityCubicFeet: 800, active: true }],
    miles: 900,
  });
  assert.ok(far.reasons.some((r) => /about 3 driving days each way/.test(r)));
  // Mileage is one way only (900 mi at $2).
  assert.equal(
    far.lines.find((l) => l.label.startsWith("Mileage")).amountCents,
    180000,
  );
});
