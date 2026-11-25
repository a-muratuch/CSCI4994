import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEstimate,
  validateEstimateDefaults,
  uuid,
} from "./validation.ts";
const value = {
  lines: [
    { label: "Labor", amountCents: 48000 },
    { label: "Transportation", amountCents: 17000 },
  ],
  inclusions: ["Labor"],
  exclusions: ["Packing"],
  terms: "Acceptance does not confirm a date.",
};
test("valid draft trims known fields and ignores privileged extra fields", () => {
  const result = validateEstimate({
    ...value,
    terms: " Terms ",
    created_by: "other",
    status: "accepted",
  });
  assert.equal(result.input.terms, "Terms");
  assert.equal(result.input.status, undefined);
  assert.equal(result.input.created_by, undefined);
});
test("malformed and oversized scope cannot reach database save", () => {
  for (const v of [
    null,
    {},
    { ...value, lines: "prices" },
    { ...value, inclusions: [12] },
    { ...value, exclusions: [] },
    { ...value, terms: "a".repeat(2001) },
    { ...value, inclusions: ["a".repeat(501)] },
    { ...value, lines: Array(21).fill(value.lines[0]) },
  ])
    assert.ok(validateEstimate(v).error);
});
test("integer prices and total limits are checked without rounding", () => {
  for (const n of [-1, 1.5, "48000", 1000000000])
    assert.ok(
      validateEstimate({
        ...value,
        lines: [{ label: "Labor", amountCents: n }],
      }).error,
    );
  assert.ok(
    validateEstimate({ ...value, lines: [{ label: "Labor", amountCents: 0 }] })
      .error,
  );
  assert.ok(
    validateEstimate({
      ...value,
      lines: [
        { label: "Labor", amountCents: 999999999 },
        { label: "Truck", amountCents: 1 },
      ],
    }).error,
  );
  assert.ok(
    validateEstimate({
      ...value,
      lines: [{ label: "Labor", amountCents: 999999999 }],
    }).input,
  );
});
test("database identifiers require UUIDs", () => {
  assert.equal(uuid("00000000-0000-0000-0000-000000000001"), true);
  for (const id of [null, "EST-1024", "../admin", "", 42])
    assert.equal(uuid(id), false);
});
test("field errors identify individual invalid lines and scope fields", async () => {
  const { estimateFieldErrors } = await import("./validation.ts");
  const errors = estimateFieldErrors({
    ...value,
    lines: [{ label: "", amountCents: -1 }],
    terms: "",
    exclusions: [],
  });
  assert.ok(errors["line-label-0"]);
  assert.ok(errors["line-price-0"]);
  assert.ok(errors.terms);
  assert.ok(errors.exclusions);
  assert.deepEqual(estimateFieldErrors(value), {});
});

test("standard estimate text uses the estimate limits", () => {
  const saved = validateEstimateDefaults({
    inclusions: " Loading \n\nTruck ",
    exclusions: "Storage",
    terms: " Terms ",
  });
  assert.deepEqual(saved, {
    input: {
      inclusions: ["Loading", "Truck"],
      exclusions: ["Storage"],
      terms: "Terms",
    },
  });
  const refused = validateEstimateDefaults({
    inclusions: "",
    exclusions: Array.from({ length: 21 }, (_, n) => `Item ${n}`).join("\n"),
    terms: "x".repeat(2001),
  });
  assert.deepEqual(Object.keys(refused.errors).sort(), [
    "exclusions",
    "inclusions",
    "terms",
  ]);
  assert.ok("errors" in validateEstimateDefaults(null));
});
