import { NotificationReceipt } from "@/components/notifications/receipt";
import { assignedPhone } from "@/lib/workflow/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import View from "./job-details";
import { workerWorkspace } from "@/lib/workers/data";
import { WorkerLoadError } from "@/app/worker/worker-ui";
import { MovePhotos } from "@/components/move-photos";
import { loadPhotos, photosReady } from "@/lib/photos/data";
import { crewProgressReady } from "@/lib/jobs/progress-data";
import { chicagoToday } from "@/lib/requests/validation";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const workspace = await workerWorkspace((await params).id);
  if (workspace.error) return <WorkerLoadError />;
  if (!workspace.jobs.length) notFound();
  const job = workspace.jobs[0];
  const photos = (await photosReady())
    ? await loadPhotos(job.requestId, job.id)
    : undefined;
  return (
    <>
      <NotificationReceipt />
      <View
        jobs={workspace.jobs}
        phone={await assignedPhone(workspace.jobs[0].id)}
        progress={
          (await crewProgressReady())
            ? {
                deliveryPhotos: (photos ?? []).filter(
                  (photo) =>
                    photo.stage === "delivery" && photo.jobId === job.id,
                ).length,
                today: chicagoToday(),
              }
            : undefined
        }
        photos={
          photos !== undefined && (
            <MovePhotos
              photos={photos}
              requestId={job.requestId}
              jobId={job.id}
              uploadStages={
                job.status === "in-progress" ? ["pickup", "delivery"] : []
              }
              description={
                job.status === "in-progress"
                  ? "Record the condition of items at pickup and delivery."
                  : job.status === "scheduled"
                    ? "Customer photos. Condition photos can be added once the job is in progress."
                    : "Customer photos and this job's condition photos."
              }
            />
          )
        }
      />
    </>
  );
}

export const metadata: Metadata = { title: "Job details" };
