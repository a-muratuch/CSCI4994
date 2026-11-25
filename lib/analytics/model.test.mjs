import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsWeeks,
  acceptanceRate,
  barPercent,
  analyticsResult,
} from "./model.ts";
test("analytics period is allowlisted and repeated/invalid values use eight weeks", () => {
  assert.equal(analyticsWeeks("4"), 4);
  assert.equal(analyticsWeeks("12"), 12);
  for (const value of [undefined, "-1", "1000", ["4", "12"], null])
    assert.equal(analyticsWeeks(value), 8);
});
test("rates distinguish no requests from zero acceptance and charts contain their bars", () => {
  assert.equal(acceptanceRate(0, 0), null);
  assert.equal(acceptanceRate(3, 0), 0);
  assert.equal(acceptanceRate(3, 2), 66.7);
  assert.equal(barPercent(0, 0), 0);
  assert.equal(barPercent(3, 2), 100);
  assert.equal(barPercent(-1, 2), 0);
});
test("incompatible analytics do not masquerade as empty results", () => {
  const good = {
    start: "2026-10-01",
    end: "2026-10-25",
    asOf: "2026-10-24T12:00:00Z",
    requests: 0,
    acceptedRequests: 0,
    acceptedCount: 0,
    acceptedCents: 0,
    jobs: 0,
    funnel: [0, 0, 0, 0, 0],
    weekly: Array.from({ length: 4 }, () => ({
      date: "2026-10-19",
      requests: 0,
      jobs: 0,
    })),
    crew: [],
  };
  assert.deepEqual(analyticsResult(good), good);
  for (const bad of [
    {},
    null,
    { ...good, acceptedCents: "0" },
    { ...good, acceptedCents: Number.MAX_SAFE_INTEGER + 1 },
    { ...good, funnel: [0] },
  ])
    assert.equal(analyticsResult(bad), null);
});
