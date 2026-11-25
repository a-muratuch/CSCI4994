import test from "node:test";
import assert from "node:assert/strict";
import { declineReasonLabel, validateDecline } from "./decline.ts";

test("decline reasons and notes are checked like the database", () => {
  assert.deepEqual(validateDecline("price", "  Two movers please "), {
    reason: "price",
    note: "Two movers please",
  });
  assert.deepEqual(validateDecline("not-moving", "   "), {
    reason: "not-moving",
    note: null,
  });
  assert.ok("error" in validateDecline("cheaper", null));
  assert.ok("error" in validateDecline(undefined, "note"));
  assert.ok("error" in validateDecline("other", " "));
  assert.ok("error" in validateDecline("date", "x".repeat(501)));
  assert.equal(declineReasonLabel("scope"), "Items or services need changes");
  assert.equal(declineReasonLabel(null), null);
});
