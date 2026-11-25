"use client";
import { moveReference, moveTitle, shortReference } from "@/lib/reference";

import { useRef, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { decideEstimate as saveDecision } from "@/lib/estimates/actions";
import type { EstimateWorkspace } from "@/lib/estimates/data";
import { ArrowLeft, Check, X } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { PageHeading } from "@/components/page-heading";
import { ProgressSteps } from "@/components/progress-steps";
import { progressFor } from "@/lib/domain/status";
import type { MoveView } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatMonthDay,
  formatMoney as money,
  formatShortDate,
  formatTimeRange,
} from "@/lib/format";
import { controlClass, Panel, textLinkClass } from "../../customer-ui";
import {
  declineReasonLabel,
  declineReasons,
  validateDecline,
} from "@/lib/estimates/decline";

export function EstimateDetails({
  id,
  data,
  askReason = false,
}: {
  id: string;
  /** Declining asks for a reason (Phase 8C, when available). */
  askReason?: boolean;
  data: Pick<EstimateWorkspace, "estimates"> & {
    moves: {
      id: string;
      referenceNumber?: number;
      pickup: string;
      destination: string;
      stage: MoveView["stage"];
      requestStatus?: MoveView["requestStatus"];
    }[];
  };
}) {
  const { estimates, moves } = data;
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const saving = useRef(false);
  const estimate = estimates.find((item) => item.id === id);
  const move = moves.find((item) => item.id === estimate?.moveId);
  const [decision, setDecision] = useState<"accepted" | "declined">("accepted");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const confirmed = useRef(false);
  const result = useRef<HTMLParagraphElement>(null);
  const [feedback, setFeedback] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reasonError, setReasonError] = useState("");

  const backLink = (
    <Link
      href="/customer/estimates"
      className={cn(textLinkClass, "mb-2 gap-2")}
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to estimates
    </Link>
  );
  if (!estimate || !move) notFound();

  const total = money(
    estimate.lines.reduce((sum, line) => sum + line.amountCents, 0),
  );

  function openDecision(
    event: MouseEvent<HTMLButtonElement>,
    next: "accepted" | "declined",
  ) {
    trigger.current = event.currentTarget;
    confirmed.current = false;
    setReasonError("");
    setDecision(next);
    dialog.current?.showModal();
  }

  function confirm() {
    if (saving.current) return;
    const withReason = askReason && decision === "declined";
    if (withReason) {
      const checked = validateDecline(reason, note);
      if ("error" in checked) {
        setReasonError(checked.error);
        return;
      }
    }
    saving.current = true;
    startTransition(async () => {
      const outcome = await saveDecision(
        id,
        decision,
        withReason ? { reason, note } : undefined,
      ).catch(() => ({
        ok: false,
        message:
          "The decision could not be confirmed. Refresh before retrying.",
      }));
      setFeedback(outcome.message);
      confirmed.current = true;
      dialog.current?.close();
      saving.current = false;
      router.refresh();
    });
  }

  function restoreFocus() {
    requestAnimationFrame(() => {
      if (confirmed.current) result.current?.focus();
      else trigger.current?.focus();
    });
  }

  const sectionLabel =
    "mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase";
  const summaryClass =
    "flex min-h-11 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden";

  return (
    <>
      {backLink}
      <PageHeading
        eyebrow={
          <span className="[overflow-wrap:anywhere]">
            Move #{moveReference(move.id, move.referenceNumber)} ·{" "}
            {moveTitle(move)} · version {estimate.version ?? 1}
            {estimate.isCurrent === false ? " · previous estimate" : ""}
          </span>
        }
        title={
          estimate.status === "awaiting"
            ? "Review your estimate"
            : "Your estimate"
        }
        badge={<StatusBadge status={estimate.status} />}
      />
      {move.stage !== "cancelled" && move.requestStatus !== "cancelled" && (
        <ProgressSteps
          className="mb-6"
          label="Move progress"
          steps={progressFor(move, estimate)}
        />
      )}

      {/* DOM order is the small-screen reading order: the summary and the
          one set of decision controls first, then route, price and terms. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel className="gap-4 lg:col-start-2 lg:row-start-1">
          <div>
            <h2 className="text-sm text-muted-foreground">Estimated total</h2>
            <p className="mt-1 text-[40px] leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums">
              {total}
            </p>
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Estimate {shortReference(estimate.id)}
            </p>
          </div>
          {estimate.status === "awaiting" && (
            <>
              {estimate.proposal ? (
                <div className="space-y-1 rounded-[14px] bg-muted p-3.5 text-sm leading-6">
                  <p className="font-medium">
                    Proposed: {formatShortDate(estimate.proposal.date)} ·
                    arrival{" "}
                    {formatTimeRange(
                      estimate.proposal.arrivalStart,
                      estimate.proposal.arrivalEnd,
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Accepting books this time if the crew and truck are still
                    free. Otherwise we will confirm a new time.
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Accepting this estimate does not confirm your moving date.
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                <Button
                  disabled={pending}
                  className="w-full"
                  onClick={(event) => openDecision(event, "accepted")}
                >
                  {estimate.proposal
                    ? `Accept and book ${formatMonthDay(estimate.proposal.date)}`
                    : "Accept estimate"}
                </Button>
                <Button
                  disabled={pending}
                  variant="outline"
                  className="w-full"
                  onClick={(event) => openDecision(event, "declined")}
                >
                  {askReason ? "Request changes" : "Decline estimate"}
                </Button>
              </div>
            </>
          )}
          <p
            ref={result}
            tabIndex={-1}
            role="status"
            aria-atomic="true"
            className={cn(
              "rounded-sm text-sm leading-6 outline-none focus-visible:ring-3 focus-visible:ring-ring",
              !feedback && "sr-only",
            )}
          >
            {feedback}
          </p>
          {estimate.status !== "awaiting" && !feedback && (
            <p className="text-sm leading-6 text-muted-foreground">
              {estimate.status === "accepted"
                ? "This estimate has been accepted. Acceptance does not confirm a moving date."
                : "This estimate has been declined and is marked for coordinator review."}
            </p>
          )}
          {estimate.status === "declined" && estimate.declineReason && (
            <div className="text-sm leading-6">
              <p className="font-medium">
                Your reason: {declineReasonLabel(estimate.declineReason)}
              </p>
              {estimate.declineNote && (
                <p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                  {estimate.declineNote}
                </p>
              )}
            </div>
          )}
          <p className="text-[13px] text-muted-foreground">
            Questions?{" "}
            <Link href="/customer/messages" className={textLinkClass}>
              Message us
            </Link>
          </p>
        </Panel>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
          <Panel className="gap-0">
            <h2 className={sectionLabel}>Route</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Pickup", address: move.pickup },
                { label: "Destination", address: move.destination },
              ].map(({ label, address }) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[13px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {address}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel className="gap-0">
            <h2 className={sectionLabel}>Price</h2>
            <dl className="text-sm">
              {estimate.lines.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b py-3 leading-6"
                >
                  <dt className="[overflow-wrap:anywhere]">{line.label}</dt>
                  <dd className="text-right whitespace-nowrap tabular-nums">
                    {money(line.amountCents)}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 pt-4 text-base font-semibold">
                <dt>Total</dt>
                <dd className="text-right whitespace-nowrap tabular-nums">
                  {total}
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel className="gap-0 divide-y py-2 sm:py-2">
            <details className="group py-3">
              <summary className={summaryClass}>
                What&apos;s included
                <span className="text-sm font-normal text-muted-foreground">
                  {estimate.inclusions.length} included ·{" "}
                  {estimate.exclusions.length} not included
                </span>
              </summary>
              <div className="mt-3 grid gap-5 sm:grid-cols-2">
                {[
                  {
                    title: "Included",
                    items: estimate.inclusions,
                    Icon: Check,
                  },
                  {
                    title: "Not included",
                    items: estimate.exclusions,
                    Icon: X,
                  },
                ].map(({ title, items, Icon }) => (
                  <section key={title}>
                    <h3 className="mb-2 text-sm font-semibold">{title}</h3>
                    <ul className="space-y-2 text-sm leading-6 [overflow-wrap:anywhere]">
                      {items.map((item, index) => (
                        <li key={index} className="flex gap-2.5">
                          <Icon
                            aria-hidden="true"
                            className={cn(
                              "mt-1 size-4 shrink-0",
                              title === "Included"
                                ? "text-success"
                                : "text-muted-foreground",
                            )}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </details>
            <details className="py-3">
              <summary className={summaryClass}>
                Terms
                <span className="text-sm font-normal text-muted-foreground">
                  Not a binding quote
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                {estimate.terms}
              </p>
            </details>
          </Panel>
          <Link href={`/customer/moves/${move.id}`} className={textLinkClass}>
            View related move
          </Link>
        </div>
      </div>

      <dialog
        ref={dialog}
        onClose={restoreFocus}
        onCancel={(event) => {
          if (saving.current) event.preventDefault();
        }}
        aria-labelledby="decision-title"
        aria-describedby="decision-description"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-foreground/40"
      >
        <h2 id="decision-title" className="text-xl font-semibold">
          {decision === "accepted"
            ? "Accept this estimate?"
            : askReason
              ? "Request changes or decline?"
              : "Decline this estimate?"}
        </h2>
        <p
          id="decision-description"
          className="mt-3 text-sm leading-6 text-muted-foreground"
        >
          {decision === "declined" && askReason
            ? "Tell us why so we can send a revised estimate. This estimate will be marked declined."
            : estimate.proposal
              ? `Accepting books ${formatDate(estimate.proposal.date)}, arrival ${formatTimeRange(estimate.proposal.arrivalStart, estimate.proposal.arrivalEnd)}, if the crew and truck are still free. Otherwise an administrator confirms a new time.`
              : "Acceptance does not confirm a moving date. An administrator must schedule the move."}
        </p>
        {decision === "declined" && askReason && (
          <div className="mt-4 space-y-4">
            <fieldset
              className="space-y-2"
              aria-describedby={reasonError ? "decline-error" : undefined}
            >
              <legend className="mb-1 text-sm font-medium">Reason</legend>
              {declineReasons.map((option) => (
                <label
                  key={option.key}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    value={option.key}
                    checked={reason === option.key}
                    disabled={pending}
                    onChange={() => {
                      setReason(option.key);
                      setReasonError("");
                    }}
                    className="size-4"
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <div className="space-y-2">
              <label htmlFor="decline-note" className="text-sm font-medium">
                {reason === "other"
                  ? "What should change?"
                  : "What should change? (optional)"}
              </label>
              <textarea
                id="decline-note"
                rows={3}
                maxLength={500}
                value={note}
                disabled={pending}
                onChange={(event) => {
                  setNote(event.target.value);
                  setReasonError("");
                }}
                className={controlClass}
              />
            </div>
            <p
              id="decline-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {reasonError}
            </p>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            disabled={pending}
            variant="outline"
            className="min-h-11"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button disabled={pending} className="min-h-11" onClick={confirm}>
            {decision === "accepted"
              ? "Confirm acceptance"
              : askReason &&
                  declineReasons.find((option) => option.key === reason)
                    ?.changes
                ? "Send change request"
                : "Confirm decline"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
