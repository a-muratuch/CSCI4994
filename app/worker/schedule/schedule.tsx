import {
  formatArrival,
  formatTimeRange,
  formatShortDate as dateLabel,
  formatWork,
} from "@/lib/format";
import { moveTitle } from "@/lib/reference";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { dayForJob } from "@/lib/domain";
import type { WorkerWorkspace } from "@/lib/workers/data";
import { Heading, StatusBadge, linkClass, panelClass } from "../worker-ui";

export default function SchedulePage({ jobs, availability }: WorkerWorkspace) {
  const scheduled = jobs
    .filter((job) => job.status !== "completed" && job.status !== "cancelled")
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return (
    <>
      <Heading title="Your schedule">All times Central Time.</Heading>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className={panelClass}>
          <h2 className="text-[17px] font-semibold">Assigned appointments</h2>
          {!scheduled.length ? (
            <div className="space-y-2">
              <p className="font-medium">No active appointments</p>
              <p className="text-sm text-muted-foreground">
                Completed and cancelled jobs remain in history. Only an admin
                can assign another appointment.
              </p>
              <Link href="/worker/history" className={linkClass}>
                View job history
              </Link>
            </div>
          ) : (
            <ul aria-label="Assigned appointments" className="divide-y">
              {scheduled.map((job) => {
                const preference = availability.find(
                  (row) => row.day === dayForJob(job),
                );
                const outside =
                  !preference?.available ||
                  job.start < preference.start ||
                  job.end > preference.end;
                return (
                  <li
                    key={job.id}
                    className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[minmax(130px,190px)_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <span className="text-sm font-medium">
                      {dateLabel(job.date)}
                      {job.returnDate && ` – ${dateLabel(job.returnDate)}`}
                    </span>
                    <span className="min-w-0 text-sm">
                      <Link
                        href={`/worker/jobs/${job.id}`}
                        className={`${linkClass} font-semibold no-underline hover:underline [overflow-wrap:anywhere]`}
                      >
                        {job.customer} · {moveTitle(job)}
                      </Link>
                      <span className="block text-muted-foreground">
                        {job.returnDate
                          ? `Long distance · work ${formatWork(job)}`
                          : `${formatArrival(job.arrival)} arrival · work ${formatWork(job)}`}{" "}
                        · {job.truck}
                      </span>
                      {outside && (
                        <span className="mt-2 block rounded-xl bg-warning-surface px-3 py-2 leading-6 text-warning">
                          Outside your saved availability. This appointment
                          remains assigned; an admin would need to review any
                          change.
                        </span>
                      )}
                    </span>
                    <span>
                      <StatusBadge status={job.status} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-semibold">
              Saved weekly availability
            </h2>
            <Link
              href="/worker/availability"
              className={linkClass}
              aria-label="Edit availability"
            >
              Edit
            </Link>
          </div>
          <dl className="space-y-2.5">
            {availability.map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap justify-between gap-2 text-sm"
              >
                <dt>{row.day.slice(0, 3)}</dt>
                <dd
                  className={
                    row.available ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {row.available
                    ? formatTimeRange(row.start, row.end)
                    : "Unavailable"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] leading-5 text-muted-foreground">
            Changing availability doesn&apos;t move jobs you&apos;re already
            assigned. Dates, crews and trucks stay under admin control.
          </p>
        </Card>
      </div>
    </>
  );
}
