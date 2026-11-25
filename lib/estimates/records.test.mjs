import test from "node:test";
import assert from "node:assert/strict";
import { estimateRecord } from "./records.ts";
const row = {
  id: "10000000-0000-4000-8000-000000000001",
  request_id: "10000000-0000-4000-8000-000000000002",
  revision: 1,
  status: "awaiting",
  total_cents: 52500,
  estimate_items: [
    { label: "Transportation", amount_cents: 12500, position: 2 },
    { label: "Labor", amount_cents: 40000, position: 1 },
  ],
  inclusions: ["One truck"],
  exclusions: [],
  terms: "Test terms",
};
test("published records preserve scope and sort pricing by stored position", () => {
  const parsed = estimateRecord(row);
  assert.equal(parsed.lines[0].label, "Labor");
  assert.deepEqual(parsed.inclusions, row.inclusions);
});
test("malformed records are rejected without returning incorrect totals", () => {
  for (const change of [
    { total_cents: 1 },
    { status: "unknown" },
    { id: "wrong" },
    { estimate_items: [{ label: "Invalid", amount_cents: -1, position: 1 }] },
    { inclusions: [42] },
  ])
    assert.equal(estimateRecord({ ...row, ...change }), null);
  assert.equal(estimateRecord(null), null);
});
