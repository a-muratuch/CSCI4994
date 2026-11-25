import type { Metadata } from "next";
import {
  adminWorkers,
  adminWorkerAvailability,
} from "@/lib/profiles/admin-workers";
import { PageHeading, Panel } from "../admin-ui";
import { WorkersList } from "./workers-list";

export default async function Page() {
  const result = await adminWorkers();
  if (result.error)
    return (
      <>
        <PageHeading title="Workers" description="Saved worker profiles." />
        <Panel>
          <p role="alert">
            Worker profiles could not be loaded. Reload this page to try again.
          </p>
        </Panel>
      </>
    );
  // Each card shows the worker's saved weekly preference.
  const availability = await Promise.all(
    result.workers.map((worker) => adminWorkerAvailability(worker.id)),
  );
  return (
    <WorkersList
      workers={result.workers.map(({ id, name }, index) => ({
        id,
        name,
        availability: availability[index].error
          ? null
          : availability[index].availability,
      }))}
    />
  );
}

export const metadata: Metadata = { title: "Workers" };
