"use client";
import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { buttonVariants } from "@/components/ui/button";
import type { SavedWorker } from "@/lib/profiles/admin-workers";
import type { Availability } from "@/lib/domain";
import { days } from "@/lib/domain";
import { formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeading, Panel } from "../admin-ui";

type WorkerCard = Pick<SavedWorker, "id" | "name"> & {
  /** Saved weekly preference; null when it could not be loaded. */
  availability: Availability[] | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Seven day pills; the list's label and each pill's text say it in words. */
function WeekPills({ name, availability }: WorkerCard) {
  if (!availability)
    return (
      <p className="text-xs text-muted-foreground">
        Availability could not be loaded.
      </p>
    );
  return (
    <ul
      aria-label={`${name || "Worker"}'s weekly availability`}
      className="flex gap-1"
    >
      {days.map((day) => {
        const row = availability.find((item) => item.day === day);
        const on = !!row?.available;
        return (
          <li
            key={day}
            className={cn(
              "grid h-7 w-8 place-items-center rounded-full text-xs font-semibold",
              on
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            <span aria-hidden="true">{day.slice(0, 2)}</span>
            <span className="sr-only">
              {day}:{" "}
              {on && row ? formatTimeRange(row.start, row.end) : "unavailable"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function WorkersList({ workers }: { workers: WorkerCard[] }) {
  const [search, setSearch] = useState("");
  const rows = workers.filter((row) =>
    `${row.name || "Worker"} ${row.id}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Workers"
        description="Review workers, availability and assigned jobs."
      />
      <FilterBar
        role="search"
        aria-label="Search workers"
        onSubmit={(event) => event.preventDefault()}
      >
        <FilterField label="Search workers" className="flex-[1_1_16rem]">
          <Input
            id="directory-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </FilterField>
      </FilterBar>
      <p role="status" className="mb-4 text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "worker" : "workers"}.
      </p>
      {!rows.length ? (
        <Panel>
          <p>
            {workers.length
              ? "No matching workers."
              : "No worker profiles yet."}
          </p>
        </Panel>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Panel className="h-full gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    {initials(row.name || "Worker")}
                  </span>
                  <h2 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                    {row.name || "Worker"}
                  </h2>
                </div>
                <WeekPills {...row} />
                <Link
                  href={`/admin/workers/${row.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    // Long names wrap instead of overflowing the card.
                    "mt-auto h-auto min-h-11 max-w-full self-start py-2 text-left whitespace-normal [overflow-wrap:anywhere]",
                  )}
                >
                  View {row.name || "Worker"}
                </Link>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
