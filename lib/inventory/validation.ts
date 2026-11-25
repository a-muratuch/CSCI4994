/** Administrator inventory/pricing input checks. Mirrors the database limits. */
import { inventoryRooms, type InventoryRoom } from "../requests/inventory.ts";

export type CatalogInput = {
  name: string;
  room: InventoryRoom;
  cubicFeet: number;
  weightLb: number;
  active: boolean;
};

const between = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;
const whole = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

/** Parses a dollar amount like "45" or "45.50" into integer cents. */
export function dollarsToCents(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,7}(\.\d{1,2})?$/.test(value.trim()))
    return null;
  return Math.round(Number(value.trim()) * 100);
}

export function validateCatalogItem(value: unknown): CatalogInput | null {
  if (!value || typeof value !== "object") return null;
  const name = Reflect.get(value, "name"),
    room = Reflect.get(value, "room"),
    cubicFeet = Number(Reflect.get(value, "cubicFeet")),
    weightLb = Number(Reflect.get(value, "weightLb")),
    active = Reflect.get(value, "active");
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100 ||
    !inventoryRooms.includes(room as InventoryRoom) ||
    !between(cubicFeet, 0.1, 500) ||
    !whole(weightLb, 0, 3000) ||
    typeof active !== "boolean"
  )
    return null;
  return {
    name: name.trim(),
    room: room as InventoryRoom,
    cubicFeet: Math.round(cubicFeet * 10) / 10,
    weightLb,
    active,
  };
}

export type PricingInput = {
  workerHourlyCents: number;
  truckFeeCents: number;
  cubicFeetPerWorkerHour: number;
  minimumHours: number;
  perMileCents: number;
  travelMph: number;
  roadFactor: number;
  /** Null when the form has no turnaround field (before Phase 7B). */
  turnaroundMinutes: number | null;
};

/** Form values arrive as strings; money fields are dollars. */
export function validatePricing(value: unknown): PricingInput | null {
  if (!value || typeof value !== "object") return null;
  const get = (key: string) => Reflect.get(value, key);
  const workerHourlyCents = dollarsToCents(get("workerHourly")),
    truckFeeCents = dollarsToCents(get("truckFee")),
    perMileCents = dollarsToCents(get("perMile")),
    cubicFeetPerWorkerHour = Number(get("cubicFeetPerWorkerHour")),
    minimumHours = Number(get("minimumHours")),
    travelMph = Number(get("travelMph")),
    roadFactor = Number(get("roadFactor")),
    turnaround = get("turnaroundMinutes"),
    turnaroundMinutes =
      turnaround === undefined || turnaround === null
        ? null
        : // An empty box is an error, not zero minutes.
          typeof turnaround === "string" && !turnaround.trim()
          ? Number.NaN
          : Number(turnaround);
  if (
    workerHourlyCents === null ||
    !whole(workerHourlyCents, 100, 100000) ||
    truckFeeCents === null ||
    !whole(truckFeeCents, 0, 1000000) ||
    perMileCents === null ||
    !whole(perMileCents, 0, 10000) ||
    !whole(cubicFeetPerWorkerHour, 5, 500) ||
    !between(minimumHours, 1, 12) ||
    !whole(travelMph, 10, 80) ||
    !between(roadFactor, 1, 2) ||
    (turnaroundMinutes !== null && !whole(turnaroundMinutes, 0, 180))
  )
    return null;
  return {
    workerHourlyCents,
    truckFeeCents,
    cubicFeetPerWorkerHour,
    // Match the database precision: 0.1 hour and 0.01 road factor.
    minimumHours: Math.round(minimumHours * 10) / 10,
    perMileCents,
    travelMph,
    roadFactor: Math.round(roadFactor * 100) / 100,
    turnaroundMinutes,
  };
}

/** Truck capacity: blank clears it; otherwise 50–5,000 whole cubic feet. */
export function validateCapacity(value: unknown): number | null | undefined {
  if (value === "" || value === null) return null;
  const n = typeof value === "string" ? Number(value.trim()) : Number.NaN;
  return whole(n, 50, 5000) ? n : undefined;
}
