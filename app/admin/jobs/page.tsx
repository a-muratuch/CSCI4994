import { workflowReady } from "@/lib/workflow/data";
import { RecordList, type ListParams } from "../record-list";
import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { jobWorkspace } from "@/lib/jobs/data";
import { JobsList } from "./jobs-list";
import { JobViewLinks } from "./job-view-links";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  if (await workflowReady())
    return (
      <>
        <JobViewLinks />
        <RecordList kind="jobs" params={await searchParams} />
      </>
    );
  const result = await jobWorkspace();
  if (result.error) return <RecordsUnavailable title="Schedules unavailable" />;
  return (
    <>
      <JobViewLinks />
      <JobsList
        data={{
          moves: result.data.moves,
          estimates: result.data.estimates,
          jobs: result.data.jobs,
        }}
      />
    </>
  );
}

export const metadata: Metadata = { title: "Jobs & schedule" };
