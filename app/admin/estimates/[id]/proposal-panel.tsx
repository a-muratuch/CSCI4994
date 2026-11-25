import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { bookingReady } from "@/lib/estimates/defaults";
import { jobWorkspace } from "@/lib/jobs/data";
import { workflowReady } from "@/lib/workflow/data";
import { formatDate } from "@/lib/format";
import { JobForm } from "../../job-form";
import { Panel } from "../../admin-ui";

/**
 * Phase 8E: on a draft, propose an appointment with the estimate; afterwards,
 * show what was proposed. Hidden until the booking migration is applied.
 */
export async function ProposalPanel({
  estimateId,
  status,
  requestedDate,
  preferredWindow,
}: {
  estimateId: string;
  status: string;
  requestedDate: string;
  preferredWindow?: string | null;
}) {
  if (!(await bookingReady())) return null;
  const client = await serverSupabase();
  const { data: row, error } = await client
    .from("estimate_proposals")
    .select("*")
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (error) {
    logFailure("estimates:proposal", error);
    return (
      <Panel className="mt-5">
        <p role="alert">The proposed appointment could not be loaded.</p>
      </Panel>
    );
  }
  const saved = row
    ? {
        date: row.scheduled_date,
        start: row.start_time.slice(0, 5),
        end: row.end_time.slice(0, 5),
        arrivalStart: row.arrival_start.slice(0, 5),
        arrivalEnd: row.arrival_end.slice(0, 5),
        workerIds: row.worker_ids,
        truckId: row.truck_id,
        ...("return_date" in row && row.return_date
          ? { endDate: row.end_date, returnDate: row.return_date }
          : {}),
      }
    : null;
  if (status !== "draft")
    return saved ? (
      <Panel className="mt-5">
        <h2 className="font-semibold">Proposed appointment</h2>
        <p className="text-sm leading-6">
          {formatDate(saved.date)} · work {saved.start}–{saved.end}
          {saved.returnDate
            ? ` (delivery ${formatDate(saved.endDate!)}, crew back ${formatDate(saved.returnDate)})`
            : ""}{" "}
          · arrival {saved.arrivalStart}–{saved.arrivalEnd} (CT). Booked
          automatically on acceptance only if the crew and truck were still
          free.
        </p>
      </Panel>
    ) : null;
  const workspace = await jobWorkspace({ estimateId });
  if (workspace.error)
    return (
      <Panel className="mt-5">
        <p role="alert">Crews and trucks could not be loaded.</p>
      </Panel>
    );
  return (
    <div className="mt-5">
      <JobForm
        key={row?.created_at ?? "new"}
        estimateId={estimateId}
        showBookings={await workflowReady()}
        proposal={{ saved }}
        data={{
          workers: workspace.data.workers,
          trucks: workspace.data.trucks,
          assignments: workspace.data.assignments,
          requestedDate,
          preferredWindow,
        }}
      />
    </div>
  );
}
