import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/account";
import { calendarData } from "@/lib/jobs/calendar-data";
import {
  calendarHref,
  calendarLanes,
  calendarWeek,
  type CalendarJob,
  type CalendarView,
} from "@/lib/jobs/calendar";
import { chicagoToday } from "@/lib/requests/validation";
import {
  formatDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
} from "@/lib/format";
import { shortReference } from "@/lib/reference";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { focusClass, linkClass, PageHeading, Panel } from "../../admin-ui";
import { JobViewLinks } from "../job-view-links";
import { estimateWorkspace } from "@/lib/estimates/data";
import { needsAction, type QueueItem } from "@/lib/admin/queue";
import { arrivalWindow } from "@/lib/requests/windows";
import { moveReference } from "@/lib/reference";

export const metadata: Metadata = { title: "Week calendar" };
const navClass = cn(buttonVariants({ variant: "outline" }), "min-h-11 px-4");
function JobCard({ job, lane }: { job: CalendarJob; lane: string }) {
  // Long distance = dark, in progress = warning surface, otherwise muted.
  const dark = !!job.trip;
  const quiet = dark ? "text-primary-foreground/75" : "text-muted-foreground";
  return (
    <article
      className={cn(
        "min-w-0 space-y-1.5 rounded-xl p-3 text-sm [overflow-wrap:anywhere]",
        dark
          ? "bg-primary text-primary-foreground"
          : job.status === "in-progress"
            ? "bg-warning-surface"
            : "bg-muted",
      )}
    >
      <StatusBadge status={job.status} />
      <p className="font-semibold">{job.customer}</p>
      {job.trip && (
        <p className="font-medium">
          Long-distance · day {job.trip.day} of {job.trip.days} ·{" "}
          {job.trip.phase}
        </p>
      )}
      {!job.trip || job.trip.day === 1 ? (
        <>
          <p>
            <span className={quiet}>{job.trip ? "Starts: " : "Work: "}</span>
            {job.trip
              ? formatTime(job.start)
              : formatTimeRange(job.start, job.end)}
          </p>
          <p>
            <span className={quiet}>Arrival: </span>
            {formatTimeRange(job.arrivalStart, job.arrivalEnd)}
          </p>
        </>
      ) : (
        <p className={quiet}>
          Delivery {formatShortDate(job.trip.endDate)} · back{" "}
          {formatShortDate(job.trip.returnDate)}
        </p>
      )}
      <p className={quiet}>
        {job.workers.map((w) => w.name).join(", ") || "No assigned workers"} ·{" "}
        {job.truck}
      </p>
      {job.travelWarning && (
        <p className="rounded-lg bg-warning-surface p-2 text-warning">
          {job.travelWarning}
        </p>
      )}
      <Link
        href={"/admin/jobs/" + job.id}
        className={linkClass}
        aria-label={`View job ${shortReference(job.id)} for ${lane}`}
      >
        View job {shortReference(job.id)}
      </Link>
    </article>
  );
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");
  const params = await searchParams,
    today = chicagoToday();
  const week = calendarWeek(params.week, today);
  const view: CalendarView = params.view === "trucks" ? "trucks" : "workers";
  const [result, workspace] = await Promise.all([
    calendarData(week.start, week.end),
    estimateWorkspace("admin"),
  ]);
  if (result.error)
    return (
      <>
        <JobViewLinks calendar />
        <RecordsUnavailable title="Calendar unavailable" />
      </>
    );
  const { jobs } = result.data;
  const lanes = calendarLanes(jobs, result.data[view], view);
  return (
    <>
      <JobViewLinks calendar />
      <PageHeading
        title="Week calendar"
        description="Plan around confirmed jobs. All dates and times are Central Time."
      />
      <Panel className="mb-6">
        <h2 id="calendar-week" className="text-lg font-semibold">
          {formatDate(week.start)} – {formatDate(week.end)}
        </h2>
        <nav aria-label="Calendar weeks" className="flex flex-wrap gap-2">
          {week.previous ? (
            <Link className={navClass} href={calendarHref(week.previous, view)}>
              Previous week
            </Link>
          ) : (
            <span className={navClass} aria-disabled="true">
              Previous week
            </span>
          )}
          <Link
            className={navClass}
            href={calendarHref(calendarWeek(undefined, today).start, view)}
          >
            This week
          </Link>
          {week.next ? (
            <Link className={navClass} href={calendarHref(week.next, view)}>
              Next week
            </Link>
          ) : (
            <span className={navClass} aria-disabled="true">
              Next week
            </span>
          )}
        </nav>
        <form
          action="/admin/jobs/calendar"
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="view" value={view} />
          <div className="min-w-0 space-y-2">
            <Label htmlFor="calendar-date">Show week containing</Label>
            <Input
              id="calendar-date"
              name="week"
              type="date"
              min="2000-01-03"
              max="2099-12-27"
              defaultValue={week.start}
              key={week.start}
              required
              className="min-h-11"
            />
          </div>
          <Button type="submit" className="min-h-11 px-4">
            Show week
          </Button>
        </form>
        {week.invalid && (
          <p role="alert" className="text-sm text-destructive">
            Choose a valid date between 2000 and 2099. Showing the current week.
          </p>
        )}
        <nav
          aria-label="Calendar lanes"
          className="inline-flex w-fit flex-wrap gap-1 rounded-xl bg-muted p-1"
        >
          {(["workers", "trucks"] as const).map((mode) => (
            <Link
              key={mode}
              href={calendarHref(week.start, mode)}
              aria-current={view === mode ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: view === mode ? "default" : "ghost",
                }),
                "min-h-11 px-4",
              )}
            >
              {mode === "workers" ? "Workers" : "Trucks"}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">
          {new Set(jobs.map((j) => j.id)).size}{" "}
          {new Set(jobs.map((j) => j.id)).size === 1 ? "job" : "jobs"} this
          week. Scheduled, in progress and completed jobs are shown. Cancelled
          jobs remain in the list view.
        </p>
        <p className="text-sm text-muted-foreground">
          Empty cells mean no booked jobs, not confirmed availability. Open a
          job to review its route or change a scheduled appointment.
        </p>
      </Panel>
      <ToSchedule
        items={
          workspace.error
            ? null
            : needsAction(workspace.data, today).filter(
                (item) => item.kind === "schedule",
              )
        }
        week={week}
        view={view}
      />
      {!jobs.length && (
        <Panel className="mb-6">
          <h2 className="font-semibold">No jobs this week</h2>
          <p>Choose another week or return to the job list.</p>
          <Link className={linkClass} href="/admin/jobs">
            Back to job list
          </Link>
        </Panel>
      )}
      {lanes.length > 0 ? (
        <>
          <div
            role="region"
            aria-label="Weekly schedule grid"
            tabIndex={0}
            className={cn(
              "hidden max-w-full overflow-x-auto rounded-2xl border bg-card lg:block",
              focusClass,
            )}
          >
            <table className="w-full min-w-[1200px] table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">
                {view === "workers" ? "Worker" : "Truck"} schedule,{" "}
                {formatDate(week.start)} through {formatDate(week.end)}. All
                times Central Time.
              </caption>
              <thead className="bg-surface">
                <tr>
                  <th
                    scope="col"
                    className="w-40 border-b border-r p-4 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase"
                  >
                    {view === "workers" ? "Worker" : "Truck"}
                  </th>
                  {week.dates.map((date) => (
                    <th
                      scope="col"
                      key={date}
                      aria-current={date === today ? "date" : undefined}
                      className={cn(
                        "border-b border-r p-4 text-[13px] font-semibold last:border-r-0",
                        date === today && "text-brand",
                      )}
                    >
                      <time dateTime={date}>{formatShortDate(date)}</time>
                      {date === today && (
                        <span className="mt-1 block font-normal">Today</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lanes.map((lane) => (
                  <tr key={lane.id}>
                    <th
                      scope="row"
                      className="border-b border-r p-4 align-top font-medium [overflow-wrap:anywhere]"
                    >
                      {lane.name}
                      {!lane.active && (
                        <span className="mt-1 block font-normal text-muted-foreground">
                          Inactive · history
                        </span>
                      )}
                    </th>
                    {week.dates.map((date) => {
                      const booked = lane.jobs.filter(
                        (job) => job.date === date,
                      );
                      return (
                        <td
                          key={date}
                          className="border-b border-r p-2 align-top last:border-r-0"
                        >
                          <div className="space-y-2">
                            {booked.length ? (
                              booked.map((job) => (
                                <JobCard
                                  key={job.id}
                                  job={job}
                                  lane={lane.name}
                                />
                              ))
                            ) : (
                              <span className="block px-1 py-2 text-muted-foreground">
                                No jobs
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div aria-label="Daily schedule" className="space-y-6 lg:hidden">
            {week.dates.map((date) => (
              <section key={date} aria-labelledby={"day-" + date}>
                <h2
                  id={"day-" + date}
                  className={cn(
                    "mb-3 font-semibold",
                    date === today && "text-brand",
                  )}
                >
                  <time dateTime={date}>{formatShortDate(date)}</time>
                  {date === today && " · Today"}
                </h2>
                <div className="space-y-4">
                  {lanes
                    .filter((lane) => lane.jobs.some((j) => j.date === date))
                    .map((lane) => (
                      <section key={lane.id} className="space-y-2">
                        <h3 className="text-sm font-medium">
                          {lane.name}
                          {!lane.active && " · Inactive · history"}
                        </h3>
                        {lane.jobs
                          .filter((j) => j.date === date)
                          .map((job) => (
                            <JobCard key={job.id} job={job} lane={lane.name} />
                          ))}
                      </section>
                    ))}
                </div>
                {!jobs.some((j) => j.date === date) && (
                  <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
                    No jobs.
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      ) : (
        <Panel>
          <p>No {view === "workers" ? "workers" : "trucks"} to display.</p>
        </Panel>
      )}
    </>
  );
}

/**
 * Accepted moves without a job (Phase 8F), so they can be planned while
 * looking at the week. Scheduling still happens on the checked schedule form.
 */
function ToSchedule({
  items,
  week,
  view,
}: {
  items: QueueItem[] | null;
  week: { start: string; end: string };
  view: CalendarView;
}) {
  return (
    <Panel className="mb-6">
      <h2 className="font-semibold">To schedule ({items?.length ?? 0})</h2>
      {items === null ? (
        <p role="alert" className="text-sm">
          Accepted moves could not be loaded. Reload to try again.
        </p>
      ) : !items.length ? (
        <p className="text-sm">Every accepted move has a job.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const thisWeek =
              item.requestedDate >= week.start &&
              item.requestedDate <= week.end;
            const window = arrivalWindow(item.preferredWindow);
            return (
              <li
                key={item.moveId}
                className="space-y-2 rounded-[14px] bg-surface p-3.5 text-sm [overflow-wrap:anywhere]"
              >
                <p className="font-semibold">
                  {item.customer} ·{" "}
                  {moveReference(item.moveId, item.referenceNumber)}
                </p>
                <p>
                  Requested {formatDate(item.requestedDate)}
                  {window ? `, ${window.label.toLowerCase()}` : ""}
                  {thisWeek && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">
                      This week
                    </span>
                  )}
                </p>
                {item.urgent && (
                  <p className="text-warning">Waiting or moving soon</p>
                )}
                <div className="flex flex-wrap gap-x-4">
                  <Link
                    className={linkClass}
                    href={`/admin/estimates/${item.estimateId}/schedule`}
                  >
                    Schedule
                    <span className="sr-only"> {item.customer}</span>
                  </Link>
                  {!thisWeek && (
                    <Link
                      className={linkClass}
                      href={calendarHref(item.requestedDate, view)}
                    >
                      Show requested week
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
