import { RecordsUnavailable } from "@/components/records-unavailable";
import { moveReference, moveTitle, shortReference } from "@/lib/reference";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatShortDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { OpenChat } from "@/components/messages/controls";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { adminCustomers } from "@/lib/profiles/admin-customers";
import { estimateWorkspace } from "@/lib/estimates/data";
import { estimateTotal, moveStatusKey } from "@/lib/domain";
import { JobLinks, PageHeading, Panel, linkClass } from "../../admin-ui";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await adminCustomers(id);
  if (result.error)
    return (
      <RecordsUnavailable
        title="Customer records unavailable"
        href="/admin/customers"
        linkLabel="Back to customers"
      />
    );
  const customer = result.customers[0];
  if (!customer) notFound();
  const operations = await estimateWorkspace("admin");
  const moves = operations.data.moves.filter((move) => move.customerId === id);
  const estimates = operations.data.estimates.filter((estimate) =>
    moves.some((move) => move.id === estimate.requestId),
  );
  const jobs = operations.data.jobs.filter((job) => job.customerId === id);
  const name = customer.name || "Customer";
  return (
    <>
      <Link href="/admin/customers" className={cn(linkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Customers
      </Link>
      <PageHeading
        eyebrow="Customer details"
        title={name}
        description="Read-only customer profile."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="gap-2">
            <h2 className="text-[17px] font-semibold">
              Requests and estimates
            </h2>
            {operations.error ? (
              <p role="alert">
                Related operations could not be loaded. Reload to try again.
              </p>
            ) : !moves.length ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              <ul className="divide-y">
                {moves.map((move) => {
                  const estimate = estimates.find(
                    (item) => item.requestId === move.id,
                  );
                  return (
                    <li
                      key={move.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                    >
                      <span className="min-w-0 flex-[1_1_14rem] text-sm">
                        <Link
                          href={`/admin/requests/${move.id}`}
                          className={cn(
                            linkClass,
                            "min-h-0 font-semibold no-underline hover:underline [overflow-wrap:anywhere]",
                          )}
                        >
                          Move #{moveReference(move.id, move.referenceNumber)} ·{" "}
                          {moveTitle(move)}
                        </Link>
                        <span className="block text-muted-foreground">
                          {formatShortDate(move.requestedDate)}
                          {estimate && (
                            <>
                              {" · "}
                              <Link
                                href={`/admin/estimates/${estimate.id}`}
                                className="underline underline-offset-4"
                              >
                                estimate {shortReference(estimate.id)} v
                                {estimate.version ?? 1}
                              </Link>
                              {` · ${formatMoney(estimateTotal(estimate))}`}
                            </>
                          )}
                        </span>
                      </span>
                      <StatusBadge status={moveStatusKey(move, estimate)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          {operations.error ? (
            <Panel>
              <p role="alert">
                Related jobs could not be loaded. Reload to try again.
              </p>
            </Panel>
          ) : (
            <JobLinks jobs={jobs} title="Related jobs and assignments" />
          )}
        </div>
        <Panel className="gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <p className="min-w-0 text-[17px] font-semibold [overflow-wrap:anywhere]">
              {name}
            </p>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[13px] text-muted-foreground">Full name</dt>
              <dd className="mt-0.5">{customer.name || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">
                Phone number
              </dt>
              <dd className="mt-0.5">
                {customer.phone.trim() || "Not provided"}
              </dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted-foreground">
            Customers manage their own contact details.
          </p>
          <OpenChat kind="customer-support" target={id}>
            Message customer
          </OpenChat>
        </Panel>
      </div>
    </>
  );
}

export const metadata: Metadata = { title: "Customer details" };
