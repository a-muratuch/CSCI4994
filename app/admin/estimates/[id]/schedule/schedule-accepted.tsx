import { workflowReady } from "@/lib/workflow/data";
import { shortReference, requestReference } from "@/lib/reference";

import { notFound } from "next/navigation";
import type { JobWorkspace } from "@/lib/jobs/data";
import { JobForm } from "../../../job-form";
import { ActionLink, PageHeading, Panel } from "../../../admin-ui";
export async function ScheduleAccepted({
  data,
  id,
}: {
  data: JobWorkspace;
  id: string;
}) {
  const state = data;
  const estimate = state.estimates.find((e) => e.id === id);
  if (!estimate) notFound();
  const job = state.jobs.find((j) => j.requestId === estimate.requestId);
  if (estimate.status !== "accepted" || job)
    return (
      <Panel>
        <h1 className="text-xl font-semibold">
          {job
            ? "This request already has a job"
            : "Customer acceptance required"}
        </h1>
        <ActionLink
          href={job ? "/admin/jobs/" + job.id : "/admin/estimates/" + id}
        >
          View related record
        </ActionLink>
      </Panel>
    );
  return (
    <>
      <PageHeading
        title="Schedule accepted move"
        description={
          shortReference(id) +
          " · Request " +
          requestReference(estimate.requestId, state.moves)
        }
      />
      <JobForm
        showBookings={await workflowReady()}
        key={id}
        estimateId={id}
        data={{
          workers: data.workers,
          trucks: data.trucks,
          assignments: data.assignments,
          requestedDate:
            data.moves.find((move) => move.id === estimate.requestId)
              ?.requestedDate ?? "",
          preferredWindow: data.moves.find(
            (move) => move.id === estimate.requestId,
          )?.preferredWindow,
        }}
      />
    </>
  );
}
