import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { estimateWorkspace } from "@/lib/estimates/data";
import { EditEstimate } from "./edit-estimate";

export default async function Page({
  params,
}: PageProps<"/admin/estimates/[id]/edit">) {
  const { id } = await params;
  const result = await estimateWorkspace("admin", { estimateId: id });
  if (result.error) return <RecordsUnavailable title="Records unavailable" />;
  if (result.partial)
    return <RecordsUnavailable title="Record needs review" partial />;
  if (!result.data.estimates.some((estimate) => estimate.id === id)) notFound();
  return (
    <>
      {result.partial && <RecordsUnavailable partial />}
      {<EditEstimate data={result.data} id={id} />}
    </>
  );
}

export const metadata: Metadata = { title: "Edit estimate" };
