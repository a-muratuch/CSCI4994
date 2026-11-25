import Link from "next/link";
import { moveReference, shortReference } from "@/lib/reference";
import { needsAction, queueSummary, type QueueItem } from "@/lib/admin/queue";
import { chicagoToday } from "@/lib/requests/validation";
import { declineReasonLabel } from "@/lib/estimates/decline";
import { arrivalWindow } from "@/lib/requests/windows";
import { formatArrival, formatDate, formatShortDate } from "@/lib/format";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { ActionLink, PageHeading, Panel, linkClass } from "./admin-ui";

/** "Tue" and "1" for a civil date, without time-zone drift. */
function dayParts(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(
      parsed,
    );
  return {
    weekday: format({ weekday: "short" }),
    day: format({ day: "numeric" }),
  };
}

export function AdminOverview({ data }: { data: EstimateWorkspace }) {
  const today = chicagoToday();
  const estimates = data.estimates.filter((e) => e.isCurrent !== false);
  const moves = data.moves;
  const jobs = data.jobs;
  const review = moves.filter(
    (m) =>
      m.stage === "requested" &&
      !estimates.some(
        (e) =>
          e.requestId === m.id &&
          e.status !== "draft" &&
          e.status !== "declined",
      ),
  );
  const awaiting = estimates.filter((e) => e.status === "awaiting");
  const ready = estimates.filter(
    (e) => e.status === "accepted" && !jobs.some((j) => j.estimateId === e.id),
  );
  const queue = needsAction(data, today);
  const active = jobs
    .filter((j) => j.status !== "completed" && j.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const onTheRoad = active.filter(
    (j) =>
      j.status === "in-progress" || (j.status === "scheduled" && j.onTheWay),
  ).length;
  return (
    <>
      <PageHeading
        eyebrow={formatShortDate(today)}
        title="Operations overview"
        description="Follow moves from request to completion."
        actions={
          <>
            <ActionLink href="/admin/jobs/calendar" outline>
              Week calendar
            </ActionLink>
            <ActionLink href="/admin/requests">Review requests</ActionLink>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests needing review"
          value={review.length}
          href="/admin/requests"
        />
        <StatCard
          label="Awaiting customer decisions"
          value={awaiting.length}
          href="/admin/estimates"
        />
        <StatCard
          label="Accepted, not scheduled"
          value={ready.length}
          href="/admin/estimates"
        />
        <StatCard
          label="Active jobs"
          value={active.length}
          note={onTheRoad ? `${onTheRoad} on the road` : undefined}
          href="/admin/jobs"
          dark
        />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <NeedsAction items={queue} />
        <section aria-labelledby="active-jobs">
          <Panel className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="active-jobs" className="text-lg font-semibold">
                Active jobs
              </h2>
              <Link href="/admin/jobs" className={linkClass}>
                All jobs
              </Link>
            </div>
            {!active.length ? (
              <p className="text-sm text-muted-foreground">No active jobs.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {active.slice(0, 8).map((j) => {
                  const { weekday, day } = dayParts(j.date);
                  return (
                    <li key={j.id}>
                      <Link
                        href={`/admin/jobs/${j.id}`}
                        aria-label={`View job ${shortReference(j.id)}, ${j.customer}, ${formatDate(j.date)}`}
                        className={cn(
                          "flex items-center gap-3 rounded-[14px] bg-surface p-3 transition-colors hover:bg-muted",
                          focusClass,
                        )}
                      >
                        <span className="w-9 shrink-0 text-center">
                          <span className="block text-[11px] text-muted-foreground">
                            {weekday}
                          </span>
                          <span className="block text-xl font-semibold tabular-nums">
                            {day}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 text-[13px]">
                          <span className="block text-sm font-semibold [overflow-wrap:anywhere]">
                            {j.customer} · {shortReference(j.id)}
                          </span>
                          <span className="block text-muted-foreground">
                            {j.returnDate
                              ? `Long distance · back ${formatShortDate(j.returnDate)}`
                              : `${formatArrival(j.arrival)} arrival`}{" "}
                            · {j.truck} · {j.crew.length} crew
                          </span>
                        </span>
                        <StatusBadge status={j.status} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
            {active.length > 8 && (
              <Link href="/admin/jobs" className={linkClass}>
                {active.length - 8} more active jobs
              </Link>
            )}
          </Panel>
        </section>
      </div>
    </>
  );
}

const stepText: Record<
  QueueItem["kind"],
  { title: string; action: string; waiting: string }
> = {
  changes: {
    title: "Customer asked for changes",
    action: "Revise estimate",
    waiting: "Declined",
  },
  schedule: {
    title: "Schedule the accepted move",
    action: "Schedule",
    waiting: "Accepted",
  },
  estimate: {
    title: "Prepare an estimate",
    action: "Prepare estimate",
    waiting: "Requested",
  },
  draft: {
    title: "Review and publish the draft",
    action: "Open draft",
    waiting: "Draft waiting",
  },
  awaiting: {
    title: "Waiting for the customer",
    action: "View estimate",
    waiting: "Published",
  },
};

function itemHref(item: QueueItem) {
  if (item.kind === "estimate")
    return `/admin/requests/${item.moveId}/estimate`;
  if (item.kind === "schedule")
    return `/admin/estimates/${item.estimateId}/schedule`;
  return `/admin/estimates/${item.estimateId}`;
}

/** One list of moves waiting on someone, most urgent first (Phase 8F). */
function NeedsAction({ items }: { items: QueueItem[] }) {
  const summary = queueSummary(items);
  return (
    <section aria-labelledby="needs-action">
      <Panel className="gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="needs-action" className="text-lg font-semibold">
            Needs action
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {items.length} waiting · most urgent first
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {summary.length ? summary.join(" · ") : "Nothing is waiting."} Flagged
          items have waited more than a day (three for customers) or move within
          three days.
        </p>
        {items.length > 0 && (
          <ul className="-mx-1 divide-y">
            {items.map((item) => {
              const text = stepText[item.kind];
              const window = arrivalWindow(item.preferredWindow);
              const reference = moveReference(
                item.moveId,
                item.referenceNumber,
              );
              return (
                <li
                  key={item.moveId}
                  className="flex flex-wrap items-center gap-3 px-1 py-3.5 text-sm"
                >
                  <div className="min-w-0 flex-[1_1_16rem] space-y-0.5 [overflow-wrap:anywhere]">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {item.urgent && (
                        <span className="rounded-full bg-warning-surface px-2 py-0.5 text-xs font-semibold text-warning">
                          {item.kind === "awaiting" ? "Follow up" : "Overdue"}
                        </span>
                      )}
                      {text.title}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {item.customer} · {reference} · moving{" "}
                      {formatDate(item.requestedDate)}
                      {window ? `, ${window.label.toLowerCase()}` : ""}
                      {item.declineReason
                        ? ` · ${declineReasonLabel(item.declineReason)}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {text.waiting}{" "}
                      {item.days === 0
                        ? "today"
                        : item.days === 1
                          ? "1 day ago"
                          : `${item.days} days ago`}
                    </p>
                  </div>
                  <Link
                    href={itemHref(item)}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    {text.action}
                    <span className="sr-only">
                      {" "}
                      for {item.customer}, {reference}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}
