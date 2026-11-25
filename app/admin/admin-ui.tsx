import {
  formatDate,
  formatArrival,
  formatMoney as money,
  formatWork,
} from "@/lib/format";
import { shortReference } from "@/lib/reference";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Timeline } from "@/components/timeline";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Panel } from "../customer/customer-ui";
import type { History, Estimate, WorkerJobView } from "@/lib/domain";
import { estimateTotal } from "@/lib/domain";
export { Panel, EmptyState, controlClass } from "../customer/customer-ui";
export { PageHeading } from "@/components/page-heading";
export { formatDate, formatMoney as money } from "@/lib/format";
export { focusClass, linkClass } from "@/lib/ui";
import { linkClass } from "@/lib/ui";

export function ActionLink({
  href,
  children,
  outline = false,
}: {
  href: string;
  children: React.ReactNode;
  outline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: outline ? "outline" : "default" }),
        "h-auto min-h-11 max-w-full self-start px-4 py-2 whitespace-normal [overflow-wrap:anywhere]",
      )}
    >
      {children}
    </Link>
  );
}
export function HistoryList({ entries }: { entries: History[] }) {
  return (
    <Panel>
      <h2 className="text-[17px] font-semibold">History</h2>
      {!entries.length ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <Timeline
          items={entries.map((h) => ({
            id: h.id,
            title: h.label,
            meta: (
              <>
                {formatDate(h.date)}
                {h.detail && (
                  <span className="mt-0.5 block leading-6">{h.detail}</span>
                )}
              </>
            ),
          }))}
        />
      )}
    </Panel>
  );
}
export function EstimateSummary({ estimate }: { estimate: Estimate }) {
  return (
    <Panel>
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-[17px] font-semibold">Pricing</h2>
        <span className="text-sm text-muted-foreground">
          {shortReference(estimate.id)}
        </span>
      </div>
      <dl>
        {estimate.lines.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b py-3 text-sm"
          >
            <dt>{line.label}</dt>
            <dd className="whitespace-nowrap text-right tabular-nums">
              {money(line.amountCents)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 py-4 font-semibold">
          <dt>Total</dt>
          <dd className="whitespace-nowrap text-right tabular-nums">
            {money(estimateTotal(estimate))}
          </dd>
        </div>
      </dl>
      {[
        ["Inclusions", estimate.inclusions],
        ["Exclusions", estimate.exclusions],
      ].map(([label, items]) => (
        <div key={label as string}>
          <h3 className="font-semibold">{label}</h3>
          <ul className="list-inside list-disc text-sm leading-6">
            {(items as string[]).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="rounded-lg bg-muted p-4">
        <h3 className="font-semibold">Terms · not a binding quote</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {estimate.terms}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        No payment is collected. Acceptance does not confirm a moving date.
      </p>
    </Panel>
  );
}
/** Compact job rows for the truck, worker and customer detail pages. */
export function JobLinks({
  jobs,
  title = "Assigned jobs",
}: {
  jobs: WorkerJobView[];
  title?: string;
}) {
  const sorted = [...jobs].sort((a, b) =>
    `${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`),
  );
  return (
    <Panel className="gap-2">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {!sorted.length ? (
        <p className="text-sm text-muted-foreground">No related jobs.</p>
      ) : (
        <ul className="divide-y">
          {sorted.map((j) => (
            <li
              key={j.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
            >
              <span className="min-w-0 flex-[1_1_14rem] text-sm">
                <Link
                  href={"/admin/jobs/" + j.id}
                  aria-label={`View job ${shortReference(j.id)}`}
                  className={cn(
                    linkClass,
                    "min-h-0 font-semibold no-underline hover:underline [overflow-wrap:anywhere]",
                  )}
                >
                  {shortReference(j.id)} · {j.customer}
                </Link>
                <span className="block text-muted-foreground">
                  {formatDate(j.date)}
                  {j.returnDate
                    ? ` – ${formatDate(j.returnDate)} · long distance`
                    : ` · ${formatWork(j)}`}{" "}
                  · {j.truck} · arrival {formatArrival(j.arrival)}
                </span>
              </span>
              <StatusBadge status={j.status} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
