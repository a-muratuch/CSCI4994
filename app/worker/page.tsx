import type { Metadata } from "next";
import View from "./assigned-jobs";
import { workerWorkspace } from "@/lib/workers/data";
import { WorkerLoadError } from "@/app/worker/worker-ui";
import { crewProgressReady } from "@/lib/jobs/progress-data";
import { chicagoToday } from "@/lib/requests/validation";
export default async function Page() {
  const workspace = await workerWorkspace();
  if (workspace.error) return <WorkerLoadError />;
  return (
    <View
      jobs={workspace.jobs}
      today={chicagoToday()}
      progressReady={await crewProgressReady()}
    />
  );
}

export const metadata: Metadata = { title: "Assigned jobs" };
