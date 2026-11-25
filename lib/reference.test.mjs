import test from "node:test";
import assert from "node:assert/strict";
import { moveReference, moveTitle } from "./reference.ts";

const id = "29101402-5740-4148-91e9-07556504e028";

test("moves are named by their route, with the reference as fallback", () => {
  assert.equal(
    moveTitle({
      id,
      pickup: "10 Local Test Lane, Oxford, MS 38655",
      destination: "20 Local Test Road, Tupelo, MS 38801",
    }),
    "Oxford → Tupelo",
  );
  // Saved address fields win over the text.
  assert.equal(
    moveTitle({
      id,
      pickup: "x",
      destination: "y",
      pickupAddress: { city: "Water Valley" },
      destinationAddress: { city: "Memphis" },
    }),
    "Water Valley → Memphis",
  );
  assert.equal(
    moveTitle({ id, pickup: "Old free text", destination: "Elsewhere" }),
    "Move #29101402",
  );
  assert.equal(moveReference(id, 42), "RM-42");
});
