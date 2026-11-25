import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  formatShortDate,
  formatMonthDay,
  formatTimeRange,
  formatTime,
  formatArrival,
  formatMoney,
  formatMessageTime,
} from "./format.ts";
import {
  shortReference,
  moveReference,
  requestReference,
} from "./reference.ts";
import {
  statusDefinitions,
  statusLabel,
  moveStatusKey,
} from "./domain/status.ts";

test("civil dates do not shift with browser timezone and invalid dates stay honest", () => {
  const old = process.env.TZ;
  try {
    for (const zone of [
      "Pacific/Honolulu",
      "Pacific/Kiritimati",
      "America/Chicago",
    ]) {
      process.env.TZ = zone;
      assert.equal(formatDate("2026-11-23"), "November 23, 2026");
      assert.equal(formatShortDate("2026-11-23"), "Mon, Nov 23, 2026");
      assert.equal(formatMonthDay("2026-12-12"), "Dec 12");
    }
    assert.equal(formatMonthDay("2026-13-01"), "Not set");
    assert.equal(formatDate("2026-02-30"), "Not set");
    assert.equal(formatDate(""), "Not set");
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("Central Time ranges distinguish noon, midnight and meridiem changes", () => {
  assert.equal(formatTimeRange("09:00", "10:00"), "9:00–10:00 AM CT");
  assert.equal(formatTimeRange("09:00:00", "13:00:00"), "9:00 AM–1:00 PM CT");
  assert.equal(formatTimeRange("00:00", "12:00"), "12:00 AM–12:00 PM CT");
  assert.equal(formatTimeRange("24:00", "25:00"), "Not set");
  assert.equal(formatArrival("09:00–10:00 CT"), "9:00–10:00 AM CT");
  assert.equal(
    formatMessageTime("2026-11-23T15:00:00Z"),
    "Nov 23, 2026, 9:00 AM CT",
  );
});
test("currency preserves exact cents and references never change the source id", () => {
  assert.equal(formatMoney(52500), "$525.00");
  assert.equal(formatMoney(999999999), "$9,999,999.99");
  const id = "f5216fd5-373e-4c11-a595-504662a34948";
  assert.equal(shortReference(id), "f5216fd5");
  assert.equal(moveReference(id), "f5216fd5");
  assert.equal(moveReference(id, 1042), "RM-1042");
  assert.equal(
    requestReference(id, [{ id, referenceNumber: 1042 }]),
    "RM-1042",
  );
  assert.equal(moveReference(id, 0), "f5216fd5");
  assert.equal(moveReference(id, Number.MAX_SAFE_INTEGER + 1), "f5216fd5");
  assert.equal(id, "f5216fd5-373e-4c11-a595-504662a34948");
});
test("status text and tone come from one map across estimates and moves", () => {
  assert.equal(statusLabel("in-progress"), "In progress");
  assert.equal(statusDefinitions.completed.tone, "success");
  assert.equal(statusDefinitions.declined.tone, "warning");
  assert.equal(
    moveStatusKey({ stage: "requested" }, { status: "accepted" }),
    "awaiting-scheduling",
  );
  assert.equal(
    moveStatusKey({ stage: "requested" }, { status: "declined" }),
    "coordinator-review",
  );
});

test("single clock times show AM or PM in Central Time", () => {
  assert.equal(formatTime("08:00"), "8:00 AM CT");
  assert.equal(formatTime("13:30"), "1:30 PM CT");
  assert.equal(formatTime("bad"), "Not set");
});
