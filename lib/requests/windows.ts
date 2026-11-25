// Arrival windows a customer may prefer (Phase 8D). Keys match the database
// check on move_requests.preferred_window. Times are Central Time.
export const arrivalWindows = [
  {
    key: "morning",
    label: "Morning (8–10 a.m.)",
    start: "08:00",
    end: "10:00",
  },
  {
    key: "midday",
    label: "Midday (11 a.m.–1 p.m.)",
    start: "11:00",
    end: "13:00",
  },
  {
    key: "afternoon",
    label: "Afternoon (2–4 p.m.)",
    start: "14:00",
    end: "16:00",
  },
] as const;

export function arrivalWindow(key: string | null | undefined) {
  return arrivalWindows.find((window) => window.key === key) ?? null;
}
