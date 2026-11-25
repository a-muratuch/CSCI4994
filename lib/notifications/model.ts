import { isUuid } from "../ids.ts";
import type { Role } from "../auth/roles";
export type Notification = {
  id: string;
  kind:
    | "estimate-published"
    | "estimate-declined"
    | "job-scheduled"
    | "job-updated"
    | "crew-on-the-way"
    | "crew-arrived"
    | "delivery-photos"
    | "message";
  created_at: string;
  read_at: string | null;
  target_kind: "estimate" | "job" | "move" | "conversation";
  target_id: string;
  title: string;
  detail: string;
};
export type NotificationSnapshot = {
  items: Notification[];
  total: number;
  unread: number;
  through: string | null;
};
export type NotificationState =
  | { state: "ready"; role: Role; snapshot: NotificationSnapshot }
  | { state: "setup" }
  | { state: "error" };
export function notificationPage(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 && n <= 1000000 ? n : 1;
}
export function notificationPath(
  n: Pick<Notification, "target_kind" | "target_id">,
  role: Role,
) {
  if (!isUuid(n.target_id)) return null;
  const section =
    n.target_kind === "conversation"
      ? "messages"
      : n.target_kind === "move" && role === "customer"
        ? "moves"
        : n.target_kind === "estimate" && role !== "worker"
          ? "estimates"
          : n.target_kind === "job" && role !== "customer"
            ? "jobs"
            : null;
  return section ? `/${role}/${section}/${n.target_id}` : null;
}
export function notificationHref(n: Notification, role: Role) {
  const path = notificationPath(n, role);
  return path ? `${path}?notification=${n.id}` : null;
}
export function notificationSnapshot(
  value: unknown,
): NotificationSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const x = value as NotificationSnapshot;
  const count = (n: unknown) =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  const time = (t: unknown) =>
    typeof t === "string" && Number.isFinite(Date.parse(t));
  if (
    !count(x.total) ||
    !count(x.unread) ||
    (x.through !== null && !isUuid(x.through)) ||
    !Array.isArray(x.items) ||
    x.items.length > 20 ||
    !x.items.every(
      (n) =>
        n !== null &&
        typeof n === "object" &&
        isUuid(n.id) &&
        isUuid(n.target_id) &&
        [
          "estimate-published",
          "estimate-declined",
          "job-scheduled",
          "job-updated",
          "crew-on-the-way",
          "crew-arrived",
          "delivery-photos",
          "message",
        ].includes(n.kind) &&
        ["estimate", "job", "move", "conversation"].includes(n.target_kind) &&
        typeof n.title === "string" &&
        typeof n.detail === "string" &&
        time(n.created_at) &&
        (n.read_at === null || time(n.read_at)),
    )
  )
    return null;
  return x;
}
