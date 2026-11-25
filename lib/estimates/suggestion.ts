/**
 * Suggested estimate from a move inventory, distance and pricing settings.
 * Pure and deterministic so it can be unit-tested and recalculated in the
 * browser when an administrator overrides the miles. Administrators always
 * review and edit the result before publishing; nothing here is saved.
 */
import { inventoryTotals, type InventoryLine } from "../requests/inventory.ts";

export type PricingSettings = {
  workerHourlyCents: number;
  truckFeeCents: number;
  /** Cubic feet one mover loads and unloads per hour. */
  cubicFeetPerWorkerHour: number;
  minimumHours: number;
  perMileCents: number;
  travelMph: number;
  roadFactor: number;
  /** Minutes between jobs besides driving; null before the 7B migration. */
  turnaroundMinutes?: number | null;
};

export type TruckOption = {
  id: string;
  name: string;
  capacityCubicFeet: number | null;
  active: boolean;
};

/** Serializable inputs prepared on the server for the suggestion panel. */
export type SuggestionInput = {
  lines: InventoryLine[];
  settings: PricingSettings;
  trucks: TruckOption[];
  /** One-way miles estimated from ZIP codes, or null when unavailable. */
  estimatedMiles: number | null;
};

export type Suggestion = {
  totals: ReturnType<typeof inventoryTotals>;
  crew: number;
  truck: { id: string; name: string; trips: number } | null;
  miles: number | null;
  drivenMiles: number;
  workHours: number;
  travelHours: number;
  billedHours: number;
  lines: { label: string; amountCents: number }[];
  totalCents: number;
  reasons: string[];
};

/** Crew size grows with volume: small loads need two movers, large homes more. */
export function crewSize(cubicFeet: number) {
  if (cubicFeet <= 400) return 2;
  if (cubicFeet <= 900) return 3;
  if (cubicFeet <= 1500) return 4;
  return 5;
}

/** Round up to the next half hour (movers usually bill in half-hour steps). */
export function roundUpToHalfHour(hours: number) {
  return Math.ceil(hours * 2 - 1e-9) / 2;
}

/**
 * Best-fit truck: the smallest active truck that holds the whole load. If none
 * is big enough, use the largest truck and make several trips.
 */
export function chooseTruck(cubicFeet: number, trucks: readonly TruckOption[]) {
  const sized = trucks
    .filter((t) => t.active && t.capacityCubicFeet && t.capacityCubicFeet > 0)
    .sort(
      (a, b) =>
        a.capacityCubicFeet! - b.capacityCubicFeet! ||
        a.name.localeCompare(b.name),
    );
  if (!sized.length) return null;
  const fits = sized.find((t) => t.capacityCubicFeet! >= cubicFeet);
  const truck = fits ?? sized[sized.length - 1];
  return {
    id: truck.id,
    name: truck.name,
    capacity: truck.capacityCubicFeet!,
    trips: Math.max(1, Math.ceil(cubicFeet / truck.capacityCubicFeet!)),
  };
}

const dollars = (cents: number) =>
  "$" + (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
const hoursText = (hours: number) => `${hours} h`;

/** Same daily limit as `dailyHours` in lib/jobs/long-distance.ts. */
const longDistanceDailyHours = 10;

export function suggestEstimate(input: {
  lines: readonly InventoryLine[];
  settings: PricingSettings;
  trucks: readonly TruckOption[];
  /** One-way road miles, or null when unknown. */
  miles: number | null;
}): Suggestion | null {
  const { settings } = input;
  const totals = inventoryTotals(input.lines);
  if (totals.cubicFeet <= 0) return null;
  const reasons: string[] = [];

  const crew = crewSize(totals.cubicFeet);
  reasons.push(
    `${totals.items} items · ${totals.cubicFeet} cu ft · about ${totals.weightLb.toLocaleString("en-US")} lb → crew of ${crew}.`,
  );

  const chosen = chooseTruck(totals.cubicFeet, input.trucks);
  const trips = chosen?.trips ?? 1;
  if (!chosen)
    reasons.push("No active truck has a capacity set; truck size not checked.");
  else if (trips > 1)
    reasons.push(
      `Largest truck (${chosen.capacity} cu ft) needs ${trips} trips for ${totals.cubicFeet} cu ft.`,
    );
  else
    reasons.push(
      `${chosen.name} (${chosen.capacity} cu ft) is the smallest truck that fits.`,
    );

  // Each trip drives loaded to the destination; extra trips also drive back.
  const miles =
    input.miles !== null && Number.isFinite(input.miles) && input.miles >= 0
      ? Math.round(input.miles)
      : null;
  const drivenMiles = miles === null ? 0 : miles * (2 * trips - 1);
  if (miles === null)
    reasons.push("Distance unknown; enter miles to include travel.");
  else if (trips > 1)
    reasons.push(
      `${miles} mi each way × ${2 * trips - 1} legs = ${drivenMiles} mi driven.`,
    );

  const workHours = totals.cubicFeet / (settings.cubicFeetPerWorkerHour * crew);
  const travelHours = drivenMiles / settings.travelMph;
  const billedHours = Math.max(
    settings.minimumHours,
    roundUpToHalfHour(workHours + travelHours),
  );
  reasons.push(
    `Loading/unloading ≈ ${workHours.toFixed(1)} h` +
      (drivenMiles
        ? ` + driving ≈ ${travelHours.toFixed(1)} h at ${settings.travelMph} mph`
        : "") +
      ` → ${hoursText(billedHours)} billed` +
      (billedHours === settings.minimumHours ? " (minimum)." : "."),
  );

  // Long-distance (Phase 9): more than one day's driving each way. The crew
  // drives the truck back, which the owner chose not to charge.
  const oneWayHours = miles === null ? 0 : miles / settings.travelMph;
  if (oneWayHours > longDistanceDailyHours)
    reasons.push(
      `Long-distance: about ${Math.ceil(oneWayHours / longDistanceDailyHours)} driving days each way at up to ${longDistanceDailyHours} h a day. The drive back is not charged.`,
    );

  const lines: Suggestion["lines"] = [
    {
      label: `Moving crew: ${crew} movers × ${hoursText(billedHours)} at ${dollars(settings.workerHourlyCents)}/h`,
      amountCents: Math.round(crew * billedHours * settings.workerHourlyCents),
    },
    {
      label: chosen
        ? `Truck: ${chosen.name}${trips > 1 ? ` (${trips} trips)` : ""}`
        : "Truck fee",
      amountCents: settings.truckFeeCents * trips,
    },
  ];
  if (drivenMiles > 0 && settings.perMileCents > 0)
    lines.push({
      label: `Mileage: ${drivenMiles} mi at ${dollars(settings.perMileCents)}/mi`,
      amountCents: drivenMiles * settings.perMileCents,
    });
  const priced = lines.filter((line) => line.amountCents > 0);

  return {
    totals,
    crew,
    truck: chosen ? { id: chosen.id, name: chosen.name, trips } : null,
    miles,
    drivenMiles,
    workHours,
    travelHours,
    billedHours,
    lines: priced,
    totalCents: priced.reduce((sum, line) => sum + line.amountCents, 0),
    reasons,
  };
}
