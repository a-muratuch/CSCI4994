"use client";
import {
  formatArrival,
  formatShortDate as dateLabel,
  formatWork,
} from "@/lib/format";
import { moveReference, shortReference } from "@/lib/reference";
import { OpenChat } from "@/components/messages/controls";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, MapPin, Phone, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressSteps } from "@/components/progress-steps";
import { Timeline } from "@/components/timeline";
import { statusLabels } from "@/lib/domain";
import { workerProgressFor } from "@/lib/domain/status";
import type { WorkerWorkspace } from "@/lib/workers/data";
import { cn } from "@/lib/utils";
import { Heading, StatusBadge, linkClass, panelClass } from "../../worker-ui";
import { advanceJob, markOnTheWay } from "@/lib/workers/actions";

const sectionHeading = "text-[17px] font-semibold";

export default function JobDetailsPage({
  jobs,
  phone,
  progress,
  photos,
}: Pick<WorkerWorkspace, "jobs"> & {
  phone?: string;
  /** Phase 8G steps, when available: delivery photos so far and today's date. */
  progress?: { deliveryPhotos: number; today: string };
  /** The photos panel; the upload shortcut links to it. */
  photos?: React.ReactNode;
}) {
  const job = jobs[0];
  const [pending, startTransition] = useTransition();
  const trigger = useRef<HTMLButtonElement>(null);
  const expected = useRef<{ status: string; revision: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const [resultMessage, setResultMessage] = useState("");
  if (!job)
    return (
      <>
        <Heading title="Job unavailable">
          This job is not assigned to this worker or is no longer available.
        </Heading>
        <Link href="/worker" className={linkClass}>
          Back to assigned jobs
        </Link>
      </>
    );
  const open = job.status === "scheduled" || job.status === "in-progress";
  const nextLabel =
    job.status === "scheduled"
      ? progress
        ? "Arrived"
        : "In progress"
      : "Completed";
  // Completion needs a delivery photo unless an administrator waived it.
  const needsPhoto =
    !!progress &&
    job.status === "in-progress" &&
    progress.deliveryPhotos === 0 &&
    !job.photoWaived;
  // "On the way" is offered only on the job date, once.
  const canMarkOnTheWay =
    !!progress &&
    job.status === "scheduled" &&
    !job.onTheWay &&
    job.date === progress.today;

  return (
    <>
      <Link href="/worker" className={cn(linkClass, "mb-2 gap-2")}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to assigned jobs
      </Link>
      <Heading
        eyebrow={`Job ${shortReference(job.id)} · ${job.size} · Request ${moveReference(job.requestId, job.referenceNumber)}`}
        title={job.customer}
        badge={<StatusBadge status={job.status} />}
      />
      {/* Phone layout (WorkJobPhone): what the crew needs first on the road.
          From md the appointment card below shows the same details. */}
      <div className="mb-5 flex flex-col gap-3 md:hidden">
        <section
          aria-labelledby="phone-arrival"
          className="rounded-[20px] bg-primary p-5 text-primary-foreground"
        >
          <p
            id="phone-arrival"
            className="text-xs font-semibold tracking-[0.08em] text-brand-on-primary uppercase"
          >
            Arrival window
          </p>
          <p className="mt-1 text-[30px] leading-tight font-semibold tracking-tight">
            {formatArrival(job.arrival)}
          </p>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {dateLabel(job.date)} · work {formatWork(job)} · {job.truck}
          </p>
        </section>
        <div className="grid grid-cols-2 gap-2.5">
          {phone ? (
            <a
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
              aria-label={`Call the customer, ${phone}`}
            >
              <Phone aria-hidden="true" />
              Call
            </a>
          ) : (
            <span className="grid min-h-11 place-items-center rounded-full border text-sm text-muted-foreground">
              No phone
            </span>
          )}
          <OpenChat
            kind="move-team"
            target={job.id}
            className="w-full border-input bg-background text-foreground hover:bg-muted"
          >
            Team chat
          </OpenChat>
        </div>
        <section
          aria-labelledby="phone-destination"
          className="flex flex-col gap-1.5 rounded-[20px] border bg-card p-4"
        >
          <p
            id="phone-destination"
            className="text-[13px] text-muted-foreground"
          >
            Destination
          </p>
          <p className="text-[15px] font-medium [overflow-wrap:anywhere]">
            {job.destination}
          </p>
          <a
            className={cn(linkClass, "gap-1.5")}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.destination)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin aria-hidden="true" className="size-3.5" />
            Open in maps <span className="sr-only">(new tab)</span>
          </a>
          {job.access && (
            <p className="text-[13px] text-foreground/80 [overflow-wrap:anywhere]">
              {job.access}
            </p>
          )}
        </section>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className={panelClass}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className={sectionHeading}>Progress</h2>
              <p
                ref={feedback}
                tabIndex={-1}
                role="status"
                className="rounded-sm text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                {resultMessage ||
                  `Current status: ${statusLabels[job.status]}.`}
              </p>
            </div>
            {progress && job.status !== "cancelled" && (
              <ProgressSteps
                label="Job progress"
                steps={workerProgressFor(job)}
              />
            )}
            {open ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Update the next step for this assigned job. The customer can
                  follow your progress.
                </p>
                {job.status === "scheduled" && job.onTheWay && (
                  <p className="text-sm font-medium">
                    On the way · the customer was notified.
                  </p>
                )}
                {job.photoWaived && (
                  <p className="text-sm text-muted-foreground">
                    An administrator waived the delivery photo
                    {job.photoWaiverNote ? `: ${job.photoWaiverNote}` : "."}
                  </p>
                )}
                {needsPhoto && (
                  <p
                    id="delivery-photo-hint"
                    className="flex items-start gap-2.5 rounded-2xl bg-warning-surface px-4 py-3 text-sm leading-6 text-warning"
                  >
                    <TriangleAlert
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0"
                    />
                    Add at least one delivery photo in Photos below before
                    completing. An administrator can waive this.
                  </p>
                )}
                {/* One set of actions: a fixed bottom bar on phones, inline
                    from md. Safe-area padding keeps it clear of the home bar. */}
                <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:z-auto md:flex-row md:flex-wrap md:gap-3 md:border-0 md:bg-transparent md:p-0">
                  {needsPhoto && photos && (
                    <a
                      href="#move-photos"
                      className={cn(buttonVariants(), "w-full md:w-auto")}
                    >
                      <Camera aria-hidden="true" />
                      Upload delivery photo
                    </a>
                  )}
                  {canMarkOnTheWay && (
                    <Button
                      variant="outline"
                      className="w-full md:w-auto"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await markOnTheWay(
                            job.id,
                            job.revision,
                          ).catch(() => ({
                            ok: false,
                            message:
                              "The update could not be confirmed. Reload the job before retrying.",
                          }));
                          setResultMessage(result.message);
                          requestAnimationFrame(() =>
                            feedback.current?.focus(),
                          );
                        })
                      }
                    >
                      Mark on the way
                    </Button>
                  )}
                  <Button
                    ref={trigger}
                    className="w-full md:w-auto"
                    disabled={needsPhoto}
                    aria-describedby={
                      needsPhoto ? "delivery-photo-hint" : undefined
                    }
                    onClick={() => {
                      expected.current = {
                        status: job.status,
                        revision: job.revision,
                      };
                      dialog.current?.showModal();
                    }}
                  >
                    Mark {nextLabel.toLowerCase()}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-success">
                This job is closed. Further progress changes are unavailable.
              </p>
            )}
          </Card>

          <Card className={cn(panelClass, "max-md:hidden")}>
            <h2 className={sectionHeading}>
              {job.status === "completed"
                ? "Completed appointment"
                : job.status === "cancelled"
                  ? "Cancelled appointment"
                  : "Confirmed appointment"}
            </h2>
            <div>
              <p className="text-[13px] text-muted-foreground">
                Customer arrival window
              </p>
              <p className="text-[30px] leading-tight font-semibold tracking-tight">
                {formatArrival(job.arrival)}
              </p>
              <p className="mt-1 text-sm text-foreground/80">
                {dateLabel(job.date)} · scheduled work {formatWork(job)}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2.5">
              {phone && (
                <a
                  className={buttonVariants({ variant: "outline" })}
                  href={`tel:${phone.replace(/[^+0-9]/g, "")}`}
                  aria-label={`Call the customer, ${phone}`}
                >
                  <Phone aria-hidden="true" />
                  {phone}
                </a>
              )}
              <OpenChat
                kind="move-team"
                target={job.id}
                className="border-input bg-background text-foreground hover:bg-muted"
              >
                {job.status === "completed" || job.status === "cancelled"
                  ? "View move-team chat"
                  : "Open move-team chat"}
              </OpenChat>
            </div>
            <p className="text-sm text-foreground/80 [overflow-wrap:anywhere]">
              Crew: {job.crew.join(", ")} · Truck: {job.truck}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Only an admin can change the date, time, crew, or truck.
              Availability changes do not reschedule this job.
            </p>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card className={panelClass}>
            <h2 className={sectionHeading}>Move details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Pickup", job.pickup],
                ["Destination", job.destination],
                ["Move size", job.size],
                ["Items", job.items],
                ["Access requirements", job.access],
                ["Notes", job.notes],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {value || "—"}
                  </dd>
                  {(label === "Pickup" || label === "Destination") && (
                    <a
                      className={cn(linkClass, "gap-1.5 text-[13px]")}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin aria-hidden="true" className="size-3.5" />
                      Open {label.toLowerCase()} in Maps{" "}
                      <span className="sr-only">(new tab)</span>
                    </a>
                  )}
                </div>
              ))}
            </dl>
          </Card>
          {photos && (
            <div id="move-photos" className="scroll-mt-4">
              {photos}
            </div>
          )}
          <Card className={panelClass}>
            <h2 className={sectionHeading}>Progress history</h2>
            <Timeline
              items={job.history.map((event, index) => ({
                id: `${event.label}-${index}`,
                title: event.label,
                meta: `${dateLabel(event.date)}${event.detail ? ` · ${event.detail}` : ""}`,
              }))}
            />
            <Link href="/worker/history" className={linkClass}>
              View completed history
            </Link>
          </Card>
        </div>
      </div>
      {/* Keeps the last card clear of the fixed phone action bar. */}
      {open && <div aria-hidden="true" className="h-36 md:hidden" />}
      <dialog
        onCancel={(event) => {
          event.preventDefault();
          if (!pending) {
            dialog.current?.close();
            trigger.current?.focus();
          }
        }}
        ref={dialog}
        aria-labelledby="progress-title"
        aria-describedby="progress-description"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-foreground/40"
      >
        <h2 id="progress-title" className="text-xl font-semibold">
          Mark job {nextLabel.toLowerCase()}?
        </h2>
        <p
          id="progress-description"
          className="mt-3 text-sm leading-6 text-muted-foreground"
        >
          Confirm this progress update. The schedule and assignments stay the
          same.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            autoFocus
            disabled={pending}
            variant="outline"
            onClick={() => {
              dialog.current?.close();
              trigger.current?.focus();
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              const context = expected.current;
              if (!context) return;
              startTransition(async () => {
                const result = await advanceJob(
                  job.id,
                  context.status,
                  context.revision,
                ).catch(() => ({
                  ok: false,
                  message:
                    "The update could not be confirmed. Reload the job before retrying.",
                }));
                setResultMessage(result.message);
                dialog.current?.close();
                requestAnimationFrame(() => feedback.current?.focus());
              });
            }}
          >
            {pending ? "Saving…" : "Confirm progress"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
