import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { estimateWorkspace } from "@/lib/estimates/data";
import { AdminOverview } from "./admin-overview";

export const metadata: Metadata = { title: "Administrator" };

export default async function AdminPage() {
  const { data, error, partial } = await estimateWorkspace("admin");
  if (error) return <RecordsUnavailable title="Overview unavailable" />;
  return (
    <>
      {partial && <RecordsUnavailable partial />}
      {<AdminOverview data={data} />}
    </>
  );
}
