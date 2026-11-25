"use client";
import { shortReference } from "@/lib/reference";

import { formatTimeRange } from "@/lib/format";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { intervalError, overlaps } from "@/lib/domain";
import type { SavedTruck } from "@/lib/profiles/admin-trucks";
import { ActionLink, Panel } from "../admin-ui";
export type TruckReservation = {
  id: string;
  truckId: string;
  date: string;
  start: string;
  end: string;
  /** Phase 9: long-distance trips keep the truck until this day. */
  returnDate?: string | null;
};
export function TruckAvailability({
  trucks,
  reservations,
  error,
}: {
  trucks: SavedTruck[];
  reservations: TruckReservation[];
  error: boolean;
}) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const problem = intervalError(date, start, end);
  return (
    <Panel className="mb-5">
      <h2 className="font-semibold">Check truck availability</h2>
      <p className="text-sm text-muted-foreground">
        Choose a date and same-day work interval in Central Time. Availability
        is based on saved assignments loaded with this page; refresh for the
        latest records. This does not reserve a truck.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            id: "truck-date",
            label: "Date (CT)",
            type: "date",
            value: date,
            set: setDate,
          },
          {
            id: "truck-start",
            label: "Work start (CT)",
            type: "time",
            value: start,
            set: setStart,
          },
          {
            id: "truck-end",
            label: "Work end (CT)",
            type: "time",
            value: end,
            set: setEnd,
          },
        ].map((f) => (
          <div key={f.id} className="min-w-0 space-y-2">
            <Label htmlFor={f.id}>{f.label}</Label>
            <Input
              id={f.id}
              className="min-h-11"
              type={f.type}
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              aria-describedby="truck-result"
            />
          </div>
        ))}
      </div>
      <div id="truck-result" role="status" className="space-y-3 text-sm">
        {error ? (
          <p role="alert">
            Saved assignments could not be loaded. Reload before checking
            availability.
          </p>
        ) : problem ? (
          <p>{date ? problem : "Select a date to check availability."}</p>
        ) : !trucks.length ? (
          <p>No saved trucks to check.</p>
        ) : (
          trucks.map((t) => {
            const conflicts = reservations.filter(
              (job) =>
                job.truckId === t.id &&
                // Long-distance trips (Phase 9) block whole days.
                (job.returnDate
                  ? job.date <= date && job.returnDate >= date
                  : job.date === date &&
                    overlaps(start, end, job.start, job.end)),
            );
            return (
              <div key={t.id}>
                <p className="font-medium">
                  {t.name}:{" "}
                  {conflicts.length
                    ? "Unavailable for this interval"
                    : "Available for this interval"}
                </p>
                {conflicts.map((j) => (
                  <ActionLink key={j.id} href={"/admin/jobs/" + j.id} outline>
                    Conflicting job {shortReference(j.id)} ·{" "}
                    {formatTimeRange(j.start, j.end)}
                  </ActionLink>
                ))}
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
