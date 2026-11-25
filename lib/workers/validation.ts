import { isUuid } from "../ids.ts";
const week = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const time = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function validateAvailability(value: unknown) {
  if (!Array.isArray(value) || value.length !== 7) return null;
  const rows = [];
  for (const day of week) {
    const matches = value.filter(
      (row) => row && typeof row === "object" && row.day === day,
    );
    if (matches.length !== 1) return null;
    const row = matches[0];
    if (
      typeof row.available !== "boolean" ||
      !time(row.start) ||
      !time(row.end) ||
      (row.available && row.end <= row.start)
    )
      return null;
    rows.push({
      day: week.indexOf(day) + 1,
      available: row.available,
      start_time: row.start,
      end_time: row.end,
    });
  }
  return rows;
}

export function validProgress(id: unknown, status: unknown, revision: unknown) {
  return (
    isUuid(id) &&
    (status === "scheduled" || status === "in-progress") &&
    typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision > 0
  );
}
