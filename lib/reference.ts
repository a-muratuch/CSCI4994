/** Display only: routes, mutations and relationships always keep the full UUID. */
export function shortReference(id: string) {
  return id.slice(0, 8);
}
export function moveReference(id: string, number?: number | null) {
  return number !== undefined &&
    number !== null &&
    Number.isSafeInteger(number) &&
    number > 0
    ? `RM-${number}`
    : shortReference(id);
}
export function requestReference(
  id: string,
  moves: { id: string; referenceNumber?: number }[],
) {
  return moveReference(
    id,
    moves.find((move) => move.id === id)?.referenceNumber,
  );
}

/** The city part of an address, from saved fields or "street, city, ST ZIP" text. */
function cityOf(address: { city?: string } | undefined, text: string) {
  return address?.city?.trim() || text.split(", ")[1]?.trim() || "";
}

/**
 * A name customers recognise: "Oxford → Tupelo". Falls back to the move
 * reference when the cities are unknown.
 */
export function moveTitle(move: {
  id: string;
  referenceNumber?: number | null;
  pickup: string;
  destination: string;
  pickupAddress?: { city?: string };
  destinationAddress?: { city?: string };
}) {
  const from = cityOf(move.pickupAddress, move.pickup),
    to = cityOf(move.destinationAddress, move.destination);
  return from && to
    ? `${from} → ${to}`
    : `Move #${moveReference(move.id, move.referenceNumber)}`;
}
