import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { jobWorkspace } from "@/lib/jobs/data";
import { JobDetails } from "./job-details";
import { serverSupabase } from "@/lib/supabase/server";
import { loadScheduleOptions } from "@/lib/jobs/schedule-options";
import { checkSelection } from "@/lib/jobs/suggest";
import { MovePhotos } from "@/components/move-photos";
import { loadPhotos, photosReady } from "@/lib/photos/data";
import { crewProgressReady } from "@/lib/jobs/progress-data";
import { PhotoWaiver } from "./photo-waiver";
export default async function Page({ params }: PageProps<"/admin/jobs/[id]">) {
  const { id } = await params;
  const result = await jobWorkspace({ jobId: id });
  if (result.error) return <RecordsUnavailable title="Schedules unavailable" />;
  const job = result.data.jobs.find((j) => j.id === id);
  if (!job) notFound();
  // Warn when an upcoming job cannot be reached in time from the team's or
  // truck's previous job that day (Phase 7B travel rule). Advisory only.
  let travelWarnings: string[] = [];
  const assignment = result.data.assignments.find((a) => a.jobId === id);
  if (job.status === "scheduled" && assignment) {
    const day = await loadScheduleOptions(
      await serverSupabase(),
      job.estimateId,
      job.date,
      job.id,
    );
    if (day.state === "ready")
      travelWarnings = checkSelection(
        day.options,
        job.start,
        job.end,
        assignment.workerIds,
        assignment.truckId,
      ).blocking;
  }
  const photos = (await photosReady())
    ? await loadPhotos(job.requestId, job.id)
    : undefined;
  return (
    <JobDetails
      data={result.data}
      id={id}
      travelWarnings={travelWarnings}
      waiver={
        (job.status === "scheduled" || job.status === "in-progress") &&
        (await crewProgressReady()) && (
          <PhotoWaiver
            jobId={job.id}
            waived={!!job.photoWaived}
            waiverNote={job.photoWaiverNote}
            deliveryPhotos={
              (photos ?? []).filter(
                (photo) => photo.stage === "delivery" && photo.jobId === job.id,
              ).length
            }
          />
        )
      }
      photos={
        photos !== undefined && (
          <MovePhotos
            photos={photos}
            requestId={job.requestId}
            jobId={job.id}
            description="Customer photos and this crew's pickup and delivery condition photos."
          />
        )
      }
    />
  );
}

export const metadata: Metadata = { title: "Job details" };
