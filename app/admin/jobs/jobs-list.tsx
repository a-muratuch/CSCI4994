"use client";
import { shortReference, requestReference } from "@/lib/reference";

import { statusLabel, type Status } from "@/lib/domain/status";
import { useState } from "react";
import type { JobWorkspace } from "@/lib/jobs/data";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ActionLink,
  controlClass,
  JobLinks,
  PageHeading,
  Panel,
} from "../admin-ui";
export function JobsList({
  data,
}: {
  data: Pick<JobWorkspace, "moves" | "estimates" | "jobs">;
}) {
  const state = data;
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("All");
  const ready = state.estimates.filter(
    (e) =>
      e.status === "accepted" && !state.jobs.some((j) => j.estimateId === e.id),
  );
  const jobs = state.jobs
    .filter(
      (j) =>
        (!date ||
          j.date === date ||
          (j.date <= date && (j.returnDate ?? j.date) >= date)) &&
        (status === "All" || j.status === status),
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <>
      <PageHeading
        title="Jobs & schedule"
        description="Agenda · all times Central Time. Only scheduled jobs can be edited."
      />
      <Panel className="mb-5">
        <h2 className="font-semibold">Accepted · awaiting scheduling</h2>
        {!ready.length && (
          <p className="text-sm">No accepted estimates waiting for a job.</p>
        )}
        {ready.map((e) => (
          <ActionLink
            key={e.id}
            href={"/admin/estimates/" + e.id + "/schedule"}
            outline
          >
            Schedule {shortReference(e.id)} ·{" "}
            {requestReference(e.requestId, state.moves)}
          </ActionLink>
        ))}
      </Panel>
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="job-date">Filter by date (optional)</Label>
          <Input
            className="min-h-11"
            id="job-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job-status">Job status</Label>
          <select
            id="job-status"
            className={controlClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["All", "scheduled", "in-progress", "completed", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {s === "All" ? s : statusLabel(s as Status)}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      <p role="status" className="mb-4 text-sm">
        {jobs.length} job(s) match these filters.
      </p>
      <JobLinks jobs={jobs} />
    </>
  );
}
