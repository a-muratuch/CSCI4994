"use client";
import { TruckEditor } from "../management-controls";
import { useState } from "react";
import { Truck } from "lucide-react";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { SavedTruck } from "@/lib/profiles/admin-trucks";
import { TruckAvailability, type TruckReservation } from "./truck-availability";
import { ActionLink, PageHeading, Panel } from "../admin-ui";

export function TrucksList({
  trucks,
  management,
  reservations,
  error,
}: {
  trucks: SavedTruck[];
  management: boolean;
  reservations: TruckReservation[];
  error: boolean;
}) {
  const [search, setSearch] = useState("");
  const rows = trucks.filter((row) =>
    `${row.name || "Truck"} ${row.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Trucks"
        description="Review trucks, assignments and availability."
      />
      {management && (
        <Panel>
          <h2 className="font-semibold">Add a truck</h2>
          <TruckEditor />
        </Panel>
      )}
      <FilterBar
        role="search"
        aria-label="Search trucks"
        onSubmit={(event) => event.preventDefault()}
        className="mt-5"
      >
        <FilterField label="Search trucks" className="flex-[1_1_16rem]">
          <Input
            id="directory-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>
      </FilterBar>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "truck" : "trucks"}.
      </p>
      <TruckAvailability
        trucks={trucks.filter((t) => t.active)}
        reservations={reservations}
        error={error}
      />
      {!rows.length && (
        <Panel className="mt-5">
          <p>{trucks.length ? "No matching trucks." : "No trucks yet."}</p>
        </Panel>
      )}
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const booked = reservations.filter(
            (r) => r.truckId === row.id,
          ).length;
          return (
            <li key={row.id}>
              <Panel className="h-full gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted"
                  >
                    <Truck className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold [overflow-wrap:anywhere]">
                      {row.name || "Truck"}
                    </h2>
                    <p className="text-[13px] text-muted-foreground">
                      {booked} {booked === 1 ? "booking" : "bookings"} on file
                    </p>
                  </div>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      row.active
                        ? "bg-success-surface text-success"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </div>
                {management && <TruckEditor key={row.id} truck={row} />}
                <div className="mt-auto">
                  <ActionLink href={`/admin/trucks/${row.id}`} outline>
                    View {row.name || "Truck"}
                  </ActionLink>
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>
    </>
  );
}
