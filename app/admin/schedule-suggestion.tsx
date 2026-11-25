"use client";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { suggestTeam, type ScheduleOptions } from "@/lib/jobs/suggest";

/**
 * Suggested crew and truck for the chosen date and times. Applying fills the
 * existing selectors; saving re-checks availability, overlaps and travel time.
 */
export function ScheduleSuggestion({
  options,
  start,
  end,
  disabled,
  onApply,
  multiDay = false,
}: {
  options: ScheduleOptions;
  start: string;
  end: string;
  disabled: boolean;
  onApply: (workerIds: string[], truckId: string) => void;
  /** Phase 9: long-distance job spanning several days. */
  multiDay?: boolean;
}) {
  const id = useId();
  if (!start || !end || (!multiDay && start >= end))
    return (
      <section className="rounded-2xl bg-surface p-4 text-sm">
        <h3 className="font-semibold">Suggested team</h3>
        <p className="text-muted-foreground">
          Enter the work start and end to see a suggested crew and truck.
        </p>
      </section>
    );
  const result = suggestTeam(options, start, end, multiDay);
  const ready = result.crew.length > 0 && result.truck;
  return (
    <section
      aria-labelledby={id + "title"}
      className="space-y-3 rounded-2xl border bg-surface p-4 text-sm sm:p-5"
    >
      <h3 id={id + "title"} className="font-semibold">
        Suggested team
      </h3>
      <p className="text-muted-foreground">
        Crew of {options.crewTarget}
        {options.volume > 0
          ? ` for ${options.volume} cu ft of inventory`
          : " (no inventory listed)"}
        . Ranked by availability, workload this week and driving from the
        previous job. Crews and trucks that cannot get from their previous job
        to {options.pickupPlace ?? "this pickup"} in time are left out.
      </p>
      {result.crew.length > 0 && (
        <ul className="space-y-2">
          {result.crew.map((worker) => (
            <li key={worker.id}>
              <span className="font-medium">{worker.name}</span>
              <span className="block text-muted-foreground">
                {worker.reasons.join(" ")}
              </span>
            </li>
          ))}
          {result.truck && (
            <li>
              <span className="font-medium">Truck: {result.truck.name}</span>
              <span className="block text-muted-foreground">
                {result.truck.reasons.join(" ")}
              </span>
            </li>
          )}
        </ul>
      )}
      {result.shortBy > 0 && (
        <div className="space-y-1 text-warning">
          <p>
            {result.crew.length
              ? `Only ${result.crew.length} of ${options.crewTarget} workers can take this job at this time.`
              : "No worker can take this job at this time."}
          </p>
          {/* The reasons, so nobody has to open "Not suggested" to find out why. */}
          {result.excludedWorkers.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {[...result.excludedWorkers]
                // Workers who work that day but are blocked come first.
                .sort(
                  (a, b) =>
                    Number(a.reason === "Not available that day.") -
                    Number(b.reason === "Not available that day."),
                )
                .slice(0, 3)
                .map((worker) => (
                  <li key={worker.id} className="[overflow-wrap:anywhere]">
                    {worker.name}: {worker.reason}
                  </li>
                ))}
              {result.excludedWorkers.length > 3 && (
                <li>
                  {result.excludedWorkers.length - 3} more under Not suggested.
                </li>
              )}
            </ul>
          )}
          <p>
            Try another start or date, or update their availability on the
            worker pages.
          </p>
        </div>
      )}
      {!result.truck && (
        <p className="text-warning">No truck can take this job at this time.</p>
      )}
      {ready && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={() =>
            onApply(
              result.crew.map((w) => w.id),
              result.truck!.id,
            )
          }
        >
          Use suggested team
        </Button>
      )}
      {(result.excludedWorkers.length > 0 ||
        result.excludedTrucks.length > 0) && (
        <details>
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            Not suggested ({result.excludedWorkers.length} workers,{" "}
            {result.excludedTrucks.length} trucks)
          </summary>
          <ul className="mt-2 space-y-2">
            {[...result.excludedWorkers, ...result.excludedTrucks].map(
              (item) => (
                <li key={item.id} className="[overflow-wrap:anywhere]">
                  <span className="font-medium">{item.name}:</span>{" "}
                  {item.reason}
                </li>
              ),
            )}
          </ul>
        </details>
      )}
    </section>
  );
}
