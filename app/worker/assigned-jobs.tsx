"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkerWorkspace } from "@/lib/workers/data";
import { formatArrival, formatShortDate, formatWork } from "@/lib/format";
import { moveTitle } from "@/lib/reference";
import { markOnTheWay } from "@/lib/workers/actions";
import {
  HeroPanel,
  heroActionClass,
  heroSecondaryClass,
} from "@/components/hero-panel";
import { StatusBadge } from "@/components/status-badge";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Heading } from "./worker-ui";

type Job = WorkerWorkspace["jobs"][number];

/** "Tue" and "15" for a civil date, without time-zone drift. */
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

/** Days from `from` to `to`, both YYYY-MM-DD. */
function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

function otherCrew(job: Job) {
  return job.crew.map((name) => name.split(/\s+/)[0]).join(", ");
}

// "Earlier" holds past-dated jobs that are still open; it shows only when
// there are any.
const filters = ["Upcoming", "This week", "In progress", "Earlier"] as const;
type Filter = (typeof filters)[number];

export default function AssignedJobsPage({
  jobs,
  today,
  progressReady,
}: Pick<WorkerWorkspace, "jobs"> & {
  /** Today's date in Central Time (YYYY-MM-DD). */
  today: string;
  /** Crew progress steps (Phase 8G) are available. */
  progressReady: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("Upcoming");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const active = jobs
    .filter((job) => job.status === "scheduled" || job.status === "in-progress")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const todayJob = active.find((job) => job.date === today);
  const nextJob = todayJob ?? active.find((job) => job.date > today);
  const matches = (job: Job, option: Filter) =>
    option === "In progress"
      ? job.status === "in-progress"
      : option === "This week"
        ? daysBetween(today, job.date) >= 0 && daysBetween(today, job.date) < 7
        : option === "Earlier"
          ? job.date < today
          : job.date >= today;
  const count = (option: Filter) =>
    active.filter((job) => job.id !== nextJob?.id && matches(job, option))
      .length;
  const listed = active.filter(
    (job) => job.id !== nextJob?.id && matches(job, filter),
  );
  // Same rule as the job page: only on the job date, once.
  const canMarkOnTheWay =
    progressReady && todayJob?.status === "scheduled" && !todayJob.onTheWay;

  return (
    <>
      <Heading title="Your assigned jobs">
        Your next moves, with the details you need before arrival. An admin
        controls appointments, crews, and trucks.
      </Heading>

      {nextJob && (
        <HeroPanel
          className="mb-6"
          eyebrow={`${nextJob === todayJob ? "Today" : "Next job"} · ${formatShortDate(nextJob.date)}`}
          title={`${nextJob.customer} · ${moveTitle(nextJob)}`}
          actions={
            <>
              {canMarkOnTheWay && (
                <button
                  type="button"
                  disabled={pending}
                  className={cn(heroActionClass, focusClass)}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await markOnTheWay(
                        todayJob.id,
                        todayJob.revision,
                      ).catch(() => ({
                        ok: false,
                        message:
                          "The update could not be confirmed. Reload the job before retrying.",
                      }));
                      setMessage(result.message);
                      router.refresh();
                      requestAnimationFrame(() => feedback.current?.focus());
                    })
                  }
                >
                  {pending ? "Saving…" : "Mark on the way"}
                </button>
              )}
              <Link
                href={`/worker/jobs/${nextJob.id}`}
                className={cn(
                  canMarkOnTheWay ? heroSecondaryClass : heroActionClass,
                  focusClass,
                )}
              >
                Open job
              </Link>
            </>
          }
        >
          Arrive {formatArrival(nextJob.arrival)} · work {formatWork(nextJob)} ·{" "}
          {nextJob.truck}
          {nextJob.crew.length > 0 && ` · crew ${otherCrew(nextJob)}`}
          {nextJob.status === "scheduled" && nextJob.onTheWay && (
            <span className="mt-2 block font-medium text-primary-foreground">
              On the way · the customer was notified.
            </span>
          )}
          {nextJob.status === "in-progress" && (
            <span className="mt-2 block font-medium text-primary-foreground">
              In progress.
            </span>
          )}
        </HeroPanel>
      )}
      <p
        ref={feedback}
        tabIndex={-1}
        role="status"
        className={cn(
          "mb-4 rounded-sm text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring",
          !message && "sr-only",
        )}
      >
        {message}
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">Coming up</h2>
        <div
          role="group"
          aria-label="Filter assigned jobs"
          className="flex flex-wrap gap-2"
        >
          {filters
            .filter((option) => option !== "Earlier" || count(option) > 0)
            .map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  filter === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input/40 bg-background hover:bg-muted",
                  focusClass,
                )}
              >
                {option}
                <span className="tabular-nums">&nbsp;· {count(option)}</span>
              </button>
            ))}
        </div>
      </div>
      <p role="status" className="sr-only">
        {listed.length} assigned job(s) in this view.
      </p>
      {!listed.length ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h3 className="font-semibold">No other assigned jobs in this view</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Only jobs assigned to you appear here. Scheduling and assignments
            are managed by an admin.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {listed.map((job) => {
            const { weekday, day } = dayParts(job.date);
            return (
              <li key={job.id}>
                <Link
                  href={`/worker/jobs/${job.id}`}
                  aria-label={`View job for ${job.customer}, ${formatShortDate(job.date)}`}
                  className={cn(
                    "flex items-center gap-4 rounded-[20px] border bg-card p-4 transition-colors hover:bg-muted sm:p-5",
                    focusClass,
                  )}
                >
                  <span className="w-11 shrink-0 text-center">
                    <span className="block text-xs text-muted-foreground">
                      {weekday}
                    </span>
                    <span className="block text-2xl font-semibold tabular-nums">
                      {day}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">
                      {job.customer} · {moveTitle(job)}
                    </span>
                    <span className="text-muted-foreground">
                      {job.returnDate
                        ? `Long distance · back ${formatShortDate(job.returnDate)}`
                        : `${formatArrival(job.arrival)} arrival`}{" "}
                      · {job.truck}
                      {job.crew.length > 0 && ` · ${otherCrew(job)}`}
                    </span>
                  </span>
                  <StatusBadge status={job.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
