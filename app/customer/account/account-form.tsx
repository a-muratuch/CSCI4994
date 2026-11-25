"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContact } from "@/lib/profiles/actions";
import { validateContact } from "@/lib/profiles/validation";
import { FieldError, Panel } from "../customer-ui";
import type { Profile } from "@/lib/domain";

export default function AccountForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const [draft, setDraft] = useState<Profile>(profile);
  const [errors, setErrors] = useState<Partial<Profile>>({});
  const [saved, setSaved] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const feedback = useRef<HTMLParagraphElement>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    const checked = validateContact(draft);
    const invalid = checked.errors;
    setErrors(invalid);
    setResultMessage("");
    if (Object.keys(invalid).length) {
      setSaved(false);
      document.getElementById(Object.keys(invalid)[0])?.focus();
      return;
    }
    if (!checked.input) return;
    saving.current = true;
    startTransition(async () => {
      const result = await saveContact(checked.input).catch(() => ({
        ok: false,
        message:
          "The save could not be confirmed. Reload account settings before retrying.",
      }));
      saving.current = false;
      setResultMessage(result.message);
      setSaved(result.ok);
      if ("errors" in result && result.errors) setErrors(result.errors);
      if ("profile" in result && result.profile) {
        const savedProfile = result.profile;
        setDraft((current) => ({ ...current, ...savedProfile }));
      }
      requestAnimationFrame(() => feedback.current?.focus());
    });
  }

  return (
    <Panel>
      <div>
        <h2 className="text-[17px] font-semibold">Contact information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and phone number. Your crew sees them on move day.
        </p>
      </div>
      <form
        noValidate
        onSubmit={submit}
        className="grid gap-x-4 gap-y-5 sm:grid-cols-2"
      >
        {(["name", "phone", "email"] as const).map((key) => (
          <div
            key={key}
            className={
              key === "email" ? "space-y-2 sm:col-span-2" : "space-y-2"
            }
          >
            <Label htmlFor={key}>
              {key === "name"
                ? "Full name"
                : key === "email"
                  ? "Email address"
                  : "Phone number"}
            </Label>
            <Input
              disabled={pending}
              readOnly={key === "email"}
              maxLength={key === "name" ? 100 : key === "phone" ? 30 : 254}
              id={key}
              autoComplete={
                key === "name" ? "name" : key === "phone" ? "tel" : "email"
              }
              type={
                key === "email" ? "email" : key === "phone" ? "tel" : "text"
              }
              required
              value={draft[key]}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={
                key === "email"
                  ? "email-note"
                  : errors[key]
                    ? `${key}-error`
                    : undefined
              }
              onChange={(event) => {
                setDraft({ ...draft, [key]: event.target.value });
                setSaved(false);
                setResultMessage("");
              }}
              className="text-base"
            />
            {key === "email" && (
              <p id="email-note" className="text-sm text-muted-foreground">
                Your verified sign-in email is read-only. Email changes are not
                available.
              </p>
            )}
            <FieldError id={key} message={errors[key]} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save profile"}
          </Button>
          <p
            ref={feedback}
            role="status"
            tabIndex={-1}
            className={`rounded-sm text-sm ${saved ? "text-success" : "text-destructive"} outline-none focus-visible:ring-3 focus-visible:ring-ring`}
          >
            {resultMessage}
          </p>
        </div>
      </form>
    </Panel>
  );
}
