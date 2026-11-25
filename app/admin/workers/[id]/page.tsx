import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatTimeRange } from "@/lib/format";
import {
  adminWorkers,
  adminWorkerAvailability,
} from "@/lib/profiles/admin-workers";
import { estimateWorkspace } from "@/lib/estimates/data";
import { days } from "@/lib/domain";
import { JobLinks, PageHeading, Panel, linkClass } from "../../admin-ui";
import { shortReference } from "@/lib/reference";
import { OpenChat } from "@/components/messages/controls";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await adminWorkers(id);
  if (result.error)
    return (
      <RecordsUnavailable
        title="Worker records unavailable"
        href="/admin/workers"
        linkLabel="Back to workers"
      />
    );
  const worker = result.workers[0];
  if (!worker) notFound();
  const [preferences, operations] = await Promise.all([
    adminWorkerAvailability(id),
    estimateWorkspace("admin"),
  ]);
  const jobs = operations.data.jobs.filter((job) => job.workerIds.includes(id));
  const active = jobs.find((j) => j.status === "in-progress");
  const name = worker.name || "Worker";
  return (
    <>
      <Link href="/admin/workers" className={cn(linkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Workers
      </Link>
      <PageHeading
        eyebrow="Worker details"
        title={name}
        description="Read-only worker profile."
        badge={
          active && (
            <span className="rounded-full bg-warning-surface px-2.5 py-0.5 text-xs font-semibold text-warning">
              On job {shortReference(active.id)}
            </span>
          )
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {operations.error ? (
            <Panel>
              <p role="alert">
                Assigned jobs could not be loaded. Reload to try again.
              </p>
            </Panel>
          ) : (
            <JobLinks jobs={jobs} title="Assigned jobs and history" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-4">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                {initials(name)}
              </span>
              <p className="min-w-0 text-[17px] font-semibold [overflow-wrap:anywhere]">
                {name}
              </p>
            </div>
            <OpenChat kind="worker-support" target={id}>
              Message worker
            </OpenChat>
          </Panel>
          <Panel>
            <h2 className="text-[17px] font-semibold">
              Saved availability · CT
            </h2>
            {preferences.error ? (
              <p role="alert">
                Saved availability could not be loaded. Reload to try again.
              </p>
            ) : (
              <dl className="space-y-2 text-sm">
                {days.map((day) => {
                  const row = preferences.availability.find(
                    (item) => item.day === day,
                  );
                  return (
                    <div
                      key={day}
                      className="flex flex-wrap justify-between gap-2"
                    >
                      <dt>{day}</dt>
                      <dd
                        className={
                          row?.available ? "" : "text-muted-foreground"
                        }
                      >
                        {!row
                          ? "Not configured"
                          : row.available
                            ? formatTimeRange(row.start, row.end)
                            : "Unavailable"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )}
            <p className="text-[13px] text-muted-foreground">
              Only the worker edits these preferences. Changing them does not
              reassign or reschedule existing jobs.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const metadata: Metadata = { title: "Worker details" };
