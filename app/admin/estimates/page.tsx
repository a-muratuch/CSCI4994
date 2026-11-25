import { workflowReady } from "@/lib/workflow/data";
import { RecordList, type ListParams } from "../record-list";
import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { EstimatesList } from "./estimates-list";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  if (await workflowReady())
    return <RecordList kind="estimates" params={await searchParams} />;
  const result = await estimateWorkspace("admin");
  if (result.error) return <RecordsUnavailable title="Records unavailable" />;
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      {
        <EstimatesList
          data={{ moves: result.data.moves, estimates: result.data.estimates }}
        />
      }
    </>
  );
}

export const metadata: Metadata = { title: "Estimates" };
