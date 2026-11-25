import test from "node:test";
import assert from "node:assert/strict";
import {
  dollarsToCents,
  validateCapacity,
  validateCatalogItem,
  validatePricing,
} from "./validation.ts";

test("dollar amounts convert to integer cents", () => {
  assert.equal(dollarsToCents("45"), 4500);
  assert.equal(dollarsToCents(" 45.5 "), 4550);
  assert.equal(dollarsToCents("0.07"), 7);
  for (const bad of ["", "-1", "1.234", "abc", "1e3", 45, null])
    assert.equal(dollarsToCents(bad), null);
});

test("catalog items are trimmed, rounded and range-checked", () => {
  const good = {
    name: " Piano ",
    room: "Other",
    cubicFeet: "70.04",
    weightLb: "600",
    active: true,
  };
  assert.deepEqual(validateCatalogItem(good), {
    name: "Piano",
    room: "Other",
    cubicFeet: 70,
    weightLb: 600,
    active: true,
  });
  for (const change of [
    { name: "" },
    { name: "x".repeat(101) },
    { room: "Attic" },
    { cubicFeet: "0" },
    { cubicFeet: "501" },
    { weightLb: "1.5" },
    { weightLb: "3001" },
    { active: "yes" },
  ])
    assert.equal(validateCatalogItem({ ...good, ...change }), null);
});

test("pricing accepts dollars and rounds to database precision", () => {
  const good = {
    workerHourly: "45",
    truckFee: "125.00",
    perMile: "2",
    cubicFeetPerWorkerHour: "40",
    minimumHours: "2.04",
    travelMph: "35",
    roadFactor: "1.234",
  };
  assert.deepEqual(validatePricing(good), {
    workerHourlyCents: 4500,
    truckFeeCents: 12500,
    perMileCents: 200,
    cubicFeetPerWorkerHour: 40,
    minimumHours: 2,
    travelMph: 35,
    roadFactor: 1.23,
    turnaroundMinutes: null,
  });
  assert.equal(
    validatePricing({ ...good, turnaroundMinutes: "45" }).turnaroundMinutes,
    45,
  );
  for (const change of [
    { workerHourly: "0.50" },
    { truckFee: "x" },
    { perMile: "100.01" },
    { cubicFeetPerWorkerHour: "4" },
    { minimumHours: "13" },
    { travelMph: "35.5" },
    { roadFactor: "0.9" },
    { roadFactor: "2.1" },
    { turnaroundMinutes: "181" },
    { turnaroundMinutes: "12.5" },
    { turnaroundMinutes: "" },
  ])
    assert.equal(validatePricing({ ...good, ...change }), null);
  assert.equal(validatePricing(null), null);
});

test("truck capacity may be cleared or set in range", () => {
  assert.equal(validateCapacity(""), null);
  assert.equal(validateCapacity(" 800 "), 800);
  for (const bad of ["49", "5001", "80.5", "big", 800])
    assert.equal(validateCapacity(bad), undefined);
});
