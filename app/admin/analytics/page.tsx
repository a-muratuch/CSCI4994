import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardList,
  CircleCheck,
  Banknote,
  CalendarDays,
} from "lucide-react";
import { analyticsData } from "@/lib/analytics/data";
import {
  analyticsWeeks,
  acceptanceRate,
  barPercent,
} from "@/lib/analytics/model";
import { formatDate, formatMoney, formatMessageTime } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { cn } from "@/lib/utils";
import { Panel, PageHeading, linkClass } from "../admin-ui";
export const metadata: Metadata = { title: "Analytics" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const weeks = analyticsWeeks((await searchParams).weeks);
  const result = await analyticsData(weeks);
  if (result.state !== "ready")
    return (
      <>
        <PageHeading
          title="Analytics"
          description="A clearer view of requests, bookings and team workload."
        />
        {result.state === "setup" ? (
          <Panel>
            <h2 className="font-semibold">Analytics setup pending</h2>
            <p>
              The database update needs owner approval before this page can show
              saved results.
            </p>
          </Panel>
        ) : (
          <RecordsUnavailable title="Analytics unavailable" />
        )}
      </>
    );
  const a = result.summary,
    rate = acceptanceRate(a.requests, a.acceptedRequests);
  const max = Math.max(1, ...a.weekly.flatMap((w) => [w.requests, w.jobs]));
  const maxHours = Math.max(1, ...a.crew.map((c) => c.hours));
  const metrics = [
    {
      label: "Move requests",
      value: a.requests.toLocaleString(),
      detail: "Created in this period",
      icon: ClipboardList,
    },
    {
      label: "Request acceptance",
      value: rate === null ? "—" : `${rate}%`,
      detail: `${a.acceptedRequests} of ${a.requests} requests`,
      icon: CircleCheck,
    },
    {
      label: "Total accepted estimate value",
      value: formatMoney(a.acceptedCents),
      detail: `${a.acceptedCount} accepted ${a.acceptedCount === 1 ? "estimate" : "estimates"} · not payments collected`,
      icon: Banknote,
    },
    {
      label: "Scheduled jobs",
      value: a.jobs.toLocaleString(),
      detail: "By appointment date · excludes cancelled",
      icon: CalendarDays,
    },
  ];
  return (
    <>
      <PageHeading
        title="Analytics"
        description="A clearer view of requests, bookings and team workload."
        actions={
          <nav
            aria-label="Analytics period"
            className="inline-flex flex-wrap gap-1 rounded-full border bg-card p-1"
          >
            {[4, 8, 12].map((n) => (
              <Link
                key={n}
                href={`/admin/analytics?weeks=${n}`}
                aria-current={weeks === n ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: weeks === n ? "default" : "ghost",
                  }),
                  "min-h-11 px-4",
                )}
              >
                {n} weeks
              </Link>
            ))}
          </nav>
        }
      />
      <p className="mb-2 text-sm text-muted-foreground">
        {formatDate(a.start)} – {formatDate(a.end)} · Central Time
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        Current week is incomplete. Jobs include appointments through the end of
        this week.
      </p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Panel key={m.label} className="gap-2.5 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-normal text-muted-foreground">
                {m.label}
              </h2>
              <m.icon
                className="size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-4xl">
              {m.value}
            </p>
            <p className="text-sm text-muted-foreground">{m.detail}</p>
          </Panel>
        ))}
      </div>
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Weekly activity</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-2.5 rounded-full bg-foreground"
              />
              Requests
            </span>
            <span>
              <span
                aria-hidden="true"
                className="mr-2 inline-block size-2.5 rounded-full bg-brand"
              />
              Jobs
            </span>
          </div>
          <div
            role="img"
            aria-label="Weekly requests and jobs. Exact values are in the data table below."
            className="flex h-56 min-w-0 items-end gap-1 border-b pt-4 sm:gap-2"
          >
            {a.weekly.map((w) => (
              <div
                key={w.date}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 sm:gap-1"
              >
                <div
                  title={`${w.requests} requests`}
                  className="w-5 max-w-[40%] rounded-t-sm bg-foreground"
                  style={{ height: `${barPercent(w.requests, max)}%` }}
                />
                <div
                  title={`${w.jobs} jobs`}
                  className="w-5 max-w-[40%] rounded-t-sm bg-brand"
                  style={{ height: `${barPercent(w.jobs, max)}%` }}
                />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="flex justify-between gap-2 text-xs text-muted-foreground"
          >
            <span>{formatDate(a.weekly[0].date)}</span>
            <span className="text-right">
              {formatDate(a.weekly[a.weekly.length - 1].date)}
            </span>
          </div>
          {!a.weekly.some((w) => w.requests || w.jobs) && (
            <p className="text-sm text-muted-foreground">
              No requests or appointments in this period.
            </p>
          )}
          <details className="text-sm">
            <summary className={cn(linkClass, "cursor-pointer")}>
              View weekly data
            </summary>
            <table className="w-full text-left">
              <caption className="sr-only">
                Weekly activity in Central Time
              </caption>
              <thead>
                <tr className="border-b">
                  <th scope="col" className="py-2">
                    Week of
                  </th>
                  <th scope="col" className="text-right">
                    Requests
                  </th>
                  <th scope="col" className="text-right">
                    Jobs
                  </th>
                </tr>
              </thead>
              <tbody>
                {a.weekly.map((w) => (
                  <tr key={w.date} className="border-b">
                    <th scope="row" className="py-2 font-normal">
                      {formatDate(w.date)}
                    </th>
                    <td className="text-right tabular-nums">{w.requests}</td>
                    <td className="text-right tabular-nums">{w.jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Panel>
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Request progress</h2>
          <p className="text-sm text-muted-foreground">
            How far requests created in this period have progressed as of now.
          </p>
          <dl className="space-y-5">
            {[
              "Requests",
              "Estimate published",
              "Accepted",
              "Scheduled",
              "Completed",
            ].map((label, i) => (
              <div key={label}>
                <div className="mb-2 flex justify-between gap-4 text-sm">
                  <dt>{label}</dt>
                  <dd className="font-medium tabular-nums">{a.funnel[i]}</dd>
                </div>
                <div aria-hidden="true" className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-foreground"
                    style={{ width: `${barPercent(a.funnel[i], a.requests)}%` }}
                  />
                </div>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">
            Stages count each request once. Scheduled includes appointments
            later cancelled; cancelled appointments are excluded from job
            totals.
          </p>
          <Link href="/admin/requests" className={linkClass}>
            Review requests →
          </Link>
        </Panel>
      </div>
      <Panel className="p-5 sm:p-6">
        <div>
          <h2 className="text-[17px] font-semibold">Crew workload</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Planned work hours by appointment date · not actual hours worked
          </p>
        </div>
        {!a.crew.length ? (
          <p className="text-sm text-muted-foreground">
            No crew assignments in this period.
          </p>
        ) : (
          <ul className="space-y-5">
            {a.crew.map((c) => (
              <li
                key={c.id}
                className="grid items-center gap-2 sm:grid-cols-[minmax(100px,180px)_minmax(0,1fr)_auto]"
              >
                <span className="text-sm font-medium [overflow-wrap:anywhere]">
                  {c.name}
                  {!c.active && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · Inactive
                    </span>
                  )}
                </span>
                <div aria-hidden="true" className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-foreground"
                    style={{ width: `${barPercent(c.hours, maxHours)}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums">
                  {c.hours.toLocaleString()} hrs · {c.jobs}{" "}
                  {c.jobs === 1 ? "job" : "jobs"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Shared jobs contribute hours to each assigned worker. Historical
          availability is not recorded, so these bars show workload rather than
          utilization.
        </p>
        <Link href="/admin/jobs/calendar" className={linkClass}>
          Open week calendar →
        </Link>
      </Panel>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          Accepted value uses acceptance dates, independently of request
          creation dates.
        </p>
        <p>Updated {formatMessageTime(a.asOf)}</p>
      </div>
    </>
  );
}
