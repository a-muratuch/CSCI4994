import { moveReference, shortReference } from "@/lib/reference";
import { arrivalWindow } from "@/lib/requests/windows";
import { declineReasonLabel } from "@/lib/estimates/decline";

import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { moveStatusKey } from "@/lib/domain";
import { StatusBadge } from "@/components/status-badge";
import { ActionLink, HistoryList, PageHeading, Panel } from "../../admin-ui";
import { inventoryTotals, type InventoryLine } from "@/lib/requests/inventory";
export function RequestDetails({
  data,
  id,
  inventory,
  photos,
}: {
  data: EstimateWorkspace;
  id: string;
  /** Undefined when the feature is unavailable; null when loading failed. */
  inventory?: InventoryLine[] | null;
  /** Photos panel, shown in the main column. */
  photos?: React.ReactNode;
}) {
  const state = data;
  const move = state.moves.find((r) => r.id === id);
  if (!move) notFound();
  const estimate = state.estimates.find((e) => e.requestId === id);
  const customer =
    state.customers.find((c) => c.id === move.customerId)?.name ?? "Customer";
  const reference = moveReference(move.id, move.referenceNumber);
  return (
    <>
      <PageHeading
        eyebrow={`Request ${reference}`}
        title={customer}
        badge={<StatusBadge status={moveStatusKey(move, estimate)} />}
        actions={
          estimate ? (
            <ActionLink href={"/admin/estimates/" + estimate.id}>
              View estimate {shortReference(estimate.id)}
            </ActionLink>
          ) : move.stage === "cancelled" ? undefined : (
            <ActionLink href={"/admin/requests/" + id + "/estimate"}>
              Prepare estimate
            </ActionLink>
          )
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <h2 className="text-[17px] font-semibold">Customer move details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Pickup", move.pickup],
                ["Destination", move.destination],
                ["Preferred date (requested)", formatDate(move.requestedDate)],
                ...(move.preferredWindow
                  ? [
                      [
                        "Preferred arrival (requested)",
                        arrivalWindow(move.preferredWindow)?.label ?? "",
                      ],
                    ]
                  : []),
                ["Property / size", move.property + " · " + move.size],
                ["Items", move.items],
                ["Access", move.access],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[13px] text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="rounded-xl bg-surface px-4 py-3 text-sm leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
              <span className="font-medium">Customer notes · </span>
              {move.notes || "None"}
            </p>
          </Panel>
          {inventory !== undefined && (
            <Panel>
              <InventoryList lines={inventory} />
            </Panel>
          )}
          {photos}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <h2 className="text-[17px] font-semibold">
              Estimate and appointment
            </h2>
            {estimate ? (
              estimate.status === "declined" && (
                <p className="rounded-xl bg-warning-surface px-3 py-2 text-sm leading-6 text-warning">
                  The customer declined
                  {estimate.declineReason
                    ? ` (${declineReasonLabel(estimate.declineReason)})`
                    : ""}
                  . Open the estimate to review the decision and available
                  follow-up actions.
                </p>
              )
            ) : move.stage === "cancelled" ? (
              <p>This request was cancelled.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No estimate yet. Prepare one from the inventory and pricing
                defaults.
              </p>
            )}
            {move.jobId ? (
              <ActionLink href={"/admin/jobs/" + move.jobId} outline>
                View confirmed job {shortReference(move.jobId)}
              </ActionLink>
            ) : (
              <p className="text-sm text-muted-foreground">
                No appointment confirmed. Customer acceptance is required before
                admin scheduling.
              </p>
            )}
          </Panel>
          <HistoryList entries={move.history} />
        </div>
      </div>
    </>
  );
}

function InventoryList({ lines }: { lines: InventoryLine[] | null }) {
  if (!lines)
    return (
      <p role="alert" className="text-sm">
        The inventory could not be loaded. Reload to try again.
      </p>
    );
  const totals = inventoryTotals(lines);
  return (
    <section aria-labelledby="inventory-heading" className="space-y-2">
      <h2 id="inventory-heading" className="text-[17px] font-semibold">
        Inventory
      </h2>
      {lines.length === 0 ? (
        <p className="text-sm">No inventory listed.</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {totals.items} items · {totals.cubicFeet} cu ft · about{" "}
            {totals.weightLb.toLocaleString("en-US")} lb
          </p>
          <ul className="divide-y text-sm">
            {lines.map((line, index) => (
              <li key={index} className="flex justify-between gap-3 py-2">
                <span className="break-words">
                  {line.quantity} × {line.label}
                  <span className="text-muted-foreground"> · {line.room}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(line.quantity * line.cubicFeet * 10) / 10} cu ft
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
