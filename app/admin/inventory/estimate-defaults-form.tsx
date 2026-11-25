"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useHydrated } from "@/lib/use-hydrated";
import { saveEstimateDefaults } from "@/lib/estimates/actions";
import type { EstimateDefaults } from "@/lib/estimates/validation";
import { controlClass } from "../admin-ui";

const fields = [
  {
    key: "inclusions",
    label: "Standard inclusions",
    hint: "One item per line, 1–20 items of up to 500 characters.",
  },
  {
    key: "exclusions",
    label: "Standard exclusions",
    hint: "One item per line, 1–20 items of up to 500 characters.",
  },
  {
    key: "terms",
    label: "Standard terms",
    hint: "Up to 2,000 characters.",
  },
] as const;

/** Text every new estimate draft starts with. Saved estimates never change. */
export function EstimateDefaultsForm({
  defaults,
}: {
  defaults: EstimateDefaults;
}) {
  const id = useId();
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    start(async () => {
      const result = await saveEstimateDefaults(data).catch(() => ({
        ok: false,
        errors: undefined,
        message: "The change could not be confirmed. Reload and try again.",
      }));
      setErrors(result.errors ?? {});
      setMessage(result.message ?? "");
      const invalid = fields.find((f) => result.errors?.[f.key]);
      requestAnimationFrame(() =>
        (invalid
          ? document.getElementById(id + invalid.key)
          : feedback.current
        )?.focus(),
      );
    });
  }
  return (
    <form
      aria-label="Standard estimate text"
      noValidate
      onSubmit={submit}
      className="space-y-4"
    >
      <fieldset disabled={pending || !hydrated} className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={id + field.key}>{field.label}</Label>
            <textarea
              id={id + field.key}
              name={field.key}
              rows={field.key === "terms" ? 4 : 3}
              maxLength={field.key === "terms" ? 2000 : 10000}
              defaultValue={
                field.key === "terms"
                  ? defaults.terms
                  : defaults[field.key].join("\n")
              }
              required
              aria-invalid={Boolean(errors[field.key])}
              aria-describedby={
                id +
                field.key +
                "-hint" +
                (errors[field.key] ? " " + id + field.key + "-error" : "")
              }
              className={controlClass}
            />
            {errors[field.key] && (
              <p
                id={id + field.key + "-error"}
                className="text-sm text-destructive"
              >
                {errors[field.key]}
              </p>
            )}
            <p
              id={id + field.key + "-hint"}
              className="text-xs text-muted-foreground"
            >
              {field.hint}
            </p>
          </div>
        ))}
      </fieldset>
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className="text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {message}
      </p>
      <Button
        type="submit"
        disabled={pending || !hydrated}
        className="min-h-11"
      >
        {pending ? "Saving…" : "Save standard text"}
      </Button>
    </form>
  );
}
