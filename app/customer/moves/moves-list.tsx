"use client";
import { formatArrival, formatShortDate } from "@/lib/format";
import { moveReference, moveTitle } from "@/lib/reference";
import { useState } from "react";
import Link from "next/link";
import type { MoveView as Move, EstimateView as Estimate } from "@/lib/domain";
import { ActionLink, EmptyState, Panel, textLinkClass } from "../customer-ui";
import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import { ProgressSteps } from "@/components/progress-steps";
import { moveStatusKey, progressFor } from "@/lib/domain/status";
import { arrivalWindow } from "@/lib/requests/windows";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const filters = ["All", "Active", "Completed"] as const;
type Filter = (typeof filters)[number];

function matches(move: Move, filter: Filter) {
  if (filter === "All") return true;
  return filter === "Completed"
    ? move.stage === "completed"
    : move.stage !== "completed" && move.stage !== "cancelled";
}

export function MovesList({
  moves,
  estimates,
}: {
  moves: Move[];
  estimates: Estimate[];
}) {
  const [filter, setFilter] = useState<Filter>("All");
  const filtered = moves.filter((move) => matches(move, filter));
  return (
    <>
      <PageHeading
        title="My moves"
        description="Your saved move requests."
        actions={
          <ActionLink href="/customer/request">Request a move</ActionLink>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="Filter moves"
          aria-describedby="move-filter-hint"
          className="flex flex-wrap gap-2"
        >
          {filters.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                filter === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input/40 bg-background hover:bg-muted",
                focusClass,
              )}
            >
              {option}
              <span className="tabular-nums">
                &nbsp;· {moves.filter((move) => matches(move, option)).length}
              </span>
            </button>
          ))}
        </div>
        <p id="move-filter-hint" className="text-sm text-muted-foreground">
          Active includes pending requests.
        </p>
      </div>
      <p role="status" aria-atomic="true" className="sr-only">
        {filtered.length} {filter === "All" ? "" : `${filter.toLowerCase()} `}
        {filtered.length === 1 ? "move" : "moves"}.
      </p>
      {!filtered.length ? (
        <EmptyState
          title={
            filter === "Completed"
              ? "No completed moves yet"
              : "No moves to show"
          }
        >
          <p>
            {filter === "Completed"
              ? "Completed moves will appear here."
              : "Start with a move request."}
          </p>
          <Link href="/customer/request" className={textLinkClass}>
            Request a move
          </Link>
        </EmptyState>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {filtered.map((move) => {
            const estimate = estimates.find((e) => e.moveId === move.id);
            const reference = moveReference(move.id, move.referenceNumber);
            const preferred = arrivalWindow(move.preferredWindow);
            return (
              <Panel key={move.id} className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Move #{reference}
                    </p>
                    <h2 className="mt-1 text-[19px] font-semibold tracking-tight [overflow-wrap:anywhere]">
                      {moveTitle(move)}
                    </h2>
                  </div>
                  <StatusBadge status={moveStatusKey(move, estimate)} />
                </div>
                <p className="text-sm text-foreground/80">
                  {move.appointment
                    ? `${move.stage === "completed" ? "Completed" : "Confirmed"} ${formatShortDate(move.appointment.date)} · arrival ${formatArrival(move.appointment.arrival)}`
                    : `Requested ${formatShortDate(move.requestedDate)}${preferred ? ` · ${preferred.label}` : ""} · not confirmed`}
                </p>
                {move.stage !== "cancelled" &&
                  move.requestStatus !== "cancelled" && (
                    <ProgressSteps
                      label={`Progress for move ${reference}`}
                      steps={progressFor(move, estimate)}
                    />
                  )}
                <div className="flex flex-wrap gap-x-5 border-t pt-3">
                  {estimate?.status === "awaiting" && (
                    <Link
                      className={cn(textLinkClass, "font-medium")}
                      href={`/customer/estimates/${estimate.id}`}
                    >
                      Next: review your estimate →
                    </Link>
                  )}
                  <Link
                    className={textLinkClass}
                    href={`/customer/moves/${move.id}`}
                    aria-label={`View details for ${moveTitle(move)} (move ${reference})`}
                  >
                    View details →
                  </Link>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
