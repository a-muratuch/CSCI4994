import { administrationReady } from "@/lib/administration/data";
import type { Metadata } from "next";
import { adminTrucks } from "@/lib/profiles/admin-trucks";
import { estimateWorkspace } from "@/lib/estimates/data";
import { PageHeading, Panel } from "../admin-ui";
import { TrucksList } from "./trucks-list";

export default async function Page() {
  const result = await adminTrucks();
  if (result.error)
    return (
      <>
        <PageHeading title="Trucks" description="Saved trucks." />
        <Panel>
          <p role="alert">Trucks could not be loaded. Reload to try again.</p>
        </Panel>
      </>
    );
  const operations = await estimateWorkspace("admin");
  return (
    <TrucksList
      management={await administrationReady()}
      trucks={result.trucks}
      error={operations.error}
      reservations={operations.data.jobs
        .filter((j) => j.status !== "cancelled")
        .map(({ id, truckId, date, start, end, returnDate }) => ({
          id,
          truckId,
          date,
          start,
          end,
          returnDate,
        }))}
    />
  );
}

export const metadata: Metadata = { title: "Trucks" };
