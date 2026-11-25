import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jobWorkspace } from "@/lib/jobs/data";
import { ScheduleAccepted } from "./schedule-accepted";
export default async function Page({
  params,
}: PageProps<"/admin/estimates/[id]/schedule">) {
  const { id } = await params;
  const result = await jobWorkspace({ estimateId: id });
  if (result.error) return <RecordsUnavailable title="Schedules unavailable" />;
  if (!result.data.estimates.some((estimate) => estimate.id === id)) notFound();
  return <ScheduleAccepted data={result.data} id={id} />;
}

export const metadata: Metadata = { title: "Schedule accepted move" };
