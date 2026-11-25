"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { focusClass } from "@/lib/ui";
import { formatMessageTime } from "@/lib/format";
import {
  filterInbox,
  inboxFilters,
  inboxTime,
  type InboxEntry,
  type InboxFilter,
} from "@/lib/messages/inbox";
import { OpenChat } from "./controls";

export function AdminInboxList({
  entries,
  initialFilter,
  now,
}: {
  entries: InboxEntry[];
  initialFilter?: string;
  now: string;
}) {
  const hydrated = useHydrated();
  const initial = inboxFilters.includes(initialFilter as InboxFilter)
    ? (initialFilter as InboxFilter)
    : "all";
  const [filter, setFilter] = useState<InboxFilter>(initial);
  const [query, setQuery] = useState("");
  const visible = filterInbox(entries, filter, query);
  const unread = entries.reduce((count, entry) => count + entry.unread, 0);
  const labels: Record<InboxFilter, string> = {
    all: "All",
    unread: `Unread · ${unread}`,
    customers: "Customers",
    workers: "Workers",
    teams: "Team chats",
  };
  const rowClass = `flex min-h-11 w-full items-start gap-3 rounded-[14px] p-3 text-left sm:px-4 sm:py-3.5 hover:bg-muted ${focusClass}`;
  return (
    <div className="space-y-6">
      <nav aria-label="Message filters" className="flex flex-wrap gap-2">
        {inboxFilters.map((value) => (
          <button
            key={value}
            type="button"
            disabled={!hydrated}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium ${focusClass} ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-input/40 bg-card hover:bg-muted"}`}
          >
            {labels[value]}
          </button>
        ))}
      </nav>
      <section
        aria-label="Company conversations"
        className="min-w-0 rounded-2xl border bg-card p-2 sm:p-2.5"
      >
        <div className="px-1.5 pt-1.5 pb-2.5">
          <label
            htmlFor="conversation-search"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Search conversations
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="conversation-search"
              type="search"
              disabled={!hydrated}
              placeholder="Name or move number"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <p role="status" className="sr-only">
          {visible.length}{" "}
          {visible.length === 1 ? "conversation" : "conversations"} shown.
        </p>
        {!visible.length ? (
          <div className="px-4 py-12 text-center">
            <h2 className="text-[15px] font-semibold">
              {query.trim()
                ? "No matching conversations"
                : filter === "unread"
                  ? "You’re all caught up"
                  : "No conversations yet"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {query.trim()
                ? "Try another name or move number."
                : filter === "unread"
                  ? "New unread messages will appear here after you refresh."
                  : "Support and move-team conversations will appear here."}
            </p>
            {(query || filter !== "all") && (
              <button
                type="button"
                disabled={!hydrated}
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className={`mt-3 min-h-11 rounded-lg px-3 text-sm underline underline-offset-4 ${focusClass}`}
              >
                Show all conversations
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((entry) => {
              const team = entry.kind === "move-team";
              const content = (
                <>
                  <span
                    aria-hidden="true"
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${team ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  >
                    {team
                      ? "#"
                      : entry.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] leading-[1.45]">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="min-w-0 text-[14px] font-semibold [overflow-wrap:anywhere]">
                        {entry.name}
                      </span>
                      {entry.updatedAt && (
                        <time
                          dateTime={entry.updatedAt}
                          title={formatMessageTime(entry.updatedAt)}
                          className="shrink-0 text-xs font-normal text-muted-foreground tabular-nums"
                        >
                          {inboxTime(entry.updatedAt, now)}
                        </time>
                      )}
                    </span>
                    <span className="block truncate font-normal text-muted-foreground">
                      {entry.description}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-3">
                      <span
                        className={`block min-w-0 truncate ${entry.unread ? "font-semibold text-foreground" : "font-normal text-foreground/80"}`}
                      >
                        {entry.preview}
                      </span>
                      {entry.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums">
                          {entry.unread}
                          <span className="sr-only"> unread messages</span>
                        </span>
                      )}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={entry.id}>
                  {entry.conversationId ? (
                    <Link
                      href={`/admin/messages/${entry.conversationId}`}
                      aria-label={`Open conversation with ${entry.name}${entry.unread ? `, ${entry.unread} unread messages` : ""}`}
                      className={`${rowClass} ${entry.unread ? "bg-muted/60" : ""}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <OpenChat
                      kind={entry.kind}
                      target={entry.ownerId!}
                      className={`${rowClass} h-auto justify-start border-0 bg-transparent text-foreground shadow-none hover:bg-muted`}
                    >
                      {content}
                    </OpenChat>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
