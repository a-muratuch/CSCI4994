/**
 * Default customer arrival window for a work interval: one hour from the work
 * start, ending no later than the work end. Times are "HH:MM" (Central Time).
 */
export function defaultArrival(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start)) return { arrivalStart: "", arrivalEnd: "" };
  const [hours, minutes] = start.split(":").map(Number);
  const hourLater = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  let arrivalEnd = `${String(Math.floor(hourLater / 60)).padStart(2, "0")}:${String(hourLater % 60).padStart(2, "0")}`;
  if (/^\d{2}:\d{2}$/.test(end) && end > start && end < arrivalEnd)
    arrivalEnd = end;
  return { arrivalStart: start, arrivalEnd };
}

/** "HH:MM" plus minutes, capped at 23:59 (same-day work only). */
export function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = Math.min(hours * 60 + mins + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Expected job length in minutes: loading and unloading the inventory with the
 * suggested crew plus driving between the addresses, rounded up to the half
 * hour and never below the minimum billed hours. Four hours when no
 * inventory or pricing is known.
 */
export function jobMinutes(input: {
  volume: number;
  crew: number;
  cubicFeetPerWorkerHour: number | null;
  minimumHours: number | null;
  driveMinutes: number | null;
}) {
  if (input.volume <= 0 || !input.cubicFeetPerWorkerHour || input.crew < 1)
    return 240;
  const work =
    (input.volume / (input.cubicFeetPerWorkerHour * input.crew)) * 60;
  const halfHours = Math.ceil((work + (input.driveMinutes ?? 0)) / 30);
  return Math.max((input.minimumHours ?? 0) * 60, halfHours * 30);
}
