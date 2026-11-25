import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { EstimatesList } from "./estimates-list";
export default async function Page() {
  const result = await estimateWorkspace("customer");
  if (result.error) return <RecordsUnavailable title="Estimates unavailable" />;
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      {<EstimatesList data={result.data} />}
    </>
  );
}

export const metadata: Metadata = { title: "Estimates" };
