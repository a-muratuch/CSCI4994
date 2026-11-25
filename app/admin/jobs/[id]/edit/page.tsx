import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jobWorkspace } from "@/lib/jobs/data";
import { EditJob } from "./edit-job";
export default async function Page({
  params,
}: PageProps<"/admin/jobs/[id]/edit">) {
  const { id } = await params;
  const result = await jobWorkspace({ jobId: id });
  if (result.error) return <RecordsUnavailable title="Schedules unavailable" />;
  if (!result.data.jobs.some((job) => job.id === id)) notFound();
  return <EditJob data={result.data} id={id} />;
}

export const metadata: Metadata = { title: "Edit schedule" };
