"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CalendarDays, FileText, MessageSquare } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { focusClass, linkClass } from "@/lib/ui";
import { PageHeading } from "@/components/page-heading";
import { formatMessageTime } from "@/lib/format";
import {
  notificationHref,
  type NotificationState,
} from "@/lib/notifications/model";
import { markNotifications } from "@/lib/notifications/actions";
import { fetchNotifications, useNotifications } from "./provider";
export function NotificationsPage({
  unread,
  page,
}: {
  unread: boolean;
  page: number;
}) {
  const { role, version, refresh, live } = useNotifications();
  const [state, setState] = useState<NotificationState | null>(null),
    [feedback, setFeedback] = useState("");
  const [pending, start] = useTransition();
  const resultFocus = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let active = true;
    void fetchNotifications(role, unread, page)
      .then((value) => {
        if (active) setState(value);
      })
      .catch(() => {
        if (active) setState({ state: "error" });
      });
    return () => {
      active = false;
    };
  }, [role, unread, page, version]);
  const base = `/${role}/notifications`,
    href = (n: number, filter = unread) =>
      `${base}?${new URLSearchParams({ filter: filter ? "unread" : "all", page: String(n) })}`;
  const snapshot = state?.state === "ready" ? state.snapshot : null;
  function read(id: string | null, through: string | null = null) {
    start(async () => {
      try {
        const ok = await markNotifications(id, through);
        setFeedback(
          ok
            ? "Notifications marked as read."
            : "Could not update read status. Try again.",
        );
        if (ok) await refresh();
        requestAnimationFrame(() => resultFocus.current?.focus());
      } catch {
        setFeedback("Could not update read status. Try again.");
      }
    });
  }
  return (
    <>
      <PageHeading
        title="Notifications"
        description="Estimates, appointments and conversations in one place."
        actions={
          <Button
            variant="outline"
            disabled={pending || !snapshot?.unread || !snapshot.through}
            onClick={() => read(null, snapshot?.through)}
          >
            Mark all read
          </Button>
        }
      />
      <nav
        aria-label="Notification filters"
        className="mb-3 flex flex-wrap gap-2"
      >
        {[false, true].map((filter) => (
          <Link
            key={String(filter)}
            href={href(1, filter)}
            aria-current={filter === unread ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              filter === unread
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input/40 bg-background hover:bg-muted",
              focusClass,
            )}
          >
            {filter ? "Unread" : "All"}
            {filter && !!snapshot?.unread && (
              <span aria-hidden="true" className="tabular-nums">
                &nbsp;· {snapshot.unread}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>{live}</p>
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => void refresh()}
        >
          Refresh notifications
        </Button>
      </div>
      <p
        ref={resultFocus}
        tabIndex={-1}
        role="status"
        className="mb-3 rounded-sm text-sm focus-visible:ring-3 focus-visible:ring-ring"
      >
        {feedback}
      </p>
      {!state ? (
        <Card className="p-6">
          <p>Loading notifications…</p>
        </Card>
      ) : state.state === "setup" ? (
        <Card className="p-6">
          <h2 className="font-semibold">Notifications setup pending</h2>
          <p className="text-sm text-muted-foreground">
            The database update needs owner approval before notifications can be
            collected.
          </p>
        </Card>
      ) : state.state === "error" ? (
        <Card className="p-6">
          <p role="alert">Notifications could not be loaded. Try refreshing.</p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {state.snapshot.total} {unread ? "unread " : ""}
            {state.snapshot.total === 1 ? "notification" : "notifications"}
          </p>
          {!state.snapshot.items.length ? (
            <Card className="items-center p-8 text-center">
              <Bell
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="font-semibold">
                {page > 1
                  ? "No notifications on this page"
                  : unread
                    ? "You’re all caught up"
                    : "No notifications yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {page > 1
                  ? "Return to the previous page to see earlier updates."
                  : "New updates will appear here when there is something to review."}
              </p>
            </Card>
          ) : (
            <Card className="gap-0 py-1 sm:py-1">
              <ul className="divide-y">
                {state.snapshot.items.map((n) => {
                  const target = notificationHref(n, role),
                    Icon =
                      n.kind === "message"
                        ? MessageSquare
                        : n.kind.startsWith("estimate-")
                          ? FileText
                          : CalendarDays;
                  return (
                    <li
                      key={n.id}
                      className="flex items-start gap-3 px-4 py-4 sm:gap-4 sm:px-6"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-2 size-2 shrink-0 rounded-full",
                          n.read_at ? "bg-transparent" : "bg-brand",
                        )}
                      />
                      <Icon
                        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h2 className="text-[15px] font-semibold [overflow-wrap:anywhere]">
                            {n.title}
                          </h2>
                          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                            {!n.read_at && (
                              <span className="font-semibold text-brand">
                                Unread
                              </span>
                            )}
                            <time dateTime={n.created_at}>
                              {formatMessageTime(n.created_at)}
                            </time>
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                          {n.detail}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-5">
                          {target && (
                            <Link href={target} className={linkClass}>
                              Open{" "}
                              {n.kind === "message"
                                ? "conversation"
                                : n.kind.startsWith("estimate-")
                                  ? "estimate"
                                  : "appointment"}{" "}
                              →
                            </Link>
                          )}
                          {!n.read_at && (
                            <Button
                              variant="ghost"
                              className="px-2"
                              disabled={pending}
                              onClick={() => read(n.id)}
                            >
                              Mark as read
                              <span className="sr-only">
                                : {n.title}, {formatMessageTime(n.created_at)}
                              </span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          <nav
            aria-label="Notification pages"
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            {page > 1 && (
              <Link
                href={href(page - 1)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11",
                )}
              >
                Previous
              </Link>
            )}
            <span className="text-sm">Page {page}</span>
            {page * 20 < state.snapshot.total && (
              <Link
                href={href(page + 1)}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11",
                )}
              >
                Next
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
