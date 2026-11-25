// Plans how long a move takes, including long-distance moves that need several
// days and the crew driving the truck back (Phase 9). Pure, so it is unit
// tested without a database. Dates are "YYYY-MM-DD", times "HH:MM" (Central).

/** Owner decision (Nov 24, 2026): at most 10 working and driving hours a day. */
export const dailyHours = 10;
/** Later days start at this time; no day runs past dayEnd. */
export const dayStart = "08:00";
export const dayEnd = "20:00";

export type TripPlan = {
  longDistance: boolean;
  /** Delivery (last work) day and the time unloading finishes. */
  endDate: string;
  endTime: string;
  /** Long-distance only: the day the crew and truck are back. */
  returnDate: string | null;
  /** Days from loading to delivery, and further days driving back. */
  outboundDays: number;
  returnDays: number;
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param workMinutes loading plus unloading for the whole crew.
 * @param driveMinutes one-way driving between the addresses; null if unknown.
 * @param minimumMinutes minimum billed time for local moves.
 */
export function planTrip(input: {
  date: string;
  start: string;
  workMinutes: number;
  driveMinutes: number | null;
  minimumMinutes: number;
}): TripPlan {
  const drive = Math.max(0, Math.round(input.driveMinutes ?? 0));
  const work = Math.max(0, Math.round(input.workMinutes));
  const startMinutes = toMinutes(input.start);
  // Local: the whole job, rounded up to the half hour, fits one working day
  // (at most 10 hours and finished by 8 PM).
  const localLength = Math.max(
    input.minimumMinutes,
    Math.ceil((work + drive) / 30) * 30,
  );
  if (
    localLength <= dailyHours * 60 &&
    startMinutes + localLength <= toMinutes(dayEnd)
  )
    return {
      longDistance: false,
      endDate: input.date,
      endTime: toTime(startMinutes + localLength),
      returnDate: null,
      outboundDays: 1,
      returnDays: 0,
    };

  // Long-distance: spend each day's budget on the tasks in order.
  let day = 0;
  let clock = startMinutes;
  // Each day: at most 10 hours, and never past 8 PM.
  const budget = (from: number) =>
    Math.max(0, Math.min(dailyHours * 60, toMinutes(dayEnd) - from));
  let left = budget(startMinutes);
  const spend = (minutes: number) => {
    let remaining = minutes;
    while (remaining > 0) {
      if (left === 0) {
        day += 1;
        clock = toMinutes(dayStart);
        left = budget(clock);
      }
      const used = Math.min(remaining, left);
      remaining -= used;
      left -= used;
      clock += used;
    }
  };
  spend(Math.ceil(work / 2)); // load
  spend(drive); // drive there
  spend(work - Math.ceil(work / 2)); // unload
  const deliveryDay = day;
  const endTime = toTime(Math.min(Math.ceil(clock / 30) * 30, 23 * 60 + 59));
  spend(drive); // drive back (same budget, possibly the same day)
  return {
    longDistance: true,
    endDate: addDays(input.date, deliveryDay),
    endTime,
    returnDate: addDays(input.date, day),
    outboundDays: deliveryDay + 1,
    returnDays: day - deliveryDay,
  };
}

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Later days of a trip (after the start day, up to the return day) on which a
 * worker has no availability. `availability` uses weekday names ("Monday").
 */
export function missingTripDays(
  availability: readonly { day: string; available: boolean }[],
  date: string,
  until: string,
) {
  const missing: string[] = [];
  for (let d = addDays(date, 1); d <= until; d = addDays(d, 1)) {
    const weekday = weekdays[new Date(`${d}T12:00:00Z`).getUTCDay()];
    if (!availability.some((a) => a.day === weekday && a.available))
      missing.push(d);
  }
  return missing;
}
