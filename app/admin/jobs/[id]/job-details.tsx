import { WorkflowAction } from "@/components/workflow-action";
import { workflowReady } from "@/lib/workflow/data";
import { formatDate, formatArrival, formatWork } from "@/lib/format";
import { moveReference, shortReference } from "@/lib/reference";
import { OpenChat } from "@/components/messages/controls";
import { notFound } from "next/navigation";
import type { JobWorkspace } from "@/lib/jobs/data";
import { StatusBadge } from "@/components/status-badge";
import { ProgressSteps } from "@/components/progress-steps";
import { workerProgressFor } from "@/lib/domain/status";
import { ActionLink, HistoryList, PageHeading, Panel } from "../../admin-ui";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function JobDetails({
  data,
  id,
  travelWarnings = [],
  waiver,
  photos,
}: {
  data: JobWorkspace;
  id: string;
  travelWarnings?: string[];
  /** Delivery-photo waiver panel, when crew progress is available. */
  waiver?: React.ReactNode;
  /** Photos panel, when photos are available. */
  photos?: React.ReactNode;
}) {
  const state = data;
  const job = state.jobs.find((j) => j.id === id);
  if (!job) notFound();
  const assignment = state.assignments.find((a) => a.jobId === id)!;
  const crew = assignment.workerIds.map(
    (workerId) =>
      state.workers.find((w) => w.id === workerId)?.name ?? "Worker",
  );
  return (
    <>
      <PageHeading
        eyebrow={`Job ${shortReference(id)} · request ${moveReference(job.requestId, job.referenceNumber)}`}
        title={job.customer}
        badge={<StatusBadge status={job.status} />}
        actions={
          job.status === "scheduled" && (
            <ActionLink href={"/admin/jobs/" + id + "/edit"}>
              Edit schedule & assignments
            </ActionLink>
          )
        }
      />
      {travelWarnings.length > 0 && (
        <div
          role="status"
          className="mb-5 space-y-1 rounded-2xl bg-warning-surface p-4 text-sm text-warning"
        >
          <p className="font-semibold">Tight travel</p>
          {travelWarnings.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p>Edit the job to change the time or team.</p>
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {job.status !== "cancelled" && (
            <Panel>
              <h2 className="text-[17px] font-semibold">Progress</h2>
              <ProgressSteps
                label="Job progress"
                steps={workerProgressFor(job)}
              />
            </Panel>
          )}
          <Panel>
            <h2 className="text-[17px] font-semibold">
              Schedule and assignments
            </h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Confirmed date", formatDate(job.date)],
                ["Arrival window", formatArrival(job.arrival)],
                ["Scheduled work", formatWork(job)],
                ["Truck", job.truck],
                ["Route", `${job.pickup} → ${job.destination}`],
                ["Customer", job.customer],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-[15px] leading-6 [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="mb-2 text-[13px] text-muted-foreground">Crew</h3>
              <ul className="flex flex-wrap gap-2">
                {crew.map((name) => (
                  <li
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border bg-surface py-1 pr-3 pl-1 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
                    >
                      {initials(name)}
                    </span>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <OpenChat kind="move-team" target={job.id}>
                {job.status === "completed" || job.status === "cancelled"
                  ? "View move-team chat"
                  : "Open move-team chat"}
              </OpenChat>
              <ActionLink href={"/admin/requests/" + job.requestId} outline>
                Request {moveReference(job.requestId, job.referenceNumber)}
              </ActionLink>
              <ActionLink href={"/admin/estimates/" + job.estimateId} outline>
                Accepted estimate {shortReference(job.estimateId)}
              </ActionLink>
            </div>
            {(await workflowReady()) && (
              <WorkflowAction
                available={job.status === "scheduled"}
                kind="cancel-job"
                id={job.id}
                revision={job.revision}
              />
            )}
            {job.status !== "scheduled" && (
              <p className="text-sm text-muted-foreground">
                Scheduling is read-only once work begins. Only assigned workers
                report progress; completed jobs cannot be reopened.
              </p>
            )}
          </Panel>
          {photos}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {waiver}
          <HistoryList entries={job.history} />
        </div>
      </div>
    </>
  );
}
