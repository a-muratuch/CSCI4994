import {
  formatArrival,
  formatMoney,
  formatShortDate,
  formatTimeRange,
} from "@/lib/format";
import { moveReference, moveTitle } from "@/lib/reference";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import { HeroPanel, heroActionClass } from "@/components/hero-panel";
import { ProgressSteps } from "@/components/progress-steps";
import { buttonVariants } from "@/components/ui/button";
import { moveStatusKey, nextMove, progressFor } from "@/lib/domain/status";
import { estimateTotal } from "@/lib/domain";
import type { EstimateView, MoveView } from "@/lib/domain";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { ActionLink, Panel, textLinkClass } from "./customer-ui";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { currentAccount } from "@/lib/auth/account";

const preparation = [
  "Describe stairs and parking at both addresses",
  "Label boxes by room",
  "Keep essentials with you",
];

/** The single most important next step, in priority order. */
function NextAction({
  pendingEstimate,
  pendingMove,
  scheduledMove,
  requestedMove,
}: {
  pendingEstimate?: EstimateView;
  pendingMove?: MoveView;
  scheduledMove?: MoveView;
  requestedMove?: MoveView;
}) {
  if (pendingEstimate && pendingMove) {
    const proposal = pendingEstimate.proposal;
    return (
      <HeroPanel
        eyebrow="Your estimate is ready"
        title={`${moveTitle(pendingMove)} · ${formatMoney(estimateTotal(pendingEstimate))}`}
        actions={
          <Link
            href={`/customer/estimates/${pendingEstimate.id}`}
            className={cn(heroActionClass, focusClass)}
          >
            Review estimate
            <ArrowUpRight aria-hidden="true" />
          </Link>
        }
      >
        {proposal
          ? `Proposed for ${formatShortDate(proposal.date)}, arrival ${formatTimeRange(proposal.arrivalStart, proposal.arrivalEnd)}. Accepting books that time if the crew and truck are still free.`
          : "Review the line items, then accept the estimate or request changes."}
      </HeroPanel>
    );
  }
  if (scheduledMove?.appointment) {
    const { appointment } = scheduledMove;
    return (
      <HeroPanel
        eyebrow={
          scheduledMove.stage === "in-progress"
            ? "Your move is underway"
            : "Your move is booked"
        }
        title={`${moveTitle(scheduledMove)} · ${formatShortDate(appointment.date)}`}
        actions={
          <Link
            href={`/customer/moves/${scheduledMove.id}`}
            className={cn(heroActionClass, focusClass)}
          >
            Move details
          </Link>
        }
      >
        Arrival window · {formatArrival(appointment.arrival)}
        {appointment.deliveryDate &&
          `. Delivery on ${formatShortDate(appointment.deliveryDate)}`}
        .
      </HeroPanel>
    );
  }
  if (requestedMove) {
    return (
      <HeroPanel
        eyebrow="Request received"
        title={moveTitle(requestedMove)}
        actions={
          <Link
            href={`/customer/moves/${requestedMove.id}`}
            className={cn(heroActionClass, focusClass)}
          >
            View request
          </Link>
        }
      >
        We&apos;re preparing your estimate. You&apos;ll get a notification when
        it&apos;s ready.
      </HeroPanel>
    );
  }
  return null;
}

