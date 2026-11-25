import { shortReference } from "@/lib/reference";
import { declineReasonLabel } from "@/lib/estimates/decline";

import { notFound } from "next/navigation";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { EstimateForm } from "../../../estimate-form";
import { ProposalPanel } from "../proposal-panel";
import { PageHeading, Panel, ActionLink } from "../../../admin-ui";
export function EditEstimate({
  data,
  id,
}: {
  data: EstimateWorkspace;
  id: string;
}) {
  const state = data;
  const estimate = state.estimates.find((e) => e.id === id);
  if (!estimate) notFound();
  const move = state.moves.find((m) => m.id === estimate.requestId);
  // A revision follows a declined version: show why at the top.
  const declined = state.estimates
    .filter(
      (e) =>
        e.requestId === estimate.requestId &&
        e.id !== id &&
        e.status === "declined" &&
        (e.version ?? 1) < (estimate.version ?? 1),
    )
    .sort((a, b) => (b.version ?? 1) - (a.version ?? 1))[0];
  if (
    estimate.status !== "draft" ||
    state.moves.find((m) => m.id === estimate.requestId)?.stage === "cancelled"
  )
    return (
      <Panel>
        <h1 className="text-xl font-semibold">This estimate is read-only</h1>
        <ActionLink href={"/admin/estimates/" + id}>View estimate</ActionLink>
      </Panel>
    );
  return (
    <>
      <PageHeading
        title="Edit draft"
        description={`Estimate ${shortReference(id)} · version ${estimate.version ?? 1}`}
      />
      {declined?.declineReason && (
        <section
          aria-labelledby="revision-reason"
          className="mb-5 rounded-2xl border border-warning/30 bg-warning-surface p-5 text-sm leading-6"
        >
          <h2 id="revision-reason" className="font-semibold text-warning">
            Customer asked for changes:{" "}
            {declineReasonLabel(declined.declineReason)}
          </h2>
          {declined.declineNote && (
            <p className="mt-1 whitespace-pre-wrap text-foreground/80 [overflow-wrap:anywhere]">
              “{declined.declineNote}”
            </p>
          )}
          <p className="mt-1 text-muted-foreground">
            From version {declined.version ?? 1}. Revise the lines below before
            publishing again.
          </p>
        </section>
      )}
      <EstimateForm
        key={id}
        requestId={estimate.requestId}
        estimate={estimate}
        proposal={
          <ProposalPanel
            estimateId={id}
            status={estimate.status}
            requestedDate={move?.requestedDate ?? ""}
            preferredWindow={move?.preferredWindow}
          />
        }
      />
    </>
  );
}
