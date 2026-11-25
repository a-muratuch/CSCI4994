/** Customer move inventory: shared types and validation (browser and server). */
import { isUuid } from "../ids.ts";

export const inventoryRooms = [
  "Living room",
  "Bedroom",
  "Kitchen & dining",
  "Office",
  "Garage & outdoor",
  "Boxes",
  "Other",
] as const;
export type InventoryRoom = (typeof inventoryRooms)[number];

export type CatalogItem = {
  id: string;
  name: string;
  room: InventoryRoom;
  cubicFeet: number;
  weightLb: number;
  active: boolean;
};

/** A saved or draft inventory line. Sizes are per single item. */
export type InventoryLine = {
  catalogId: string | null;
  label: string;
  room: InventoryRoom;
  quantity: number;
  cubicFeet: number;
  weightLb: number;
};

/** What the server sends to `set_request_items`: catalog items send only their ID. */
export type InventoryPayload =
  | { catalogId: string; quantity: number }
  | {
      label: string;
      room: InventoryRoom;
      quantity: number;
      cubicFeet: number;
      weightLb: number;
    };

export const inventoryLimits = {
  lines: 60,
  quantity: 99,
  customCubicFeet: 200,
  customWeightLb: 1000,
  label: 100,
};

const isRoom = (value: unknown): value is InventoryRoom =>
  inventoryRooms.includes(value as InventoryRoom);
const wholeNumberBetween = (value: unknown, min: number, max: number) =>
  Number.isSafeInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max;

/**
 * Checks untrusted inventory input. Returns the payload for the database or an
 * error message. The database repeats these checks and copies catalog sizes.
 */
export function validateInventory(
  value: unknown,
): { payload: InventoryPayload[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Reopen the inventory list." };
  if (value.length > inventoryLimits.lines)
    return { error: `Use up to ${inventoryLimits.lines} inventory lines.` };
  const payload: InventoryPayload[] = [];
  for (const line of value) {
    if (!line || typeof line !== "object")
      return { error: "Reopen the inventory list." };
    const quantity = Reflect.get(line, "quantity");
    if (!wholeNumberBetween(quantity, 1, inventoryLimits.quantity))
      return {
        error: `Quantities must be whole numbers from 1 to ${inventoryLimits.quantity}.`,
      };
    const catalogId = Reflect.get(line, "catalogId");
    if (typeof catalogId === "string") {
      if (!isUuid(catalogId)) return { error: "Reopen the inventory list." };
      payload.push({ catalogId, quantity: quantity as number });
      continue;
    }
    const label = Reflect.get(line, "label"),
      room = Reflect.get(line, "room"),
      cubicFeet = Reflect.get(line, "cubicFeet"),
      weightLb = Reflect.get(line, "weightLb");
    if (
      typeof label !== "string" ||
      !label.trim() ||
      label.trim().length > inventoryLimits.label ||
      !isRoom(room) ||
      typeof cubicFeet !== "number" ||
      !Number.isFinite(cubicFeet) ||
      cubicFeet < 0.5 ||
      cubicFeet > inventoryLimits.customCubicFeet ||
      !wholeNumberBetween(weightLb, 0, inventoryLimits.customWeightLb)
    )
      return {
        error: `Custom items need a name, room, size from 0.5 to ${inventoryLimits.customCubicFeet} cu ft and weight up to ${inventoryLimits.customWeightLb} lb.`,
      };
    payload.push({
      label: label.trim(),
      room,
      quantity: quantity as number,
      cubicFeet: Math.round(cubicFeet * 10) / 10,
      weightLb: weightLb as number,
    });
  }
  return { payload };
}

/** Totals across all lines (quantity × per-item size). */
export function inventoryTotals(lines: readonly InventoryLine[]) {
  let items = 0,
    cubicFeet = 0,
    weightLb = 0;
  for (const line of lines) {
    items += line.quantity;
    cubicFeet += line.quantity * line.cubicFeet;
    weightLb += line.quantity * line.weightLb;
  }
  return { items, cubicFeet: Math.round(cubicFeet * 10) / 10, weightLb };
}
