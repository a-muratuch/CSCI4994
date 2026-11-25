import { recordAge } from "@/lib/workflow/data";
import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/account";
import { StatusBadge } from "@/components/status-badge";
import { statusDefinitions, type Status } from "@/lib/domain/status";
import { formatDate, formatShortDate } from "@/lib/format";
import { shortReference } from "@/lib/reference";
import { focusClass, linkClass } from "@/lib/ui";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { ResponsiveTable, TableHead } from "@/components/responsive-table";
import { cn } from "@/lib/utils";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PageHeading, Panel, controlClass } from "./admin-ui";
export type ListParams = Record<string, string | string[] | undefined>;
export function pageNumber(value: unknown) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 && n <= 1000000 ? n : 1;
}
export async function RecordList({
  kind,
  params,
}: {
  kind: "requests" | "estimates" | "jobs";
  params: ListParams;
}) {
  await requireRole("admin");
  const client = await serverSupabase();
  const search =
      typeof params.search === "string" ? params.search.slice(0, 100) : "",
    status = typeof params.status === "string" ? params.status : "",
    sort = ["newest", "oldest", "date", "customer"].includes(
      String(params.sort),
    )
      ? String(params.sort)
      : "newest",
    page = pageNumber(params.page);
  const { data, error } = await client.rpc("admin_records", {
    p_kind: kind,
    p_search: search,
    p_status: status,
    p_sort: sort,
    p_page: page,
  });
  if (error) return <RecordsUnavailable />;
  const title =
      kind === "requests"
        ? "Move requests"
        : kind === "estimates"
          ? "Estimates"
          : "Jobs & schedule",
    total = data[0]?.total_count ?? 0;
  const href = (n: number) =>
    `/admin/${kind}?${new URLSearchParams({ search, status, sort, page: String(n) })}`;
  const states =
    kind === "estimates"
      ? ["draft", "awaiting", "accepted", "declined"]
      : kind === "jobs"
        ? ["scheduled", "in-progress", "completed", "cancelled"]
        : [
            "requested",
            "estimate-draft",
            "estimate-ready",
            "coordinator-review",
            "awaiting-scheduling",
            "scheduled",
            "in-progress",
            "completed",
            "cancelled",
          ];
  return (
    <>
      <PageHeading
        title={title}
        description="Search, filter and review moving records."
      />
      <FilterBar method="get" role="search" aria-label={`Filter ${title}`}>
        <FilterField label="Search records" className="flex-[2_1_14rem]">
          <Input
            name="search"
            type="search"
            defaultValue={search}
            maxLength={100}
            placeholder="Name, reference or address"
          />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={status} className={controlClass}>
            <option value="">All statuses</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {statusDefinitions[s as Status].label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Sort by">
          <select name="sort" defaultValue={sort} className={controlClass}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="date">Move date</option>
            <option value="customer">Customer name</option>
          </select>
        </FilterField>
        <Button type="submit">Apply filters</Button>
      </FilterBar>
      <p className="mb-3 text-sm text-muted-foreground">
        {total} records · Page {page}
      </p>
      {!data.length ? null : kind === "jobs" ? <JobAgenda rows={data} /> : null}
      {!data.length ? (
        <Panel>
          <h2 className="font-semibold">No matching records</h2>
          <Link className={linkClass} href={`/admin/${kind}`}>
            Clear filters
          </Link>
        </Panel>
      ) : kind === "jobs" ? null : (
        <>
          <ResponsiveTable
            label={title}
            minWidth="760px"
            className="hidden md:block"
          >
            <caption className="sr-only">{title}</caption>
            <TableHead
              columns={[
                "Customer & ref",
                "Route",
                "Date",
                "Status",
                "Added",
                "Details",
              ]}
            />
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-surface">
                  <td>
                    <p className="font-semibold">{r.customer || "Customer"}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {shortReference(r.id)}
                    </p>
                  </td>
                  <td className="max-w-sm [overflow-wrap:anywhere]">
                    <p>{r.pickup}</p>
                    <p className="text-muted-foreground">→ {r.destination}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDate(r.record_date)}
                  </td>
                  <td>
                    {r.status in statusDefinitions ? (
                      <StatusBadge status={r.status as Status} />
                    ) : (
                      r.status
                    )}
                  </td>
                  <td className="whitespace-nowrap text-muted-foreground">
                    {recordAge(r.created_at)}
                  </td>
                  <td className="text-right">
                    <Link
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "min-h-11",
                      )}
                      href={`/admin/${kind}/${r.id}`}
                      aria-label={`View ${kind.slice(0, -1)} ${shortReference(r.id)}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
          <ul className="space-y-3 md:hidden">
            {data.map((r) => (
              <li key={r.id}>
                <Panel className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-semibold">
                      {r.customer || "Customer"}
                    </h2>
                    {r.status in statusDefinitions && (
                      <StatusBadge status={r.status as Status} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {shortReference(r.id)} · {formatDate(r.record_date)} ·{" "}
                    {recordAge(r.created_at)}
                  </p>
                  <p className="text-sm [overflow-wrap:anywhere]">
                    {r.pickup} → {r.destination}
                  </p>
                  <Link
                    className={linkClass}
                    href={`/admin/${kind}/${r.id}`}
                    aria-label={`View ${kind.slice(0, -1)} ${shortReference(r.id)}`}
                  >
                    View details
                  </Link>
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}
      <nav aria-label="Record pages" className="mt-5 flex gap-4">
        {page > 1 && (
          <Link href={href(page - 1)} className={linkClass}>
            Previous page
          </Link>
        )}
        {page * 20 < total && (
          <Link href={href(page + 1)} className={linkClass}>
            Next page
          </Link>
        )}
      </nav>
    </>
  );
}

type AgendaRow = {
  id: string;
  customer: string | null;
  pickup: string;
  destination: string;
  record_date: string;
  status: string;
};

/**
 * Jobs grouped by their job date, in the order the current sort returns them.
 * Each item carries `data-date` so the calendar can open the matching week.
 */
function JobAgenda({ rows }: { rows: AgendaRow[] }) {
  const days = new Map<string, AgendaRow[]>();
  for (const row of rows)
    days.set(row.record_date, [...(days.get(row.record_date) ?? []), row]);
  return (
    <div className="flex flex-col gap-5">
      {[...days].map(([date, jobs]) => (
        <section key={date} aria-labelledby={`day-${date}`}>
          <h2
            id={`day-${date}`}
            className="mb-2 text-sm font-semibold text-muted-foreground"
          >
            <time dateTime={date}>{formatShortDate(date)}</time>
            <span className="font-normal"> · {jobs.length} job(s)</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {jobs.map((row) => (
              <li
                key={row.id}
                data-date={row.record_date}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] border bg-card p-4"
              >
                <span className="min-w-0 flex-[1_1_16rem] text-sm">
                  <span className="block font-semibold">
                    {row.customer || "Customer"}{" "}
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      {shortReference(row.id)}
                    </span>
                  </span>
                  <span className="block text-muted-foreground [overflow-wrap:anywhere]">
                    {row.pickup} → {row.destination}
                  </span>
                </span>
                {row.status in statusDefinitions && (
                  <StatusBadge status={row.status as Status} />
                )}
                <Link
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "min-h-11",
                    focusClass,
                  )}
                  href={`/admin/jobs/${row.id}`}
                  aria-label={`View job ${shortReference(row.id)}`}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
