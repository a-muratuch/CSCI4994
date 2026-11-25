import test from "node:test";
import assert from "node:assert/strict";
import { validateContact } from "./validation.ts";
test("contact trims fields and ignores supplied account, role and email", () => {
  const r = validateContact({
    name: " Alex Jordan ",
    phone: " (202) 555-0148 ",
    id: "other",
    role: "admin",
    email: "other@example.com",
  });
  assert.deepEqual(r.input, { name: "Alex Jordan", phone: "(202) 555-0148" });
});
test("missing, malformed and oversized contact values fail", () => {
  for (const value of [
    null,
    {},
    { name: " ", phone: "2025550148" },
    { name: "x".repeat(101), phone: "2025550148" },
    { name: "Alex", phone: "123" },
    { name: "Alex", phone: "call me" },
    { name: "Alex", phone: "1".repeat(16) },
    { name: "Alex", phone: " ".repeat(20) + "2025550148" + ".".repeat(25) },
  ])
    assert.equal(validateContact(value).input, undefined);
});
test("phone supports allowed formatting and boundary lengths", () => {
  for (const phone of ["1234567", "+123456789012345", "(202) 555-0148"])
    assert.ok(validateContact({ name: "Alex", phone }).input);
  assert.ok(validateContact({ name: "x".repeat(100), phone: "1234567" }).input);
});
