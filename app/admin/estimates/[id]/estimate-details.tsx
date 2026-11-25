"use client";
import { WorkflowAction } from "@/components/workflow-action";
import { declineReasonLabel } from "@/lib/estimates/decline";
import { shortReference, requestReference } from "@/lib/reference";

import { notFound } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { publishEstimate } from "@/lib/estimates/actions";
import {
  ActionLink,
  EstimateSummary,
  HistoryList,
  PageHeading,
  Panel,
} from "../../admin-ui";
export function EstimateDetails({
  data,
  id,
  canRevise,
  proposal,
}: {
  canRevise?: boolean;
  /** Proposed appointment panel, shown in the side column. */
  proposal?: React.ReactNode;
  data: Pick<EstimateWorkspace, "estimates" | "history"> & {
    moves: { id: string; referenceNumber?: number; stage?: string }[];
    jobs: { id: string; estimateId: string }[];
  };
  id: string;
}) {
  const state = data;
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const estimate = state.estimates.find((e) => e.id === id);
  const job = state.jobs.find((j) => j.estimateId === id);
  if (!estimate) notFound();
  return (
    <>
      <PageHeading
        eyebrow={`Estimate ${shortReference(id)} · version ${estimate.version ?? 1} · request ${requestReference(estimate.requestId, state.moves)}`}
        title={
          estimate.status === "draft" ? "Review estimate" : "Estimate details"
        }
        badge={<StatusBadge status={estimate.status} />}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel
            className={cn(
              estimate.status === "declined" &&
                "border-warning/30 bg-warning-surface",
            )}
          >
            <h2 className="text-[17px] font-semibold">Next step</h2>
            {state.moves.find((m) => m.id === estimate.requestId)?.stage ===
            "cancelled" ? (
              <p>The request was cancelled. This estimate is read-only.</p>
            ) : estimate.status === "draft" ? (
              <>
                <p className="text-sm leading-6">
                  Review all prices, scope, and terms before making this
                  estimate visible to the customer. Publication locks this
                  estimate.
                </p>
                <ActionLink href={"/admin/estimates/" + id + "/edit"} outline>
                  Edit draft
                </ActionLink>
                <Button
                  className="min-h-11 whitespace-normal"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await publishEstimate(
                        id,
                        estimate.revision,
                      ).catch(() => ({
                        ok: false,
                        message:
                          "Publication could not be confirmed. Refresh before retrying.",
                      }));
                      setMessage(r.message);
                      requestAnimationFrame(() => feedback.current?.focus());
                    })
                  }
                >
                  Make estimate available
                </Button>
              </>
            ) : estimate.status === "accepted" ? (
              job ? (
                <ActionLink href={"/admin/jobs/" + job.id}>
                  View confirmed job
                </ActionLink>
              ) : (
                <>
                  <p className="text-sm">
                    Accepted. An administrator must confirm the date, crew and
                    truck.
                  </p>
                  <ActionLink href={"/admin/estimates/" + id + "/schedule"}>
                    Schedule accepted move
                  </ActionLink>
                </>
              )
            ) : (
              <p className="text-sm">
                {estimate.status === "declined"
                  ? canRevise && estimate.isCurrent !== false
                    ? "Customer declined. Revise the estimate to send the customer a new version."
                    : "Customer declined. Follow up with the customer before preparing a new estimate."
                  : "Awaiting the customer's decision. Admins cannot accept on the customer's behalf."}
              </p>
            )}
            {estimate.status === "declined" && estimate.declineReason && (
              <div className="rounded-xl bg-background/70 p-3 text-sm leading-6">
                <p className="font-medium">
                  Customer&apos;s reason:{" "}
                  {declineReasonLabel(estimate.declineReason)}
                </p>
                {estimate.declineNote && (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    “{estimate.declineNote}”
                  </p>
                )}
              </div>
            )}
            <p
              role="status"
              tabIndex={-1}
              ref={feedback}
              className="rounded-sm text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {message}
            </p>
            {canRevise &&
              estimate.status === "declined" &&
              estimate.isCurrent !== false && (
                <WorkflowAction
                  kind="revise-estimate"
                  id={estimate.id}
                  revision={estimate.revision}
                />
              )}
            <p className="text-sm text-muted-foreground">
              Version {estimate.version ?? 1}
              {estimate.isCurrent === false ? " · Previous estimate" : ""}
            </p>
            <ActionLink href={"/admin/requests/" + estimate.requestId} outline>
              View related request
            </ActionLink>
          </Panel>
          <EstimateSummary estimate={estimate} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {estimate.status !== "draft" && proposal}
          <HistoryList
            entries={state.history.filter(
              (h) => h.entity === "estimate" && h.recordId === id,
            )}
          />
        </div>
      </div>
      {/* A draft's proposal is the full schedule form: give it the width. */}
      {estimate.status === "draft" && proposal && (
        <div className="mt-5">{proposal}</div>
      )}
    </>
  );
}
