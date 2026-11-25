import { workflowReady } from "@/lib/workflow/data";
import { NotificationReceipt } from "@/components/notifications/receipt";
import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { EstimateDetails } from "./estimate-details";
import { ProposalPanel } from "./proposal-panel";

export default async function Page({
  params,
}: PageProps<"/admin/estimates/[id]">) {
  const { id } = await params;
  const result = await estimateWorkspace("admin", { estimateId: id });
  if (result.error) return <RecordsUnavailable title="Records unavailable" />;
  if (result.partial)
    return <RecordsUnavailable title="Record needs review" partial />;
  const estimate = result.data.estimates.find((item) => item.id === id);
  if (!estimate) notFound();
  const move = result.data.moves.find((m) => m.id === estimate.requestId);
  return (
    <>
      <NotificationReceipt />
      {result.partial && <RecordsUnavailable partial />}
      {
        <EstimateDetails
          data={{
            estimates: result.data.estimates,
            history: result.data.history,
            moves: result.data.moves.map(({ id, referenceNumber, stage }) => ({
              id,
              referenceNumber,
              stage,
            })),
            jobs: result.data.jobs.map(({ id, estimateId }) => ({
              id,
              estimateId,
            })),
          }}
          canRevise={await workflowReady()}
          id={id}
          proposal={
            move?.stage !== "cancelled" && (
              <ProposalPanel
                estimateId={id}
                status={estimate.status}
                requestedDate={move?.requestedDate ?? ""}
                preferredWindow={move?.preferredWindow}
              />
            )
          }
        />
      }
    </>
  );
}

export const metadata: Metadata = { title: "Estimate details" };
