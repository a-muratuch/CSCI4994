"use client";
import type { InventoryLine } from "@/lib/requests/inventory";
import { arrivalWindow } from "@/lib/requests/windows";
import { InventorySummary } from "@/app/customer/request/inventory-step";
import {
  formatArrival,
  formatTimeRange,
  formatDate,
  formatShortDate,
  formatMoney as money,
} from "@/lib/format";
import { moveReference, moveTitle, shortReference } from "@/lib/reference";
import { notFound } from "next/navigation";
import { OpenChat } from "@/components/messages/controls";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoveView as Move, EstimateView as Estimate } from "@/lib/domain";
import { estimateTotal } from "@/lib/domain";
import { ActionLink, Panel, textLinkClass } from "../../customer-ui";
import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import { HeroPanel, heroActionClass } from "@/components/hero-panel";
import { ProgressSteps } from "@/components/progress-steps";
import { Timeline } from "@/components/timeline";
import { moveStatusKey, progressFor } from "@/lib/domain/status";

const sectionHeading = "text-[17px] font-semibold";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** "Marcus, Dana & Eli" from full names. */
function firstNames(team: string[]) {
  const names = team.map((member) => member.split(/\s+/)[0]);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`
    : names[0];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

export function MoveDetails({
  savedMove,
  savedEstimate,
  inventory,
  actions,
  photos,
}: {
  savedMove?: Move;
  savedEstimate?: Estimate;
  /** Undefined when the feature is unavailable; null when loading failed. */
  inventory?: InventoryLine[] | null;
  /** Edit/cancel controls, shown beside the title. */
  actions?: React.ReactNode;
  /** The photos panel, shown in the main column. */
  photos?: React.ReactNode;
}) {
  const move = savedMove;
  const estimate = savedEstimate;
  if (!move) notFound();
  const appointment = move.appointment;
  const chat = move.jobId && (
    <OpenChat
      kind="move-team"
      target={move.jobId}
      className={appointment ? heroActionClass : undefined}
    >
      {move.stage === "completed" || move.stage === "cancelled"
        ? "View move-team chat"
        : "Open move-team chat"}
    </OpenChat>
  );
  const requestFacts = (
    <div
      className={cn(
        "space-y-1 text-sm leading-6",
        appointment ? "text-primary-foreground/80" : "text-muted-foreground",
      )}
    >
      <p>
        {appointment ? "Originally requested" : "Requested date"}:{" "}
        {formatDate(move.requestedDate)}
        {!appointment && " · Not confirmed"}
      </p>
      {move.preferredWindow && (
        <p>Preferred arrival: {arrivalWindow(move.preferredWindow)?.label}</p>
      )}
      {move.jobId && (
        <p className="[overflow-wrap:anywhere]">
          Job {shortReference(move.jobId)}
        </p>
      )}
      <p>Scheduling and team assignments are managed by an admin.</p>
    </div>
  );

  return (
    <>
      <Link href="/customer/moves" className={cn(textLinkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to my moves
      </Link>
      <PageHeading
        eyebrow={`Move #${moveReference(move.id, move.referenceNumber)}`}
        title={
          <span className="[overflow-wrap:anywhere]">{moveTitle(move)}</span>
        }
        badge={<StatusBadge status={moveStatusKey(move, estimate)} />}
        actions={actions}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Schedule first on every screen size. */}
          {appointment ? (
            <HeroPanel
              eyebrow={
                move.stage === "completed"
                  ? "Completed appointment"
                  : move.stage === "cancelled"
                    ? "Cancelled appointment"
                    : "Confirmed appointment"
              }
              title={
                <span className="text-[30px] leading-tight">
                  {formatShortDate(appointment.date)}
                </span>
              }
              actions={
                (chat || !!move.team?.length) && (
                  <div className="flex flex-col items-start gap-2">
                    {chat}
                    {!!move.team?.length && (
                      <span className="text-[13px] text-primary-foreground/80">
                        {firstNames(move.team)}
                      </span>
                    )}
                  </div>
                )
              }
            >
              <div className="space-y-2">
                <p className="text-base font-medium text-primary-foreground">
                  Arrival window: {formatArrival(appointment.arrival)}
                </p>
                {appointment.deliveryDate && (
                  <p className="text-primary-foreground">
                    Long-distance move · delivery on{" "}
                    {formatDate(appointment.deliveryDate)}
                  </p>
                )}
                <p>
                  Scheduled work:{" "}
                  {formatTimeRange(appointment.start, appointment.end)}
                </p>
                {move.stage === "scheduled" && move.crewOnTheWay && (
                  <p className="rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium text-primary-foreground">
                    Your crew is on the way.
                  </p>
                )}
                {move.stage === "in-progress" && (
                  <p className="rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm font-medium text-primary-foreground">
                    Your crew has arrived and the move is in progress.
                  </p>
                )}
                {requestFacts}
              </div>
            </HeroPanel>
          ) : (
            <Panel className="gap-3">
              <h2 className={sectionHeading}>Schedule</h2>
              <p className="font-semibold">
                {move.stage === "cancelled"
                  ? "Move cancelled"
                  : "Awaiting scheduling"}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                No appointment confirmed. Accepting an estimate does not confirm
                a moving date.
              </p>
              {chat}
              {requestFacts}
            </Panel>
          )}
          {move.stage !== "cancelled" && move.requestStatus !== "cancelled" && (
            <Panel>
              <ProgressSteps
                label="Move progress"
                steps={progressFor(move, estimate)}
              />
            </Panel>
          )}
          <Panel className="gap-4">
            <h2 className={sectionHeading}>Moving route</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Pickup" value={move.pickup} />
              <Field label="Destination" value={move.destination} />
            </dl>
          </Panel>
          <Panel className="gap-4">
            <h2 className={sectionHeading}>Moving details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Property" value={move.property} />
              <Field label="Move size" value={move.size} />
              <Field label="Items" value={move.items} />
              <Field label="Access requirements" value={move.access} />
              <div className="sm:col-span-2">
                <Field
                  label="Notes"
                  value={move.notes || "No additional notes."}
                />
              </div>
            </dl>
            {inventory !== undefined && (
              <section
                aria-labelledby="inventory-heading"
                className="space-y-2 border-t pt-4"
              >
                <h3
                  id="inventory-heading"
                  className="text-[13px] text-muted-foreground"
                >
                  Inventory
                </h3>
                {inventory === null ? (
                  <p role="alert" className="text-sm">
                    Your inventory could not be loaded. Refresh to try again.
                  </p>
                ) : inventory.length === 0 ? (
                  <p className="text-sm">No inventory listed.</p>
                ) : (
                  <>
                    <InventorySummary lines={inventory} />
                    <ul className="divide-y text-sm">
                      {inventory.map((line, index) => (
                        <li
                          key={index}
                          className="py-2 [overflow-wrap:anywhere]"
                        >
                          {line.quantity} × {line.label}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}
          </Panel>
          {photos}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-3">
            {estimate ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm text-muted-foreground">
                    Estimated total
                  </h2>
                  <StatusBadge status={estimate.status} />
                </div>
                <p className="text-[30px] font-semibold tracking-tight whitespace-nowrap tabular-nums">
                  {money(estimateTotal(estimate))}
                </p>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  Estimate {shortReference(estimate.id)}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Accepting an estimate does not confirm a moving date.
                </p>
                {estimate.status === "awaiting" ? (
                  <ActionLink href={`/customer/estimates/${estimate.id}`}>
                    Review estimate
                  </ActionLink>
                ) : (
                  <ActionLink
                    href={`/customer/estimates/${estimate.id}`}
                    outline
                  >
                    View estimate
                  </ActionLink>
                )}
              </>
            ) : (
              <>
                <h2 className={sectionHeading}>No estimate yet</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  A coordinator can review your request and prepare an estimate.
                </p>
              </>
            )}
          </Panel>
          {!!move.team?.length && (
            <Panel className="gap-3">
              <h2 className={sectionHeading}>Assigned team</h2>
              <ul className="flex flex-col gap-2.5">
                {move.team.map((member) => (
                  <li
                    key={member}
                    className="flex items-center gap-2.5 text-sm [overflow-wrap:anywhere]"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    >
                      {initials(member)}
                    </span>
                    {member}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel className="gap-4">
            <h2 className={sectionHeading}>Progress history</h2>
            <Timeline
              items={move.history.map((entry, index) => ({
                id: `${entry.label}-${index}`,
                title: entry.label,
                meta: (
                  <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                ),
              }))}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
