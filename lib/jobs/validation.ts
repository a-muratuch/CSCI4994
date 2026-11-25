import type { ScheduleInput } from "../domain";
import { uuid } from "../estimates/validation";
export function validateSchedule(value: unknown): {
  input?: ScheduleInput;
  error?: string;
} {
  const error = {
    error:
      "Choose a valid date, work interval, arrival window, worker and truck. Long-distance moves also need delivery and return dates.",
  };
  if (!value || typeof value !== "object") return error;
  const date = Reflect.get(value, "date"),
    start = Reflect.get(value, "start"),
    end = Reflect.get(value, "end"),
    arrivalStart = Reflect.get(value, "arrivalStart"),
    arrivalEnd = Reflect.get(value, "arrivalEnd");
  const workers = Reflect.get(value, "workerIds"),
    truck = Reflect.get(value, "truckId");
  const validDate = (d: unknown): d is string => {
    if (
      typeof d !== "string" ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d) ||
      d.startsWith("0000")
    )
      return false;
    const parsed = new Date(`${d}T12:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === d
    );
  };
  if (!validDate(date)) return error;
  // Phase 9: a long-distance move has a later delivery day and a return day.
  const endDateValue = Reflect.get(value, "endDate"),
    returnDateValue = Reflect.get(value, "returnDate");
  const endDate =
    endDateValue === undefined || endDateValue === "" ? date : endDateValue;
  const returnDate =
    returnDateValue === undefined || returnDateValue === ""
      ? undefined
      : returnDateValue;
  if (
    !validDate(endDate) ||
    endDate < date ||
    (returnDate !== undefined &&
      (!validDate(returnDate) || returnDate < endDate)) ||
    (returnDate === undefined && endDate !== date) ||
    daysBetween(date, returnDate ?? endDate) > 30
  )
    return error;
  const sameDay = endDate === date;
  const time = (t: unknown): t is string =>
    typeof t === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t);
  if (
    !time(start) ||
    !time(end) ||
    !time(arrivalStart) ||
    !time(arrivalEnd) ||
    (sameDay && (start >= end || arrivalEnd > end)) ||
    arrivalStart >= arrivalEnd ||
    arrivalStart < start
  )
    return error;
  if (
    !Array.isArray(workers) ||
    workers.length < 1 ||
    !workers.every(uuid) ||
    new Set(workers).size !== workers.length ||
    !uuid(truck)
  )
    return error;
  return {
    input: {
      date,
      start,
      end,
      arrivalStart,
      arrivalEnd,
      workerIds: workers,
      truckId: truck,
      ...(returnDate ? { endDate, returnDate } : {}),
    },
  };
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86400000,
  );
}
