"use client";
import { shortReference, requestReference } from "@/lib/reference";

import { StatusBadge } from "@/components/status-badge";
import { statusLabel, type Status } from "@/lib/domain/status";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { estimateTotal } from "@/lib/domain";
import {
  ActionLink,
  controlClass,
  money,
  PageHeading,
  Panel,
} from "../admin-ui";
export function EstimatesList({
  data,
}: {
  data: Pick<EstimateWorkspace, "moves" | "estimates">;
}) {
  const state = data;
  const [status, setStatus] = useState("All");
  const estimates = state.estimates.filter(
    (e) => status === "All" || e.status === status,
  );
  return (
    <>
      <PageHeading
        title="Estimates"
        description="Draft, review, and publish estimates. Only customers decide whether to accept."
      />
      <div className="mb-5 max-w-sm space-y-2">
        <Label htmlFor="estimate-filter">Estimate status</Label>
        <select
          id="estimate-filter"
          className={controlClass}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All", "draft", "awaiting", "accepted", "declined"].map((s) => (
            <option key={s} value={s}>
              {s === "All" ? s : statusLabel(s as Status)}
            </option>
          ))}
        </select>
      </div>
      <p role="status" className="mb-4 text-sm">
        {estimates.length} estimate(s)
      </p>
      <div className="space-y-4">
        {!estimates.length && (
          <Panel>
            <p>
              No estimates in this view. Prepare a draft from an eligible
              request.
            </p>
            <ActionLink href="/admin/requests" outline>
              Review requests
            </ActionLink>
          </Panel>
        )}
        {estimates.map((e) => (
          <Panel key={e.id}>
            <h2 className="font-semibold">
              {shortReference(e.id)} ·{" "}
              {requestReference(e.requestId, state.moves)}
            </h2>
            <StatusBadge status={e.status} />
            <p className="text-sm">{money(estimateTotal(e))}</p>
            <ActionLink href={"/admin/estimates/" + e.id} outline>
              View estimate {shortReference(e.id)}
            </ActionLink>
          </Panel>
        ))}
      </div>
    </>
  );
}
