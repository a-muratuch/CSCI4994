import test from "node:test";
import assert from "node:assert/strict";
import { addressErrors, addressText } from "./address.ts";
test("structured addresses require fields, state and ZIP and preserve complete route text", () => {
  const a = { street: " 10 Lane ", city: "Oxford", state: "ms", zip: "38655" };
  assert.deepEqual(addressErrors(a), {});
  assert.equal(addressText(a), "10 Lane, Oxford, MS 38655");
  assert.equal(
    Object.keys(
      addressErrors({ street: "", city: "", state: "Mississippi", zip: "bad" }),
    ).length,
    4,
  );
  assert.deepEqual(addressErrors({ ...a, zip: "38655-1234" }), {});
});
