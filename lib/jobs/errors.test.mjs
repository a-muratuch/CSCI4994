import test from "node:test";
import assert from "node:assert/strict";
import { scheduleError } from "./errors.ts";

test("schedule errors distinguish conflicts, permission failures and invalid input", () => {
  assert.match(scheduleError("40001"), /changed/);
  assert.match(scheduleError("42501"), /administrator/);
  assert.match(scheduleError("23505"), /already has a job/);
  assert.match(scheduleError("22023"), /must not overlap/);
});

test("unknown database errors use safe recovery guidance", () => {
  assert.equal(scheduleError("unexpected"), scheduleError());
  assert.match(scheduleError(), /before retrying/);
});
