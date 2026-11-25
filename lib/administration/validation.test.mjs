import test from "node:test";
import assert from "node:assert/strict";
import { workerInvitation } from "./validation.ts";
test("worker invitation normalizes input and ignores attempted role/activation overrides", () => {
  assert.deepEqual(
    workerInvitation({
      name: " Test Worker ",
      email: " WORKER@EXAMPLE.INVALID ",
      role: "admin",
      active: false,
    }),
    { name: "Test Worker", email: "worker@example.invalid" },
  );
  for (const v of [
    null,
    {},
    { name: "", email: "a@b.com" },
    { name: "Name", email: "bad" },
    { name: "a".repeat(101), email: "a@b.com" },
  ])
    assert.equal(workerInvitation(v), null);
});
