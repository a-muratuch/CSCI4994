import { NotificationReceipt } from "@/components/notifications/receipt";
import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { EstimateDetails } from "./estimate-details";
import { estimateChangesReady } from "@/lib/estimates/defaults";

export default async function Page({
  params,
}: PageProps<"/customer/estimates/[id]">) {
  const { id } = await params;
  const result = await estimateWorkspace("customer", { estimateId: id });
  if (result.error)
    return (
      <RecordsUnavailable
        title="Estimates unavailable"
        href="/customer/estimates"
        linkLabel="Back to estimates"
      />
    );
  if (result.partial)
    return <RecordsUnavailable title="Record needs review" partial />;
  if (!result.data.estimates.some((estimate) => estimate.id === id)) notFound();
  return (
    <>
      <NotificationReceipt />
      {result.partial && <RecordsUnavailable partial />}
      {
        <EstimateDetails
          askReason={await estimateChangesReady()}
          id={id}
          data={{ estimates: result.data.estimates, moves: result.data.moves }}
        />
      }
    </>
  );
}

export const metadata: Metadata = { title: "Estimate details" };
