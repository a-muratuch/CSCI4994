/** Straight-line and estimated road distance between two points. Pure; no I/O. */
export type Point = readonly [latitude: number, longitude: number];

const EARTH_RADIUS_MILES = 3958.8;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle ("as the crow flies") distance using the haversine formula. */
export function straightLineMiles(from: Point, to: Point) {
  const dLat = radians(to[0] - from[0]);
  const dLng = radians(to[1] - from[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from[0])) *
      Math.cos(radians(to[0])) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Roads are rarely straight, so the straight-line distance is multiplied by a
 * road factor (about 1.2 for most U.S. trips) and rounded to whole miles.
 * Different ZIP codes are at least 1 mile apart; the same ZIP counts as 0.
 */
export function estimatedRoadMiles(from: Point, to: Point, roadFactor: number) {
  const miles = straightLineMiles(from, to) * roadFactor;
  return Math.round(miles);
}

/** Five-digit ZIP from a ZIP or ZIP+4 value, or null. */
export function zip5(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{5})(?:-\d{4})?$/.exec(value.trim());
  return match ? match[1] : null;
}

/** Estimate miles between two ZIP codes using a centroid lookup table. */
export function milesBetweenZips(
  fromZip: unknown,
  toZip: unknown,
  centroids: Readonly<Record<string, Point | undefined>>,
  roadFactor: number,
) {
  const a = zip5(fromZip),
    b = zip5(toZip);
  if (!a || !b) return null;
  if (a === b) return 0;
  const from = centroids[a],
    to = centroids[b];
  if (!from || !to) return null;
  return Math.max(1, estimatedRoadMiles(from, to, roadFactor));
}
