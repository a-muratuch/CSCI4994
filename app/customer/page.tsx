import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { CustomerOverview } from "./customer-overview";
export default async function CustomerPage() {
  const { data, error, partial } = await estimateWorkspace("customer");
  if (error) throw new Error("Customer overview unavailable");
  return (
    <>
      {partial && <RecordsUnavailable partial />}
      {<CustomerOverview data={data} />}
    </>
  );
}

export const metadata: Metadata = { title: "Customer overview" };
