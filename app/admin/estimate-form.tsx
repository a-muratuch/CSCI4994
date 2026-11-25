"use client";
import { useHydrated } from "@/lib/use-hydrated";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEstimate } from "@/lib/estimates/actions";
import {
  validateEstimate,
  estimateFieldErrors,
  splitLines,
  type EstimateDefaults,
} from "@/lib/estimates/validation";
import { suggestEstimate } from "@/lib/estimates/suggestion";
import { parseCents, type Estimate } from "@/lib/domain";
import { controlClass, money, Panel } from "./admin-ui";
import {
  EstimateSuggestion,
  type SuggestionInput,
} from "./estimate-suggestion";

export function EstimateForm({
  requestId,
  estimate,
  suggestion,
  defaults,
  context,
  proposal,
}: {
  requestId: string;
  estimate?: Estimate;
  /** Inventory-based suggestion inputs, when available for a new draft. */
  suggestion?: SuggestionInput;
  /** Standard inclusions, exclusions and terms for a new draft (Phase 8B). */
  defaults?: EstimateDefaults;
  /** Short request summary for the side card, e.g. customer and route. */
  context?: React.ReactNode;
  /** Saved-draft proposal panel; a new draft shows a note instead. */
  proposal?: React.ReactNode;
}) {
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const router = useRouter();
  const identifier = useRef(estimate?.id ?? null);
  const revision = useRef(estimate?.revision ?? 0);
  // A new draft starts from the inventory suggestion (when there is one)
  // and the standard text; the administrator reviews everything before saving.
  const [prefilled] = useState(() =>
    !estimate && suggestion
      ? suggestEstimate({
          lines: suggestion.lines,
          settings: suggestion.settings,
          trucks: suggestion.trucks,
          miles: suggestion.estimatedMiles,
        })
      : null,
  );
  const [lines, setLines] = useState(
    (estimate?.lines ?? prefilled?.lines)?.map((l) => ({
      label: l.label,
      price: (l.amountCents / 100).toFixed(2),
    })) ?? [{ label: "", price: "" }],
  );
  const [inclusions, setInclusions] = useState(
    (estimate?.inclusions ?? defaults?.inclusions)?.join("\n") ?? "",
  );
  const [exclusions, setExclusions] = useState(
    (estimate?.exclusions ?? defaults?.exclusions)?.join("\n") ?? "",
  );
  const [terms, setTerms] = useState(
    estimate?.terms ??
      defaults?.terms ??
      "These terms are not a binding quote. No payment is collected. Acceptance does not confirm a date; an admin must schedule the move and assign resources.",
  );
  const publishDialog = useRef<HTMLDialogElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  const total = lines.reduce((sum, l) => sum + (parseCents(l.price) ?? 0), 0);
  /** The form values when valid; otherwise shows the errors and returns null. */
  function checkedValue() {
    const value = {
      lines: lines.map((l) => ({
        label: l.label,
        amountCents: parseCents(l.price) ?? -1,
      })),
      inclusions: splitLines(inclusions),
      exclusions: splitLines(exclusions),
      terms,
    };
    const checked = validateEstimate(value);
    const invalid = estimateFieldErrors(value);
    setFieldErrors(invalid);
    if (checked.error) {
      setError(checked.error);
      requestAnimationFrame(() => {
        const field = Object.keys(invalid)[0];
        if (field && document.getElementById(field))
          document.getElementById(field)?.focus();
        else feedback.current?.focus();
      });
      return null;
    }
    setError("");
    return value;
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const value = checkedValue();
    if (value) save(value, false);
  }
  function save(
    value: NonNullable<ReturnType<typeof checkedValue>>,
    publish: boolean,
  ) {
    submitting.current = true;
    startTransition(async () => {
      const result = await saveEstimate(
        requestId,
        identifier.current,
        revision.current,
        value,
        publish,
      ).catch(() => ({
        id: undefined,
        message:
          "Save could not be confirmed. Check Estimates before retrying.",
      }));
      if (result.id) {
        router.push("/admin/estimates/" + result.id);
        router.refresh();
      } else {
        submitting.current = false;
        setError(result.message);
        requestAnimationFrame(() => feedback.current?.focus());
      }
    });
  }
  const sectionHeading = "text-[17px] font-semibold";
  const busy = !hydrated || pending;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Only pricing sits in the <form>: the proposal panel has its own form,
          and scope/terms are read from state, so neither needs to be inside. */}
      <div className="flex min-w-0 flex-col gap-5">
        <form
          id="estimate-form"
          noValidate
          onSubmit={submit}
          aria-describedby="estimate-error"
        >
          <Panel>
            <h2 className={sectionHeading}>Pricing</h2>
            <p className="text-sm text-muted-foreground">
              Save a draft to review it later, or save and publish it to the
              customer now. Leaving this editor discards unsaved edits.
              Published estimates cannot be changed.
            </p>
            {prefilled && (
              <p className="rounded-xl bg-surface px-3 py-2 text-sm">
                Pricing lines start from the inventory suggestion
                {defaults
                  ? " and the lists and terms from the standard text"
                  : ""}
                . Review every line before publishing.
              </p>
            )}
            {suggestion && (
              <EstimateSuggestion
                input={suggestion}
                disabled={busy}
                onUse={(suggested) => {
                  setLines(
                    suggested.map((line) => ({
                      label: line.label,
                      price: (line.amountCents / 100).toFixed(2),
                    })),
                  );
                  setFieldErrors({});
                }}
              />
            )}
            <fieldset disabled={busy} className="space-y-3">
              <legend className="mb-2 text-sm font-medium">
                Pricing lines · USD
              </legend>
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={`grid items-end gap-3 rounded-xl sm:grid-cols-[minmax(0,1fr)_150px_auto] ${fieldErrors[`line-label-${i}`] || fieldErrors[`line-price-${i}`] ? "bg-destructive/5 p-3" : ""}`}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={"line-label-" + i}>
                      Line {i + 1} description
                    </Label>
                    <Input
                      aria-invalid={!!fieldErrors[`line-label-${i}`]}
                      aria-describedby={
                        fieldErrors[`line-label-${i}`]
                          ? `line-label-${i}-error`
                          : undefined
                      }
                      required
                      maxLength={150}
                      id={"line-label-" + i}
                      value={line.label}
                      onChange={(e) =>
                        setLines(
                          lines.map((l, n) =>
                            n === i ? { ...l, label: e.target.value } : l,
                          ),
                        )
                      }
                    />
                    {fieldErrors[`line-label-${i}`] && (
                      <p
                        id={`line-label-${i}-error`}
                        className="text-sm text-destructive"
                      >
                        {fieldErrors[`line-label-${i}`]}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={"line-price-" + i}>
                      Line {i + 1} amount ($)
                    </Label>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground"
                      >
                        $
                      </span>
                      <Input
                        className="pl-7 tabular-nums"
                        aria-invalid={!!fieldErrors[`line-price-${i}`]}
                        aria-describedby={
                          fieldErrors[`line-price-${i}`]
                            ? `line-price-${i}-error`
                            : undefined
                        }
                        required
                        inputMode="decimal"
                        id={"line-price-" + i}
                        onBlur={() => {
                          const cents = parseCents(line.price);
                          if (cents !== null)
                            setLines(
                              lines.map((l, n) =>
                                n === i
                                  ? { ...l, price: (cents / 100).toFixed(2) }
                                  : l,
                              ),
                            );
                        }}
                        value={line.price}
                        onChange={(e) =>
                          setLines(
                            lines.map((l, n) =>
                              n === i ? { ...l, price: e.target.value } : l,
                            ),
                          )
                        }
                      />
                    </div>
                    {fieldErrors[`line-price-${i}`] && (
                      <p
                        id={`line-price-${i}-error`}
                        className="text-sm text-destructive"
                      >
                        {fieldErrors[`line-price-${i}`]}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-11"
                    disabled={busy || lines.length === 1}
                    aria-label={"Remove line " + (i + 1)}
                    onClick={() => setLines(lines.filter((_, n) => n !== i))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={busy || lines.length >= 20}
                onClick={() => setLines([...lines, { label: "", price: "" }])}
              >
                <Plus aria-hidden="true" />
                Add pricing line
              </Button>
              <p className="text-xs text-muted-foreground">
                Use non-negative amounts with at most two decimal places.
                Invalid amounts must be corrected before saving.
              </p>
            </fieldset>
          </Panel>
        </form>
        {proposal ?? (
          <Panel className="gap-2">
            <h2 className={sectionHeading}>Proposed appointment</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              After saving, propose a date, arrival window, crew and truck on
              the review page. Accepting then books it if everything is still
              free.
            </p>
          </Panel>
        )}

        <Panel>
          <h2 className={sectionHeading}>Scope and terms</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                id: "inclusions",
                label: "Inclusions",
                value: inclusions,
                set: setInclusions,
              },
              {
                id: "exclusions",
                label: "Exclusions",
                value: exclusions,
                set: setExclusions,
              },
              { id: "terms", label: "Terms", value: terms, set: setTerms },
            ].map((f) => (
              <div
                key={f.id}
                className={
                  f.id === "terms" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"
                }
              >
                <Label htmlFor={f.id}>{f.label}</Label>
                <textarea
                  disabled={busy}
                  id={f.id}
                  required
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  rows={4}
                  maxLength={f.id === "terms" ? 2000 : 10000}
                  className={controlClass}
                  aria-invalid={!!fieldErrors[f.id]}
                  aria-describedby={
                    f.id +
                    "-hint" +
                    (fieldErrors[f.id] ? " " + f.id + "-error" : "")
                  }
                />
                {fieldErrors[f.id] && (
                  <p id={f.id + "-error"} className="text-sm text-destructive">
                    {fieldErrors[f.id]}
                  </p>
                )}
                <p
                  id={f.id + "-hint"}
                  className="text-xs text-muted-foreground"
                >
                  {f.id === "terms"
                    ? "Up to 2,000 characters. Describe the estimate scope and conditions."
                    : "One item per line, up to 20 items of 500 characters. Write None if applicable."}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="gap-4 lg:sticky lg:top-6">
        <div>
          <p className="text-sm text-muted-foreground">Estimated total</p>
          <p className="text-[38px] leading-tight font-semibold tracking-tight tabular-nums">
            {money(total)}
          </p>
          <p className="sr-only">Calculated total: {money(total)}</p>
        </div>
        {context && (
          <div className="rounded-[14px] bg-surface p-3.5 text-sm leading-6 [overflow-wrap:anywhere]">
            {context}
          </div>
        )}
        <p
          ref={feedback}
          tabIndex={-1}
          id="estimate-error"
          role="alert"
          className="rounded-sm text-sm text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {error}
        </p>
        <Button
          type="button"
          disabled={busy}
          className="w-full"
          onClick={() => {
            if (!submitting.current && checkedValue())
              publishDialog.current?.showModal();
          }}
        >
          Save and publish
        </Button>
        <Button
          type="submit"
          form="estimate-form"
          variant="outline"
          disabled={busy}
          className="w-full"
        >
          {pending ? "Saving…" : "Save draft & review"}
        </Button>
        <p className="text-[13px] leading-5 text-muted-foreground">
          Publishing notifies the customer. They can accept, which books a
          proposed time if it is still free, or ask for changes.
        </p>
      </Panel>
      <dialog
        ref={publishDialog}
        aria-labelledby="publish-title"
        aria-describedby="publish-description"
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-foreground/40"
      >
        <h2 id="publish-title" className="text-xl font-semibold">
          Publish this estimate?
        </h2>
        <p
          id="publish-description"
          className="mt-3 text-sm leading-6 text-muted-foreground"
        >
          The customer will see the {money(total)} estimate right away and can
          accept or decline it. Published estimates cannot be edited.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => publishDialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending}
            onClick={() => {
              const value = checkedValue();
              publishDialog.current?.close();
              if (value && !submitting.current) save(value, true);
            }}
          >
            Publish to customer
          </Button>
        </div>
      </dialog>
    </div>
  );
}
