import { workflowReady } from "@/lib/workflow/data";
import { moveReference, shortReference } from "@/lib/reference";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";

import { notFound } from "next/navigation";
import type { JobWorkspace } from "@/lib/jobs/data";
import { JobForm } from "../../../job-form";
import { ActionLink, PageHeading, Panel, linkClass } from "../../../admin-ui";
export async function EditJob({
  data,
  id,
}: {
  data: JobWorkspace;
  id: string;
}) {
  const state = data;
  const job = state.jobs.find((j) => j.id === id);
  if (!job) notFound();
  if (job.status !== "scheduled")
    return (
      <Panel>
        <h1 className="text-xl font-semibold">This schedule is read-only</h1>
        <ActionLink href={"/admin/jobs/" + id}>View job</ActionLink>
      </Panel>
    );
  return (
    <>
      <Link href={"/admin/jobs/" + id} className={cn(linkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Job {shortReference(id)}
      </Link>
      <PageHeading
        title="Edit scheduled job"
        badge={<StatusBadge status={job.status} />}
        description={`${job.customer} · move ${moveReference(job.requestId, job.referenceNumber)}`}
      />
      <JobForm
        showBookings={await workflowReady()}
        key={id}
        estimateId={job.estimateId}
        job={job}
        data={{
          workers: data.workers,
          trucks: data.trucks,
          assignments: data.assignments,
          requestedDate:
            data.moves.find(
              (move) =>
                move.id ===
                data.estimates.find(
                  (estimate) => estimate.id === job.estimateId,
                )?.requestId,
            )?.requestedDate ?? "",
        }}
      />
    </>
  );
}
