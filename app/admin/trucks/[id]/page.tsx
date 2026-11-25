import { RecordsUnavailable } from "@/components/records-unavailable";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminTrucks } from "@/lib/profiles/admin-trucks";
import { estimateWorkspace } from "@/lib/estimates/data";
import { JobLinks, PageHeading, Panel, linkClass } from "../../admin-ui";
import { shortReference } from "@/lib/reference";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

import { TruckAvailability } from "../truck-availability";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await adminTrucks(id);
  if (result.error)
    return (
      <RecordsUnavailable
        title="Truck records unavailable"
        href="/admin/trucks"
        linkLabel="Back to trucks"
      />
    );
  const truck = result.trucks[0];
  if (!truck) notFound();
  const operations = await estimateWorkspace("admin");
  const jobs = operations.data.jobs.filter((job) => job.truckId === id);
  const active = jobs.find((j) => j.status === "in-progress");
  return (
    <>
      <Link href="/admin/trucks" className={cn(linkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Trucks
      </Link>
      <PageHeading
        eyebrow="Truck details"
        title={truck.name || "Truck"}
        badge={
          <span
            className={
              truck.active
                ? "rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success"
                : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold"
            }
          >
            {active
              ? `On job ${shortReference(active.id)}`
              : truck.active
                ? "Active"
                : "Inactive"}
          </span>
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <h2 className="text-[17px] font-semibold">Truck</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted-foreground">Name</dt>
                <dd className="mt-1 text-[15px]">{truck.name || "Truck"}</dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted-foreground">Status</dt>
                <dd className="mt-1 text-[15px]">
                  {truck.active ? "Active" : "Inactive"}
                </dd>
              </div>
            </dl>
          </Panel>
          {operations.error ? (
            <Panel>
              <p role="alert">
                Related jobs could not be loaded. Reload to try again.
              </p>
            </Panel>
          ) : (
            <JobLinks jobs={jobs} title="Assigned jobs" />
          )}
        </div>
        <div className="min-w-0">
          <TruckAvailability
            trucks={[truck]}
            error={operations.error}
            reservations={jobs
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
        </div>
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Truck details" };
