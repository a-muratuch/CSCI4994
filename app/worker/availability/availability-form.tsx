"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  availabilityErrors,
  days,
  type Availability,
  type Day,
} from "@/lib/domain";
import type { WorkerWorkspace } from "@/lib/workers/data";
import { Heading, panelClass } from "../worker-ui";

import { saveAvailability } from "@/lib/workers/actions";

export default function AvailabilityPage({ availability }: WorkerWorkspace) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(availability);
  const [errors, setErrors] = useState<Partial<Record<Day, string>>>({});
  const [saved, setSaved] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);

  function change(day: Day, patch: Partial<Availability>) {
    setDraft((current) =>
      current.map((row) => (row.day === day ? { ...row, ...patch } : row)),
    );
    setErrors((current) => ({ ...current, [day]: undefined }));
    setSaved(false);
    setResultMessage("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = availabilityErrors(draft);
    setErrors(nextErrors);
    const first = days.find((day) => nextErrors[day]);
    if (first) {
      setSaved(false);
      document.getElementById(`${first}-start`)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await saveAvailability(draft).catch(() => ({
        ok: false,
        message:
          "The save could not be confirmed. Reload availability before retrying.",
      }));
      setResultMessage(result.message);
      setSaved(result.ok);
      requestAnimationFrame(() => feedback.current?.focus());
    });
  }

  return (
    <>
      <Heading title="Your availability">
        Tell us when you can work each week, in Central Time.
      </Heading>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className={panelClass}>
          <form
            noValidate
            onSubmit={submit}
            aria-describedby="availability-note"
            className="space-y-4"
          >
            <fieldset disabled={pending} className="min-w-0">
              <legend className="text-[17px] font-semibold">
                Weekly availability · CT
              </legend>
              <p
                id="availability-note"
                className="mt-1 text-sm leading-6 text-muted-foreground"
              >
                Choose the days and daytime hours you can work. Draft edits are
                discarded if you leave without saving.
              </p>
              <div className="mt-3 divide-y">
                {draft.map((row) => (
                  <div key={row.day} className="py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="w-24 text-[15px] font-medium">
                        {row.day}
                      </span>
                      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={row.available}
                          aria-label={`${row.day} available`}
                          onChange={(event) =>
                            change(row.day, { available: event.target.checked })
                          }
                          className="size-4 accent-primary"
                        />
                        Available
                      </label>
                      {row.available ? (
                        <span className="flex min-w-0 flex-[1_1_16rem] items-center gap-2">
                          {(["start", "end"] as const).map((field, index) => (
                            <span
                              key={field}
                              className="flex min-w-0 flex-1 items-center gap-2"
                            >
                              {index === 1 && (
                                <span
                                  aria-hidden="true"
                                  className="text-sm text-muted-foreground"
                                >
                                  to
                                </span>
                              )}
                              <Input
                                id={`${row.day}-${field}`}
                                aria-label={`${row.day} ${field} time`}
                                type="time"
                                value={row[field]}
                                required
                                onChange={(event) =>
                                  change(row.day, {
                                    [field]: event.target.value,
                                  })
                                }
                                aria-invalid={Boolean(errors[row.day])}
                                aria-describedby={
                                  errors[row.day]
                                    ? `${row.day}-error`
                                    : undefined
                                }
                                className="min-w-0 md:text-base"
                              />
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unavailable
                        </span>
                      )}
                    </div>
                    {errors[row.day] && (
                      <p
                        id={`${row.day}-error`}
                        className="mt-1 text-sm text-destructive"
                      >
                        {errors[row.day]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            <p role="alert" className="text-sm text-destructive empty:hidden">
              {Object.values(errors).some(Boolean)
                ? "Please correct the highlighted availability times."
                : ""}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <span className="text-[13px] text-muted-foreground">
                Saved availability helps admins suggest crews.
              </span>
              <Button disabled={pending} type="submit">
                {pending ? "Saving…" : "Save availability"}
              </Button>
            </div>
            <p
              ref={feedback}
              role="status"
              tabIndex={-1}
              className={`rounded-sm text-sm leading-6 ${saved ? "text-success" : "text-destructive"} outline-none focus-visible:ring-3 focus-visible:ring-ring`}
            >
              {resultMessage}
            </p>
          </form>
        </Card>
        <Card className={panelClass}>
          <h2 className="text-[17px] font-semibold">Good to know</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Availability is a preference, not a booking. Saving does not cancel,
            accept, or reschedule jobs you are already assigned. An admin still
            controls dates, crews and trucks.
          </p>
        </Card>
      </div>
    </>
  );
}
