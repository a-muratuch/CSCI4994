"use client";
import { moveReference } from "@/lib/reference";

import { formatDate } from "@/lib/format";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import {
  moveStatus,
  moveStatusKey,
  statusLabel,
  type Status,
} from "@/lib/domain";
import { ActionLink, controlClass, PageHeading, Panel } from "../admin-ui";
export function RequestsList({
  data,
}: {
  data: Pick<EstimateWorkspace, "moves" | "estimates" | "customers">;
}) {
  const state = data;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const estimates = state.estimates;
  const rows = state.moves.map((m) => ({
    ...m,
    label: moveStatus(
      m,
      estimates.find((e) => e.requestId === m.id),
    ),
    customer:
      state.customers.find((c) => c.id === m.customerId)?.name ?? "Unknown",
  }));
  const filtered = rows.filter(
    (r) =>
      (status === "All" || r.label === status) &&
      [r.id, r.customer, r.pickup, r.destination]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Move requests"
        description="Review customer details before preparing an estimate."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="request-search">Search requests</Label>
          <Input
            className="min-h-11"
            id="request-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ID, customer, or route"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-status">Request status</Label>
          <select
            id="request-status"
            className={controlClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              "All",
              "requested",
              "estimate-draft",
              "estimate-ready",
              "coordinator-review",
              "awaiting-scheduling",
              "scheduled",
              "in-progress",
              "completed",
            ].map((s) => {
              const label = s === "All" ? s : statusLabel(s as Status);
              return (
                <option key={s} value={label}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      </div>
      <p role="status" className="mb-4 text-sm">
        {filtered.length} request(s)
      </p>
      <div className="space-y-4">
        {!filtered.length && (
          <Panel>
            <p>No requests match. Try changing the filters.</p>
          </Panel>
        )}
        {filtered.map((r) => (
          <Panel key={r.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">
                {moveReference(r.id, r.referenceNumber)} · {r.customer}
              </h2>
              <StatusBadge
                status={moveStatusKey(
                  r,
                  estimates.find((e) => e.requestId === r.id),
                )}
              />
            </div>
            <p className="text-sm">
              {r.pickup} → {r.destination}
            </p>
            <p className="text-sm text-muted-foreground">
              Preferred date: {formatDate(r.requestedDate)} · requested, not
              confirmed
            </p>
            <ActionLink href={"/admin/requests/" + r.id} outline>
              Review request {moveReference(r.id, r.referenceNumber)}
            </ActionLink>
          </Panel>
        ))}
      </div>
    </>
  );
}
