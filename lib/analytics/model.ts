export type Analytics = {
  start: string;
  end: string;
  asOf: string;
  requests: number;
  acceptedRequests: number;
  acceptedCount: number;
  acceptedCents: number;
  jobs: number;
  funnel: number[];
  weekly: { date: string; requests: number; jobs: number }[];
  crew: {
    id: string;
    name: string;
    active: boolean;
    hours: number;
    jobs: number;
  }[];
};
export function analyticsWeeks(value: unknown): 4 | 8 | 12 {
  return value === "4" ? 4 : value === "12" ? 12 : 8;
}
export function acceptanceRate(requests: number, accepted: number) {
  return requests === 0 ? null : Math.round((accepted / requests) * 1000) / 10;
}
export function barPercent(value: number, maximum: number) {
  return maximum <= 0 ? 0 : Math.min(100, Math.max(0, (value / maximum) * 100));
}
// Fail visibly on an incompatible summary instead of silently showing invented zeroes.
export function analyticsResult(value: unknown): Analytics | null {
  if (!value || typeof value !== "object") return null;
  const x = value as Analytics;
  const count = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const date = (d: unknown) =>
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (
    !date(x.start) ||
    !date(x.end) ||
    typeof x.asOf !== "string" ||
    !Number.isFinite(Date.parse(x.asOf)) ||
    ![
      x.requests,
      x.acceptedRequests,
      x.acceptedCount,
      x.acceptedCents,
      x.jobs,
    ].every(count) ||
    !Array.isArray(x.funnel) ||
    x.funnel.length !== 5 ||
    !x.funnel.every(count) ||
    !Array.isArray(x.weekly) ||
    ![4, 8, 12].includes(x.weekly.length) ||
    !x.weekly.every(
      (w) =>
        w !== null &&
        typeof w === "object" &&
        date(w.date) &&
        count(w.requests) &&
        count(w.jobs),
    ) ||
    !Array.isArray(x.crew) ||
    !x.crew.every(
      (c) =>
        c !== null &&
        typeof c === "object" &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.active === "boolean" &&
        typeof c.hours === "number" &&
        Number.isFinite(c.hours) &&
        c.hours >= 0 &&
        count(c.jobs),
    )
  )
    return null;
  return x;
}