export async function CustomerOverview({ data }: { data: EstimateWorkspace }) {
  const { moves, estimates } = data;
  const { account } = await currentAccount();
  const firstTime = moves.length === 0;
  const firstName = (account?.name ?? "Customer").split(/\s+/)[0];
  const estimateFor = (move: MoveView) =>
    estimates.find((estimate) => estimate.moveId === move.id);
  const pendingEstimate = estimates.find(
    (estimate) => estimate.status === "awaiting",
  );
  const pendingMove = moves.find((move) => move.id === pendingEstimate?.moveId);
  const scheduledMove = nextMove(moves);
  const requestedMove = moves.find(
    (move) => move.stage === "requested" && move.requestStatus !== "cancelled",
  );
  // The move whose progress matters most right now.
  const activeMove = scheduledMove ?? pendingMove ?? requestedMove;
  const recentMoves = moves.slice(0, 5);

  return (
    <>
      <PageHeading
        eyebrow="Customer overview"
        title={
          firstTime
            ? `Welcome to Rebel Move, ${firstName}.`
            : `Hi, ${firstName}`
        }
        actions={
          <ActionLink href="/customer/request">
            <Plus aria-hidden="true" />
            Request a move
          </ActionLink>
        }
      />

      <section
        aria-label={
          firstTime
            ? "First-time customer overview"
            : "Returning customer overview"
        }
        className="flex flex-col gap-5"
      >
        {firstTime ? (
          <HeroPanel
            eyebrow="Get started"
            title="Let's get your first move underway."
            actions={
              <Link
                href="/customer/request"
                className={cn(heroActionClass, focusClass)}
              >
                <Plus aria-hidden="true" />
                Request a move
              </Link>
            }
          >
            Tell us where you&apos;re going. We&apos;ll help with what comes
            next.
          </HeroPanel>
        ) : (
          <NextAction
            pendingEstimate={pendingEstimate}
            pendingMove={pendingMove}
            scheduledMove={scheduledMove}
            requestedMove={requestedMove}
          />
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            {activeMove && (
              <Panel className="gap-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="text-[17px] font-semibold">
                    {/* moveTitle already falls back to "Move #…" without cities. */}
                    {moveTitle(activeMove).startsWith("Move #")
                      ? moveTitle(activeMove)
                      : `Move #${moveReference(activeMove.id, activeMove.referenceNumber)} · ${moveTitle(activeMove)}`}
                  </h2>
                  <Link
                    href={`/customer/moves/${activeMove.id}`}
                    className={textLinkClass}
                  >
                    Move details
                  </Link>
                </div>
                <ProgressSteps
                  label="Move progress"
                  steps={progressFor(activeMove, estimateFor(activeMove))}
                />
              </Panel>
            )}
            {!firstTime && (
              <Panel className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4">
                  <h2 className="text-[17px] font-semibold">
                    Your move requests
                  </h2>
                  {moves.length > recentMoves.length && (
                    <Link href="/customer/moves" className={textLinkClass}>
                      View all {moves.length}
                    </Link>
                  )}
                </div>
                <ul className="-mx-2 flex flex-col">
                  {recentMoves.map((move) => (
                    <li key={move.id} className="border-t first:border-t-0">
                      <Link
                        href={`/customer/moves/${move.id}`}
                        className={cn(
                          "flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl px-2 py-3 hover:bg-muted",
                          focusClass,
                        )}
                      >
                        <span className="min-w-0 text-sm">
                          <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">
                            {moveTitle(move)}
                          </span>
                          <span className="text-muted-foreground">
                            #{moveReference(move.id, move.referenceNumber)} ·{" "}
                            {move.appointment
                              ? formatShortDate(move.appointment.date)
                              : `requested for ${formatShortDate(move.requestedDate)}`}
                          </span>
                        </span>
                        <StatusBadge
                          status={moveStatusKey(move, estimateFor(move))}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Panel className="gap-3">
              <h2 className="text-[17px] font-semibold">Messages</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Questions about an estimate or move day? Message the Rebel Move
                team.
              </p>
              <Link
                href="/customer/messages"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "self-start",
                )}
              >
                Open messages
              </Link>
            </Panel>
            <Panel className="gap-3">
              <h2 className="text-[17px] font-semibold">Getting ready</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-foreground/80">
                {preparation.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
              <Link href="/customer/help" className={textLinkClass}>
                More in Help &amp; contact
              </Link>
            </Panel>
          </div>
        </div>
      </section>
      <p role="status" className="sr-only">
        {firstTime
          ? "No moves or estimates yet."
          : `${moves.length} moves or requests. ${estimates.filter((estimate) => estimate.status === "awaiting").length} estimates awaiting review.`}
      </p>
    </>
  );
}
