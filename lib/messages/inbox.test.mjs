import test from "node:test";
import assert from "node:assert/strict";
import { filterInbox, inboxTime } from "./inbox.ts";

const entry = (id, kind, name, unread, reference = "") => ({
  id,
  kind,
  name,
  unread,
  reference,
  description: kind === "move-team" ? "Dana, Eli" : "Support",
  ownerId: null,
  conversationId: id,
  updatedAt: null,
  preview: "Hello",
});
const entries = [
  entry("1", "customer-support", "Jordan Ellis", 2),
  entry("2", "worker-support", "Rosa Diaz", 0),
  entry("3", "move-team", "Team · move #abcd1234", 1, "abcd1234"),
];
test("inbox filters compose with name, participant and move-reference search", () => {
  assert.deepEqual(
    filterInbox(entries, "all", "").map((e) => e.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    filterInbox(entries, "unread", "").map((e) => e.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterInbox(entries, "customers", " JORDAN ").map((e) => e.id),
    ["1"],
  );
  assert.deepEqual(
    filterInbox(entries, "workers", "Rosa").map((e) => e.id),
    ["2"],
  );
  assert.deepEqual(
    filterInbox(entries, "teams", "abcd1234").map((e) => e.id),
    ["3"],
  );
  assert.equal(filterInbox(entries, "teams", "Eli").length, 1);
  assert.equal(filterInbox(entries, "customers", "Rosa").length, 0);
  assert.equal(filterInbox([], "all", "").length, 0);
});
test("inbox dates use Central Time and handle midnight, DST, year boundaries and bad timestamps", () => {
  assert.equal(
    inboxTime("2026-11-25T05:30:00Z", "2026-11-25T05:45:00Z"),
    "11:30 PM",
  );
  assert.equal(
    inboxTime("2026-11-25T05:30:00Z", "2026-11-25T06:01:00Z"),
    "Yesterday",
  );
  assert.equal(
    inboxTime("2026-03-08T06:30:00Z", "2026-03-09T05:15:00Z"),
    "Yesterday",
  );
  assert.equal(
    inboxTime("2026-11-01T05:30:00Z", "2026-11-02T06:15:00Z"),
    "Yesterday",
  );
  assert.equal(
    inboxTime("2025-12-31T23:00:00Z", "2026-01-01T14:00:00Z"),
    "Yesterday",
  );
  assert.equal(
    inboxTime("2025-11-20T18:00:00Z", "2026-11-25T18:00:00Z"),
    "Nov 20, 2025",
  );
  assert.equal(
    inboxTime("2026-11-20T18:00:00Z", "2026-11-25T18:00:00Z"),
    "Nov 20",
  );
  assert.equal(inboxTime("bad", "2026-11-25T18:00:00Z"), "");
});
