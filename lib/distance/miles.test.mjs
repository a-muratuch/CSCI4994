import test from "node:test";
import assert from "node:assert/strict";
import {
  straightLineMiles,
  estimatedRoadMiles,
  zip5,
  milesBetweenZips,
} from "./miles.ts";

const oxford = [34.362, -89.539];
const memphis = [35.149, -90.049];
const newYork = [40.751, -73.997];
const losAngeles = [34.101, -118.415];

test("haversine distance matches known city distances within a few miles", () => {
  assert.equal(straightLineMiles(oxford, oxford), 0);
  const oxfordMemphis = straightLineMiles(oxford, memphis);
  assert.ok(oxfordMemphis > 55 && oxfordMemphis < 65, String(oxfordMemphis));
  const coastToCoast = straightLineMiles(newYork, losAngeles);
  assert.ok(coastToCoast > 2420 && coastToCoast < 2480, String(coastToCoast));
  // Distance is symmetric.
  assert.equal(
    Math.round(straightLineMiles(memphis, oxford)),
    Math.round(oxfordMemphis),
  );
});

test("road miles apply the road factor and round to whole miles", () => {
  const straight = straightLineMiles(oxford, memphis);
  assert.equal(estimatedRoadMiles(oxford, memphis, 1), Math.round(straight));
  assert.equal(
    estimatedRoadMiles(oxford, memphis, 1.2),
    Math.round(straight * 1.2),
  );
});

test("ZIP parsing accepts ZIP and ZIP+4 only", () => {
  assert.equal(zip5("38677"), "38677");
  assert.equal(zip5(" 38677-1234 "), "38677");
  for (const bad of [
    "3867",
    "386777",
    "abcde",
    "38677-12",
    38677,
    null,
    undefined,
  ])
    assert.equal(zip5(bad), null);
});

test("ZIP lookup handles same, nearby, unknown and invalid ZIPs", () => {
  const table = { 38677: oxford, 38655: [34.33, -89.487], 38103: memphis };
  assert.equal(milesBetweenZips("38677", "38677", table, 1.2), 0);
  // Adjacent ZIPs are never reported as 0 miles.
  assert.ok(milesBetweenZips("38677", "38655", table, 1.2) >= 1);
  assert.ok(milesBetweenZips("38677", "38103-0001", table, 1.2) > 60);
  assert.equal(milesBetweenZips("38677", "99999", table, 1.2), null);
  assert.equal(milesBetweenZips("", "38103", table, 1.2), null);
});
