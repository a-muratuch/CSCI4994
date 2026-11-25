import { moveReference, moveTitle, shortReference } from "@/lib/reference";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { estimateTotal } from "@/lib/domain";
import {
  formatMoney as money,
  formatShortDate,
  formatTimeRange,
} from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeading, Panel } from "../customer-ui";

export function EstimatesList({ data }: { data: EstimateWorkspace }) {
  const { estimates, moves } = data;
  const moveFor = (moveId: string) => moves.find((item) => item.id === moveId);
  const pending = estimates.filter(
    (estimate) => estimate.status === "awaiting",
  );
  const previous = estimates.filter(
    (estimate) => estimate.status !== "awaiting",
  );
  return (
    <>
      <PageHeading
        title="Estimates"
        description="Review the scope and terms before deciding. Estimates aren't binding and no payment is collected."
      />
      <section aria-labelledby="pending-heading" className="mb-8 space-y-3">
        <h2 id="pending-heading" className="text-[17px] font-semibold">
          Awaiting your decision · {pending.length}
        </h2>
        {!pending.length ? (
          <EmptyState title="No estimates awaiting a decision">
            <p>
              New estimates will appear here when a coordinator prepares them.
            </p>
          </EmptyState>
        ) : (
          pending.map((estimate) => {
            const move = moveFor(estimate.moveId);
            const title = move ? moveTitle(move) : "Move";
            return (
              <Panel
                key={estimate.id}
                className="flex-row flex-wrap items-end justify-between gap-x-8 gap-y-4"
              >
                <div className="min-w-0 flex-[1_1_16rem]">
                  <p className="text-[13px] text-muted-foreground">
                    Move #
                    {moveReference(estimate.moveId, move?.referenceNumber)} ·
                    version {estimate.version ?? 1} · estimate{" "}
                    {shortReference(estimate.id)}
                  </p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm text-foreground/80">
                    {estimate.proposal
                      ? `Proposed ${formatShortDate(estimate.proposal.date)} · arrival ${formatTimeRange(estimate.proposal.arrivalStart, estimate.proposal.arrivalEnd)}`
                      : "No date proposed yet"}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="text-[28px] font-semibold tracking-tight whitespace-nowrap tabular-nums">
                    {money(estimateTotal(estimate))}
                  </p>
                  <Link
                    href={`/customer/estimates/${estimate.id}`}
                    className={buttonVariants()}
                    aria-label={`Review and decide on the estimate for ${title}`}
                  >
                    Review and decide
                  </Link>
                </div>
              </Panel>
            );
          })
        )}
      </section>

      <Panel className="gap-3">
        <h2 className="text-[17px] font-semibold">Previous estimates</h2>
        {!previous.length ? (
          <p className="text-sm text-muted-foreground">
            Accepted or declined estimates will appear here.
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {previous.map((estimate) => {
              const move = moveFor(estimate.moveId);
              const title = move ? moveTitle(move) : "Move";
              return (
                <li key={estimate.id} className="border-t first:border-t-0">
                  <Link
                    href={`/customer/estimates/${estimate.id}`}
                    aria-label={`View estimate for ${title}, version ${estimate.version ?? 1}`}
                    className={cn(
                      "flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-2 py-3 hover:bg-muted",
                      focusClass,
                    )}
                  >
                    <span className="min-w-0 flex-[1_1_14rem] text-sm">
                      <span className="block font-medium [overflow-wrap:anywhere]">
                        {title} · version {estimate.version ?? 1}
                      </span>
                      <span className="text-muted-foreground">
                        Move #
                        {moveReference(estimate.moveId, move?.referenceNumber)}
                        {estimate.isCurrent === false
                          ? " · previous version"
                          : ""}
                      </span>
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap tabular-nums">
                      {money(estimateTotal(estimate))}
                    </span>
                    <StatusBadge status={estimate.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
