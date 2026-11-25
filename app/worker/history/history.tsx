import Link from "next/link";
import type { WorkerWorkspace } from "@/lib/workers/data";
import { formatShortDate } from "@/lib/format";
import { moveTitle } from "@/lib/reference";
import { chicagoToday } from "@/lib/requests/validation";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Heading, StatusBadge, panelClass } from "../worker-ui";

export default function HistoryPage({ jobs }: WorkerWorkspace) {
  const closed = jobs
    .filter((job) => job.status === "completed" || job.status === "cancelled")
    .sort((a, b) => b.date.localeCompare(a.date));
  const completed = closed.filter((job) => job.status === "completed");
  const month = chicagoToday().slice(0, 7);
  return (
    <>
      <Heading title="Job history">
        Completed and cancelled assignments. Their team chats are read-only.
      </Heading>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Completed jobs" value={completed.length} />
        <StatCard
          label="This month"
          value={completed.filter((job) => job.date.startsWith(month)).length}
        />
        <StatCard label="Cancelled" value={closed.length - completed.length} />
      </div>
      <Card className={panelClass}>
        {!closed.length ? (
          <div className="py-6 text-center">
            <h2 className="font-semibold">No closed jobs yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Completed and cancelled jobs you worked on appear here.
            </p>
          </div>
        ) : (
          <ul aria-label="Closed jobs" className="-mx-2 flex flex-col">
            {closed.map((job) => (
              <li key={job.id} className="border-t first:border-t-0">
                <Link
                  href={`/worker/jobs/${job.id}`}
                  aria-label={`View job for ${job.customer}, ${formatShortDate(job.date)}`}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-2 py-3 hover:bg-muted",
                    focusClass,
                  )}
                >
                  <span className="w-32 shrink-0 text-sm text-muted-foreground">
                    {formatShortDate(job.date)}
                  </span>
                  <span className="min-w-0 flex-[1_1_14rem] text-sm">
                    <span className="block font-semibold [overflow-wrap:anywhere]">
                      {job.customer} · {moveTitle(job)}
                    </span>
                    <span className="text-muted-foreground">
                      {job.truck}
                      {job.crew.length > 0 &&
                        ` · crew ${job.crew.map((name) => name.split(/\s+/)[0]).join(", ")}`}
                      {job.photoWaived && " · photo waived by admin"}
                    </span>
                  </span>
                  <StatusBadge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
