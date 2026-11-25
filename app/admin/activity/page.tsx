import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { workflowReady } from "@/lib/workflow/data";
import { RecordsUnavailable } from "@/components/records-unavailable";
import { PageHeading, Panel, controlClass } from "../admin-ui";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/filter-bar";
import { pageNumber, type ListParams } from "../record-list";
import { formatMessageTime } from "@/lib/format";
import { shortReference } from "@/lib/reference";
import { linkClass } from "@/lib/ui";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<ListParams>;
}) {
  await requireRole("admin");
  const params = await searchParams,
    page = pageNumber(params.page),
    kind = ["estimate", "job"].includes(String(params.kind))
      ? String(params.kind)
      : "",
    action =
      typeof params.action === "string" ? params.action.slice(0, 40) : "";
  if (!(await workflowReady()))
    return (
      <>
        <PageHeading
          title="Activity log"
          description="Recorded estimate and job changes."
        />
        <Panel>Activity history is not available yet.</Panel>
      </>
    );
  const client = await serverSupabase();
  const { data, error } = await client.rpc("admin_activity", {
    p_kind: kind,
    p_action: action,
    p_page: page,
  });
  if (error) return <RecordsUnavailable />;
  const href = (n: number) =>
    `/admin/activity?${new URLSearchParams({ kind, action, page: String(n) })}`;
  return (
    <>
      <PageHeading
        title="Activity log"
        description="Recorded estimate decisions and job changes."
      />
      <FilterBar method="get" role="search" aria-label="Filter activity">
        <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1.5">
          <Label htmlFor="event-kind">Record type</Label>
          <select
            id="event-kind"
            name="kind"
            defaultValue={kind}
            className={controlClass}
          >
            <option value="">All records</option>
            <option value="estimate">Estimates</option>
            <option value="job">Jobs</option>
          </select>
        </div>
        <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1.5">
          <Label htmlFor="event-action">Action</Label>
          <select
            id="event-action"
            name="action"
            defaultValue={action}
            className={controlClass}
          >
            <option value="">All actions</option>
            {[
              "draft",
              "awaiting",
              "accepted",
              "declined",
              "scheduled",
              "rescheduled",
              "in-progress",
              "completed",
              "cancelled",
            ].map((v) => (
              <option value={v} key={v}>
                {v === "draft"
                  ? "Revised draft"
                  : v === "awaiting"
                    ? "Published"
                    : v.replace("-", " ")}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Apply filters</Button>
      </FilterBar>
      <Panel className="gap-0 py-2 sm:py-2">
        {!data.length ? (
          <p className="py-4 text-sm text-muted-foreground">
            No matching activity.
          </p>
        ) : (
          <ol className="divide-y">
            {data.map((e) => {
              const label =
                e.action === "draft"
                  ? "Revised draft"
                  : e.action === "awaiting"
                    ? "Published"
                    : e.action.replace("-", " ");
              // Tone is decoration; the action is always written out.
              const tone = ["accepted", "completed"].includes(e.action)
                ? "bg-success-surface text-success"
                : ["declined", "cancelled", "in-progress"].includes(e.action)
                  ? "bg-warning-surface text-warning"
                  : "bg-muted text-foreground";
              return (
                <li
                  key={e.id}
                  className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[150px_110px_minmax(0,1fr)] sm:items-center"
                >
                  <time
                    dateTime={e.occurred_at}
                    className="text-[13px] text-muted-foreground"
                  >
                    {formatMessageTime(e.occurred_at)}
                  </time>
                  <span
                    aria-hidden="true"
                    className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${tone}`}
                  >
                    {label}
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold [overflow-wrap:anywhere]">
                        {e.entity === "job" ? "Job" : "Estimate"}{" "}
                        {shortReference(e.record_id)} · {label}
                      </h2>
                      <p className="text-[13px] text-muted-foreground">
                        {e.actor || "Account"}
                      </p>
                    </div>
                    <Link
                      href={`/admin/${e.entity === "job" ? "jobs" : "estimates"}/${e.record_id}`}
                      className={linkClass}
                    >
                      View record
                      <span className="sr-only">
                        {" "}
                        for {e.entity} {shortReference(e.record_id)}
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
      <nav aria-label="Activity pages" className="mt-5 flex gap-4">
        {page > 1 && (
          <Link className={linkClass} href={href(page - 1)}>
            Previous page
          </Link>
        )}
        {page * 20 < (data[0]?.total_count ?? 0) && (
          <Link className={linkClass} href={href(page + 1)}>
            Next page
          </Link>
        )}
      </nav>
    </>
  );
}
export const metadata: Metadata = { title: "Activity log" };
