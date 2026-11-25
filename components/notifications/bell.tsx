"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/format";
import { notificationHref } from "@/lib/notifications/model";
import { linkClass, focusClass } from "@/lib/ui";
import { useNotifications } from "./provider";
export function NotificationBell() {
  const { role, state, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const count = state?.state === "ready" ? state.snapshot.unread : 0;
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        className="relative size-11"
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-preview"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell aria-hidden="true" />
        {count > 0 && (
          // The count is in the button's accessible name; the dot is visual.
          <span
            aria-hidden="true"
            className="absolute top-2.5 right-[11px] size-2.5 rounded-full border-2 border-background bg-brand"
          />
        )}
      </Button>
      {open && (
        <section
          id="notification-preview"
          role="dialog"
          aria-label="Notifications"
          className="fixed top-36 right-4 left-4 z-[60] max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border bg-background p-4 shadow-lg sm:right-auto sm:w-96 md:top-20 md:max-h-[calc(100dvh-6rem)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Notifications</h2>
            <Button
              ref={close}
              variant="ghost"
              size="icon"
              className="size-11"
              aria-label="Close notifications"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {!state ? (
            <p className="text-sm text-muted-foreground">
              Loading notifications…
            </p>
          ) : state.state === "setup" ? (
            <p className="text-sm text-muted-foreground">
              Notifications setup is pending.
            </p>
          ) : state.state === "error" ? (
            <>
              <p className="text-sm">Notifications are unavailable.</p>
              <Button
                variant="outline"
                className="mt-3 min-h-11"
                onClick={() => void refresh()}
              >
                Try again
              </Button>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                {count} unread {count === 1 ? "notification" : "notifications"}
              </p>
              {!state.snapshot.items.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  You’re all caught up. New updates will appear here.
                </p>
              )}
              <ul>
                {state.snapshot.items.slice(0, 3).map((n) => {
                  const href = notificationHref(n, role);
                  return (
                    <li key={n.id} className="border-b last:border-0">
                      {href && (
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          className={`block min-h-11 rounded-lg py-3 ${focusClass}`}
                        >
                          <p className="flex items-start justify-between gap-3 text-sm font-medium">
                            {n.title}
                            {!n.read_at && (
                              <span
                                className="mt-1 size-2 shrink-0 rounded-full bg-brand"
                                aria-label="Unread"
                              />
                            )}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {n.detail} · {formatMessageTime(n.created_at)}
                          </p>
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <Link
            href={`/${role}/notifications`}
            className={`${linkClass} mt-2`}
            onClick={() => setOpen(false)}
          >
            View all notifications →
          </Link>
        </section>
      )}
    </div>
  );
}
