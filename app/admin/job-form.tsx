"use client";
import { useHydrated } from "@/lib/use-hydrated";
import { formatTimeRange } from "@/lib/format";
import { bookings } from "@/lib/workflow/actions";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { JobWorkspace } from "@/lib/jobs/data";
import {
  saveProposal,
  saveSchedule,
  scheduleOptions,
} from "@/lib/jobs/actions";
import {
  checkSelection,
  listText,
  suggestTeam,
  type ScheduleOptions,
} from "@/lib/jobs/suggest";
import { arrivalWindow } from "@/lib/requests/windows";
import { ScheduleSuggestion } from "./schedule-suggestion";
import { validateSchedule } from "@/lib/jobs/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { days, type Job, type ScheduleInput } from "@/lib/domain";
import { Panel } from "./admin-ui";
import { addMinutes, defaultArrival } from "@/lib/jobs/arrival";
import {
  addDays,
  dailyHours,
  missingTripDays,
  planTrip,
} from "@/lib/jobs/long-distance";
import { formatDate, formatShortDate } from "@/lib/format";

export function JobForm({
  estimateId,
  job,
  data,
  showBookings = false,
  proposal,
}: {
  showBookings?: boolean;
  /**
   * Proposal mode (Phase 8E): propose a time on a draft estimate instead of
   * saving a job. `saved` is the current proposal, if any.
   */
  proposal?: { saved: ScheduleInput | null };
  estimateId: string;
  job?: Job;
  data: Pick<JobWorkspace, "workers" | "trucks" | "assignments"> & {
    requestedDate: string;
    /** The customer's preferred arrival window key (Phase 8D), if any. */
    preferredWindow?: string | null;
  };
}) {
  const state = data;
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const router = useRouter();
  const assigned = state.assignments.find((a) => a.jobId === job?.id);
  const [draft, setDraft] = useState<ScheduleInput>(
    proposal?.saved ?? {
      date: job?.date ?? state.requestedDate ?? "",
      start: job?.start ?? "",
      end: job?.end ?? "",
      arrivalStart: job?.arrivalStart ?? "",
      arrivalEnd: job?.arrivalEnd ?? "",
      workerIds: assigned?.workerIds ?? [],
      truckId: assigned?.truckId ?? "",
      ...(job?.returnDate
        ? { endDate: job.endDate, returnDate: job.returnDate }
        : {}),
    },
  );
  // Phase 9: a long-distance job has a later delivery day and a return day.
  const multiDay = Boolean(draft.returnDate);
  const [proposalMessage, setProposalMessage] = useState("");
  const [reserved, setReserved] = useState<
    (Awaited<ReturnType<typeof bookings>> & { date: string }) | null
  >(null);
  useEffect(() => {
    let active = true;
    if (showBookings && draft.date)
      void bookings(draft.date).then((result) => {
        if (active) setReserved({ ...result, date: draft.date });
      });
    return () => {
      active = false;
    };
  }, [draft.date, showBookings]);
  // Day context for suggestions and travel checks (absent before Phase 7B).
  const [day, setDay] = useState<
    | (Awaited<ReturnType<typeof scheduleOptions>> & {
        date: string;
        until: string | null;
      })
    | null
  >(null);
  const until = draft.returnDate ?? null;
  useEffect(() => {
    let active = true;
    if (draft.date)
      void scheduleOptions(estimateId, draft.date, job?.id ?? null, until).then(
        (result) => {
          if (active) setDay({ ...result, date: draft.date, until });
        },
      );
    return () => {
      active = false;
    };
  }, [draft.date, until, estimateId, job?.id]);
  // Each worker's trip days without availability, named in the suggestion.
  const withMissingDays = (
    loaded: ScheduleOptions,
    returnDate: string | null,
  ) =>
    returnDate
      ? {
          ...loaded,
          workers: loaded.workers.map((worker) => ({
            ...worker,
            missingDays: missingTripDays(
              state.workers.find((w) => w.id === worker.id)?.availability ?? [],
              draft.date,
              returnDate,
            ).map(formatShortDate),
          })),
        }
      : loaded;
  const options =
    day?.date === draft.date && day.until === until && day.state === "ready"
      ? withMissingDays(day.options, until)
      : null;
  // The same suggestion the panel shows, used to label each crew and truck card.
  const team =
    options && draft.start && draft.end && (multiDay || draft.start < draft.end)
      ? suggestTeam(options, draft.start, draft.end, multiDay)
      : null;
  /** "suggested", a blocking reason, or plain "available" for one card. */
  const fit = (id: string, kind: "worker" | "truck") => {
    if (!team) return null;
    const suggested =
      kind === "worker"
        ? team.crew.some((w) => w.id === id)
        : team.truck?.id === id;
    if (suggested) return { tone: "suggested", text: "Suggested" } as const;
    const reason = (
      kind === "worker" ? team.excludedWorkers : team.excludedTrucks
    ).find((item) => item.id === id)?.reason;
    return reason
      ? ({ tone: "blocked", text: reason } as const)
      : ({ tone: "free", text: "Available" } as const);
  };
  const statusClass = {
    suggested:
      "mt-1 inline-block rounded-full bg-success-surface px-2 py-0.5 text-xs font-semibold text-success",
    blocked: "mt-1 block text-xs text-warning",
    free: "mt-1 block text-xs text-muted-foreground",
  };
  const travel =
    options &&
    draft.start &&
    draft.end &&
    (multiDay || draft.start < draft.end) &&
    draft.workerIds.length &&
    draft.truckId
      ? checkSelection(
          options,
          draft.start,
          draft.end,
          draft.workerIds,
          draft.truckId,
          multiDay,
        )
      : null;
  const [confirmTravel, setConfirmTravel] = useState(false);
  // New jobs fill the arrival window from the work times until an
  // administrator edits it; existing jobs keep their saved window.
  const [arrivalEdited, setArrivalEdited] = useState(Boolean(job));
  const relevant =
    (reserved?.date === draft.date ? reserved.data : undefined)?.filter(
      (b) => b.job_id !== job?.id,
    ) ?? [];
  // A long-distance job occupies the rest of its first day.
  const dayEnd = multiDay ? "23:59" : draft.end;
  const collides = (b: (typeof relevant)[number]) =>
    !!draft.start &&
    !!dayEnd &&
    b.start_time.slice(0, 5) < dayEnd &&
    draft.start < b.end_time.slice(0, 5);
  const conflict = relevant.some(
    (b) =>
      collides(b) &&
      (b.truck_id === draft.truckId ||
        b.worker_ids.some((w) => draft.workerIds.includes(w))),
  );
  function reservedLabel(workerId?: string, truckId?: string) {
    if (!draft.date) return "Choose a date";
    if (!reserved || reserved.date !== draft.date) return "Checking bookings…";
    if (reserved.error) return "Bookings unavailable; checked when saving";
    const matched = relevant.filter((b) =>
      workerId ? b.worker_ids.includes(workerId) : b.truck_id === truckId,
    );
    return matched.length
      ? matched
          .map(
            (b) =>
              `${formatTimeRange(b.start_time, b.end_time)}${collides(b) ? " · Overlap" : ""}`,
          )
          .join("; ")
      : "none";
  }
  const [error, setError] = useState("");
  const id = useRef(job?.id ?? null);
  const revision = useRef(job?.revision ?? null);
  const feedback = useRef<HTMLParagraphElement>(null);
  function availabilityLabel(worker: JobWorkspace["workers"][number]) {
    if (!draft.date) return "Choose a date to see availability";
    const weekday = new Date(draft.date + "T12:00:00Z").getUTCDay();
    const day = days[(weekday + 6) % 7];
    const available = worker.availability.find((a) => a.day === day);
    const first = !available
      ? "Availability not configured for this day"
      : available.available
        ? `${day} ${formatTimeRange(available.start, available.end)}`
        : `Unavailable on ${day}`;
    // Long-distance: also name trip days the worker is not available.
    const missing = draft.returnDate
      ? missingTripDays(worker.availability, draft.date, draft.returnDate)
      : [];
    return missing.length
      ? `${first} · not available ${listText(missing.map(formatShortDate))}`
      : first;
  }
  const [filled, setFilled] = useState("");
  /**
   * One click: work start and arrival window from the customer's preference
   * (8:00 with a one-hour window otherwise), the end from the planned trip
   * (Phase 9: several days for long-distance moves, including the drive back),
   * and the suggested crew and truck for that span.
   */
  async function fillFromRequest() {
    if (!options) return;
    const preferred = arrivalWindow(state.preferredWindow);
    const start = preferred?.start ?? "08:00";
    const plan = options.trip
      ? planTrip({ date: draft.date, start, ...options.trip })
      : null;
    const end = plan?.endTime ?? addMinutes(start, options.jobMinutes ?? 240);
    // Before the Phase 9 migration, long-distance moves are scheduled by hand.
    if (plan?.longDistance && options.away === undefined) {
      setFilled(
        "This move does not fit one working day, and multi-day scheduling is not enabled yet. Set the times by hand.",
      );
      return;
    }
    const longDistance = plan?.longDistance ?? false;
    const arrival = preferred
      ? {
          arrivalStart: preferred.start,
          arrivalEnd: longDistance || preferred.end < end ? preferred.end : end,
        }
      : defaultArrival(start, longDistance ? "" : end);
    // Suggest for the whole span, so crews away on other trips are left out.
    const spanOptions = longDistance
      ? await scheduleOptions(
          estimateId,
          draft.date,
          job?.id ?? null,
          plan!.returnDate,
        )
          .then((result) =>
            result.state === "ready"
              ? withMissingDays(result.options, plan!.returnDate)
              : null,
          )
          .catch(() => null)
      : options;
    const team = spanOptions
      ? suggestTeam(spanOptions, start, end, longDistance)
      : null;
    const complete =
      !!team && team.crew.length > 0 && team.shortBy === 0 && !!team.truck;
    setDraft({
      date: draft.date,
      start,
      end,
      ...arrival,
      workerIds: complete ? team!.crew.map((w) => w.id) : draft.workerIds,
      truckId: complete ? team!.truck!.id : draft.truckId,
      ...(longDistance
        ? { endDate: plan!.endDate, returnDate: plan!.returnDate! }
        : {}),
    });
    setArrivalEdited(true);
    setConfirmTravel(false);
    setError("");
    const teamText = complete
      ? "Suggested crew and truck selected. Review, then confirm."
      : "No full crew and truck are free for this; choose them below or try another date.";
    setFilled(
      longDistance
        ? `Long-distance move: loads ${formatDate(draft.date)}, delivers ${formatDate(plan!.endDate)} by about ${end}, crew and truck back ${formatDate(plan!.returnDate!)} (up to ${dailyHours} h of work and driving a day). ${teamText}`
        : `Filled from the request: ${preferred ? preferred.label.toLowerCase() : "8:00 a.m. start"}, until ${end}. ${teamText}`,
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (saving.current) return;
    const checked = validateSchedule(draft);
    if (checked.error) {
      setError(checked.error);
      requestAnimationFrame(() => feedback.current?.focus());
      return;
    }
    saving.current = true;
    if (proposal) {
      startTransition(async () => {
        const result = await saveProposal(estimateId, {
          ...draft,
          confirmUnknownTravel: confirmTravel,
        }).catch(() => ({
          ok: false,
          message: "The proposal could not be confirmed. Refresh and check.",
        }));
        saving.current = false;
        setError(result.ok ? "" : result.message);
        setProposalMessage(result.ok ? result.message : "");
        if (result.ok) router.refresh();
        else requestAnimationFrame(() => feedback.current?.focus());
      });
      return;
    }
    startTransition(async () => {
      const result = await saveSchedule(
        estimateId,
        id.current,
        revision.current,
        { ...draft, confirmUnknownTravel: confirmTravel },
      ).catch(() => ({
        id: undefined,
        message:
          "The save could not be confirmed. Check Jobs & schedule before retrying.",
      }));
      if (result.id) {
        router.push("/admin/jobs/" + result.id);
        router.refresh();
      } else {
        saving.current = false;
        setError(result.message);
        requestAnimationFrame(() => feedback.current?.focus());
      }
    });
  }
  return (
    <Panel>
      <h2 className="font-semibold">
        {proposal
          ? "Proposed appointment (optional)"
          : job
            ? "Edit scheduled job"
            : "Confirm a schedule"}
      </h2>
      {proposal && (
        <p className="text-sm leading-6">
          Offer a time with this estimate. When the customer accepts, the move
          is booked for this time if the crew and truck are still free;
          otherwise you schedule it as usual. The customer sees only the date
          and arrival window.
        </p>
      )}
      <p className="text-sm leading-6 text-muted-foreground">
        All dates and times are Central Time (America/Chicago). Preferred dates
        are suggestions. Arrival windows are on the first day. Long-distance
        moves keep the crew and truck until the day they are back. Availability,
        overlapping bookings and travel time from each team member&apos;s
        previous job are checked again when saving.
      </p>
      <form
        noValidate
        onSubmit={submit}
        aria-describedby="schedule-error"
        className="space-y-5"
      >
        {options && (
          <div className="space-y-2 rounded-lg border border-dashed p-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!hydrated || pending}
              onClick={fillFromRequest}
            >
              Fill in from the request
            </Button>
            <p className="text-sm text-muted-foreground">
              {arrivalWindow(state.preferredWindow)
                ? `The customer prefers ${arrivalWindow(state.preferredWindow)!.label.toLowerCase()}.`
                : "The customer did not choose an arrival window."}{" "}
              Sets the times from the inventory and picks the suggested team.
            </p>
            <p role="status" className="text-sm">
              {filled}
            </p>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { key: "date", label: "Confirmed date", type: "date" },
              { key: "start", label: "Work start (CT)", type: "time" },
              { key: "end", label: "Work end (CT)", type: "time" },
              {
                key: "arrivalStart",
                label: "Arrival window start (CT)",
                type: "time",
              },
              {
                key: "arrivalEnd",
                label: "Arrival window end (CT)",
                type: "time",
              },
            ] as const
          ).map((f) => (
            <div key={f.key} className="min-w-0 space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                disabled={!hydrated || pending}
                id={f.key}
                required
                type={f.type}
                className="min-h-11"
                value={draft[f.key]}
                onChange={(e) => {
                  const next = { ...draft, [f.key]: e.target.value };
                  if (f.key === "arrivalStart" || f.key === "arrivalEnd")
                    setArrivalEdited(true);
                  else if (
                    !arrivalEdited &&
                    (f.key === "start" || f.key === "end")
                  )
                    Object.assign(next, defaultArrival(next.start, next.end));
                  setDraft(next);
                }}
                aria-describedby={
                  f.key === "arrivalStart"
                    ? "arrival-hint schedule-error"
                    : "schedule-error"
                }
              />
            </div>
          ))}
        </div>
        {(multiDay || options?.away !== undefined) && (
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">
              Long-distance move
            </legend>
            <Label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={multiDay}
                disabled={!hydrated || pending || !draft.date}
                onChange={(e) => {
                  setConfirmTravel(false);
                  if (e.target.checked)
                    setDraft({
                      ...draft,
                      endDate: addDays(draft.date, 1),
                      returnDate: addDays(draft.date, 2),
                    });
                  else {
                    const rest = { ...draft };
                    delete rest.endDate;
                    delete rest.returnDate;
                    setDraft(rest);
                  }
                }}
              />
              Multi-day move (the crew drives the truck back)
            </Label>
            {multiDay && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      { key: "endDate", label: "Delivery date" },
                      { key: "returnDate", label: "Crew and truck back on" },
                    ] as const
                  ).map((f) => (
                    <div key={f.key} className="min-w-0 space-y-2">
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <Input
                        id={f.key}
                        type="date"
                        required
                        min={draft.date}
                        disabled={!hydrated || pending}
                        className="min-h-11"
                        value={draft[f.key] ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [f.key]: e.target.value })
                        }
                        aria-describedby="multi-day-hint schedule-error"
                      />
                    </div>
                  ))}
                </div>
                <p
                  id="multi-day-hint"
                  className="text-sm text-muted-foreground"
                >
                  Work end is when unloading finishes on the delivery day. The
                  crew and truck are booked from the work start until the end of
                  the day they are back.
                </p>
              </>
            )}
          </fieldset>
        )}
        <p id="arrival-hint" className="text-sm text-muted-foreground">
          {arrivalEdited
            ? "The arrival window is what the customer sees."
            : "The arrival window follows the work start (one hour) until you change it."}
        </p>
        {options && (
          <ScheduleSuggestion
            options={options}
            start={draft.start}
            end={draft.end}
            multiDay={multiDay}
            disabled={!hydrated || pending}
            onApply={(workerIds, truckId) => {
              setDraft({ ...draft, workerIds, truckId });
              setConfirmTravel(false);
            }}
          />
        )}
        {day?.date === draft.date && day.state === "error" && (
          <p className="text-sm text-warning">
            Suggestions and travel times are unavailable right now; travel is
            checked again when saving.
          </p>
        )}
        <fieldset disabled={!hydrated || pending} className="space-y-3">
          <legend className="mb-2 font-semibold">
            Assign workers · select at least one
          </legend>
          {!state.workers.length && (
            <p className="text-sm text-warning">
              No worker accounts are configured. An administrator must provision
              a worker and its availability before scheduling.
            </p>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {state.workers.map((w) => {
              const status = fit(w.id, "worker");
              return (
                <label
                  key={w.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border p-3.5 text-sm has-checked:border-primary has-checked:bg-surface has-focus-visible:ring-3 has-focus-visible:ring-ring"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-primary outline-none"
                    checked={draft.workerIds.includes(w.id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        workerIds: e.target.checked
                          ? [...draft.workerIds, w.id]
                          : draft.workerIds.filter((id) => id !== w.id),
                      })
                    }
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block font-semibold">{w.name}</span>
                    <span className="block text-muted-foreground">
                      {availabilityLabel(w)}
                    </span>
                    {status && (
                      <span className={statusClass[status.tone]}>
                        {status.text}
                      </span>
                    )}
                    {showBookings && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Other jobs that day: {reservedLabel(w.id)}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {!state.trucks.length && (
          <p className="text-sm text-warning">
            No trucks are available to select. Contact your administrator.
          </p>
        )}
        <fieldset
          disabled={!hydrated || pending}
          aria-describedby="schedule-error"
          className="space-y-3"
        >
          <legend className="mb-2 font-semibold">Assigned truck</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {state.trucks.map((t) => {
              const status = fit(t.id, "truck");
              return (
                <label
                  key={t.id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border p-3.5 text-sm has-checked:border-primary has-checked:bg-surface has-focus-visible:ring-3 has-focus-visible:ring-ring"
                >
                  <input
                    type="radio"
                    name="truck"
                    value={t.id}
                    required
                    className="mt-0.5 size-5 shrink-0 accent-primary outline-none"
                    checked={draft.truckId === t.id}
                    onChange={() => setDraft({ ...draft, truckId: t.id })}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block font-semibold">{t.name}</span>
                    {status && (
                      <span className={statusClass[status.tone]}>
                        {status.text}
                      </span>
                    )}
                    {showBookings && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Other jobs that day: {reservedLabel(undefined, t.id)}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {conflict && (
          <p role="status" className="text-warning">
            The selected worker or truck overlaps an existing booking. Choose
            another time or assignment before saving.
          </p>
        )}
        {travel && travel.blocking.length > 0 && (
          <div role="status" className="space-y-1 text-sm text-warning">
            {travel.blocking.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {travel.earliestStart && (
              <p className="font-medium">
                Earliest feasible start for this team: {travel.earliestStart}.
              </p>
            )}
          </div>
        )}
        {travel && travel.unknown.length > 0 && (
          <div className="space-y-2 rounded-lg bg-warning-surface p-3 text-sm text-warning">
            {travel.unknown.map((message) => (
              <p key={message}>{message}</p>
            ))}
            <Label className="flex min-h-11 items-center gap-3 text-foreground">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={confirmTravel}
                disabled={!hydrated || pending}
                onChange={(e) => setConfirmTravel(e.target.checked)}
              />
              I confirmed the team can travel between these jobs.
            </Label>
          </div>
        )}
        <p
          id="schedule-error"
          role="alert"
          ref={feedback}
          tabIndex={-1}
          className="rounded-sm text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {error}
        </p>
        {!proposal && (
          <p className="text-sm text-muted-foreground">
            Save the appointment, team and truck together. The customer can view
            the confirmed schedule.
          </p>
        )}
        <p role="status" className="text-sm">
          {proposalMessage}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={
              !hydrated ||
              pending ||
              !state.workers.length ||
              !state.trucks.length
            }
            className="h-auto min-h-11 whitespace-normal"
          >
            {pending
              ? "Saving…"
              : proposal
                ? "Save proposed appointment"
                : "Save schedule"}
          </Button>
          {proposal?.saved && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!hydrated || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await saveProposal(estimateId, null).catch(
                    () => ({ ok: false, message: "Refresh and try again." }),
                  );
                  setError(result.ok ? "" : result.message);
                  setProposalMessage(result.ok ? result.message : "");
                  if (result.ok) router.refresh();
                })
              }
            >
              Remove proposal
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
