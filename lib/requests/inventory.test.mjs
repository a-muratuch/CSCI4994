import test from "node:test";
import assert from "node:assert/strict";
import { inventoryTotals, validateInventory } from "./inventory.ts";

const id = "6f1c2a4e-8b3d-4c5e-9f70-1a2b3c4d5e6f";

test("catalog lines send only their ID and quantity", () => {
  const result = validateInventory([
    { catalogId: id, quantity: 2, label: "ignored", cubicFeet: 999 },
  ]);
  assert.deepEqual(result, { payload: [{ catalogId: id, quantity: 2 }] });
});

test("custom lines are trimmed and rounded to one decimal", () => {
  const result = validateInventory([
    {
      catalogId: null,
      label: "  Antique trunk ",
      room: "Other",
      quantity: 1,
      cubicFeet: 12.34,
      weightLb: 80,
    },
  ]);
  assert.deepEqual(result.payload, [
    {
      label: "Antique trunk",
      room: "Other",
      quantity: 1,
      cubicFeet: 12.3,
      weightLb: 80,
    },
  ]);
});

test("an empty inventory is allowed (inventory is optional)", () => {
  assert.deepEqual(validateInventory([]), { payload: [] });
});

test("invalid inventory input is rejected", () => {
  const custom = {
    label: "Box",
    room: "Boxes",
    quantity: 1,
    cubicFeet: 3,
    weightLb: 30,
  };
  for (const bad of [
    null,
    "items",
    {},
    [null],
    [{ catalogId: "not-a-uuid", quantity: 1 }],
    [{ catalogId: id, quantity: 0 }],
    [{ catalogId: id, quantity: 100 }],
    [{ catalogId: id, quantity: 1.5 }],
    [{ ...custom, label: " " }],
    [{ ...custom, label: "x".repeat(101) }],
    [{ ...custom, room: "Attic" }],
    [{ ...custom, cubicFeet: 0.4 }],
    [{ ...custom, cubicFeet: 201 }],
    [{ ...custom, cubicFeet: Number.NaN }],
    [{ ...custom, weightLb: 1001 }],
    [{ ...custom, weightLb: 2.5 }],
    Array.from({ length: 61 }, () => custom),
  ])
    assert.ok("error" in validateInventory(bad), JSON.stringify(bad));
});

test("totals multiply per-item size by quantity", () => {
  assert.deepEqual(inventoryTotals([]), {
    items: 0,
    cubicFeet: 0,
    weightLb: 0,
  });
  assert.deepEqual(
    inventoryTotals([
      {
        catalogId: null,
        label: "A",
        room: "Boxes",
        quantity: 3,
        cubicFeet: 1.5,
        weightLb: 20,
      },
      {
        catalogId: id,
        label: "B",
        room: "Bedroom",
        quantity: 1,
        cubicFeet: 60,
        weightLb: 420,
      },
    ]),
    { items: 4, cubicFeet: 64.5, weightLb: 480 },
  );
});
