export type InboxEntry = {
  id: string;
  conversationId: string | null;
  kind: "customer-support" | "worker-support" | "move-team";
  ownerId: string | null;
  name: string;
  description: string;
  preview: string;
  updatedAt: string | null;
  unread: number;
  reference: string;
};
export const inboxFilters = [
  "all",
  "unread",
  "customers",
  "workers",
  "teams",
] as const;
export type InboxFilter = (typeof inboxFilters)[number];

export function filterInbox(
  entries: InboxEntry[],
  filter: InboxFilter,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const matches =
      filter === "all" ||
      (filter === "unread" && entry.unread > 0) ||
      (filter === "customers" && entry.kind === "customer-support") ||
      (filter === "workers" && entry.kind === "worker-support") ||
      (filter === "teams" && entry.kind === "move-team");
    return (
      matches &&
      (!search ||
        [entry.name, entry.description, entry.reference].some((text) =>
          text.toLocaleLowerCase().includes(search),
        ))
    );
  });
}

/** Compact inbox dates use the same Central Time day as the rest of the app. */
export function inboxTime(value: string, now: string) {
  const date = new Date(value),
    today = new Date(now);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(today.getTime()))
    return "";
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const currentDay = day(today),
    messageDay = day(date);
  if (messageDay === currentDay)
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  const yesterday = new Date(`${currentDay}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (messageDay === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    ...(messageDay.slice(0, 4) !== currentDay.slice(0, 4)
      ? { year: "numeric" }
      : {}),
  }).format(date);
}
