import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRequest,
  chicagoToday,
  inventoryItemsText,
} from "./validation.ts";
import { composeAccess, splitAccess } from "./details.ts";
const draft = {
  pickup: "12 Example Lane",
  destination: "25 Example Court",
  requestedDate: "2026-10-13",
  property: "Apartment",
  size: "Studio",
  items: "Boxes",
  access: "Ground floor",
  notes: "",
};
test("valid requests are trimmed and unrelated identity fields are ignored", () => {
  const result = validateRequest(
    {
      ...draft,
      pickup: " 12 Example Lane ",
      customer_id: "other-user",
      id: "chosen-id",
    },
    "2026-10-12",
  );
  assert.equal(result.valid, true);
  assert.equal(result.draft.pickup, "12 Example Lane");
  assert.equal(result.draft.customer_id, undefined);
  assert.equal(result.draft.id, undefined);
});
test("required values, field limits, property values and equal addresses are rejected", () => {
  for (const key of [
    "pickup",
    "destination",
    "property",
    "size",
    "items",
    "access",
  ])
    assert.equal(
      validateRequest({ ...draft, [key]: "" }, "2026-10-12").valid,
      false,
    );
  assert.equal(
    validateRequest({ ...draft, items: "a".repeat(2001) }, "2026-10-12").valid,
    false,
  );
  assert.equal(
    validateRequest({ ...draft, property: "Castle" }, "2026-10-12").valid,
    false,
  );
  assert.equal(
    validateRequest({ ...draft, destination: "12 EXAMPLE LANE" }, "2026-10-12")
      .valid,
    false,
  );
  assert.equal(
    validateRequest({ ...draft, notes: 42 }, "2026-10-12").valid,
    false,
  );
});
test("invalid calendar dates and past dates fail; same-day and leap-day dates pass", () => {
  for (const date of ["2026-02-30", "2026-10-11", "invalid"])
    assert.equal(
      validateRequest({ ...draft, requestedDate: date }, "2026-10-12").valid,
      false,
    );
  assert.equal(
    validateRequest({ ...draft, requestedDate: "2026-10-12" }, "2026-10-12")
      .valid,
    true,
  );
  assert.equal(
    validateRequest({ ...draft, requestedDate: "2028-02-29" }, "2026-10-12")
      .valid,
    true,
  );
});
test("requested date cutoff follows Central Time rather than browser or server timezone", () => {
  assert.equal(chicagoToday(new Date("2026-10-13T02:00:00Z")), "2026-10-12");
  assert.equal(chicagoToday(new Date("2026-10-13T07:00:00Z")), "2026-10-13");
});

test("items may be left empty only when inventory is listed", () => {
  const empty = { ...draft, items: "  " };
  assert.equal(validateRequest(empty, "2026-10-12").valid, false);
  const listed = validateRequest(empty, "2026-10-12", { itemsOptional: true });
  assert.equal(listed.valid, true);
  assert.equal(listed.draft.items, inventoryItemsText);
  assert.equal(
    validateRequest(draft, "2026-10-12", { itemsOptional: true }).draft.items,
    "Boxes",
  );
});

test("pickup and destination access round-trip through one column", () => {
  const saved = composeAccess(" Stairs, 2nd floor ", "Elevator");
  assert.equal(saved, "Pickup: Stairs, 2nd floor\nDestination: Elevator");
  assert.deepEqual(splitAccess(saved), {
    pickup: "Stairs, 2nd floor",
    destination: "Elevator",
  });
  assert.equal(composeAccess(" ", ""), "");
  // Older free text stays intact in the pickup answer.
  assert.deepEqual(splitAccess("Ground floor"), {
    pickup: "Ground floor",
    destination: "",
  });
});
