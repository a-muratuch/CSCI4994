"use client";
import { useHydrated } from "@/lib/use-hydrated";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { PasswordToggle } from "@/components/password-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  requestPasswordReset,
  savePassword,
} from "@/lib/auth/password-actions";
import type { PasswordErrors } from "@/lib/auth/password";

export function PasswordForm({
  mode,
}: {
  mode: "request" | "reset" | "change";
}) {
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const feedback = useRef<HTMLParagraphElement>(null);
  const focusTarget = useRef<string | null>(null);
  useEffect(() => {
    if (!pending && focusTarget.current) {
      const target = focusTarget.current;
      focusTarget.current = null;
      if (target === "feedback") feedback.current?.focus();
      else document.getElementById(target)?.focus();
    }
  }, [pending, message]);
  const title =
    mode === "request"
      ? "Reset your password"
      : mode === "reset"
        ? "Set a new password"
        : "Change password";
  const fields =
    mode === "request"
      ? [{ id: "email", label: "Email address", autocomplete: "email" }]
      : [
          ...(mode === "change"
            ? [
                {
                  id: "currentPassword",
                  label: "Current password",
                  autocomplete: "current-password",
                },
              ]
            : []),
          {
            id: "password",
            label: "New password",
            autocomplete: "new-password",
          },
          {
            id: "confirmation",
            label: "Confirm new password",
            autocomplete: "new-password",
          },
        ];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (mode !== "request")
      form
        .querySelectorAll<HTMLInputElement>(
          'input[type="password"], input[data-password]',
        )
        .forEach((input) => {
          input.value = "";
        });
    setErrors({});
    setMessage("");
    start(async () => {
      try {
        const result = await (mode === "request"
          ? requestPasswordReset(data)
          : savePassword(data));
        if (!result) return;
        setErrors(result.errors ?? {});
        setMessage(result.message);
        const invalid = fields.find(
          (field) => result.errors?.[field.id as keyof PasswordErrors],
        );
        focusTarget.current = invalid ? `${mode}-${invalid.id}` : "feedback";
      } catch {
        focusTarget.current = "feedback";
        setMessage("We could not confirm the change. Please try again.");
      }
    });
  }
  const Heading = mode === "change" ? "h2" : "h1";
  // Account settings shows its own card; the auth pages supply the card.
  const Wrapper = mode === "change" ? Card : "div";
  return (
    <Wrapper
      className={mode === "change" ? "p-5 sm:p-6" : "flex flex-col gap-4"}
    >
      <Heading
        className={
          mode === "change"
            ? "text-[17px] font-semibold"
            : "text-[28px] leading-tight font-semibold tracking-tight"
        }
      >
        {title}
      </Heading>
      <p className="text-muted-foreground">
        {mode === "request"
          ? "Enter your email and we'll send a link to set a new password. Open it in this browser."
          : mode === "reset"
            ? "Use at least 12 characters. Reset sessions expire after 15 minutes."
            : "Verify your current password, then choose a new one."}
      </p>
      <form onSubmit={submit} noValidate className="space-y-4">
        <input type="hidden" name="mode" value={mode} />
        <fieldset disabled={!hydrated || pending} className="space-y-4">
          {fields.map(({ id, label, autocomplete }) => {
            const password = id !== "email",
              error = errors[id as keyof PasswordErrors];
            return (
              <div key={id} className="space-y-2">
                <Label htmlFor={`${mode}-${id}`}>{label}</Label>
                <div className="relative">
                  <Input
                    id={`${mode}-${id}`}
                    name={id}
                    type={
                      password && !visible[id]
                        ? "password"
                        : password
                          ? "text"
                          : "email"
                    }
                    data-password={password || undefined}
                    autoComplete={autocomplete}
                    maxLength={password ? 1024 : 254}
                    required
                    aria-invalid={!!error}
                    aria-describedby={error ? `${mode}-${id}-error` : undefined}
                    className={password ? "pr-16" : undefined}
                  />
                  {password && (
                    <PasswordToggle
                      shown={Boolean(visible[id])}
                      field={label.toLowerCase()}
                      controls={`${mode}-${id}`}
                      onToggle={() =>
                        setVisible({ ...visible, [id]: !visible[id] })
                      }
                    />
                  )}
                </div>
                {error && (
                  <p
                    id={`${mode}-${id}-error`}
                    className="text-sm text-destructive"
                  >
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          <Button
            type="submit"
            className={mode === "change" ? undefined : "w-full"}
          >
            {pending
              ? "Saving…"
              : mode === "request"
                ? "Send reset link"
                : "Save password"}
          </Button>
        </fieldset>
        <p
          ref={feedback}
          tabIndex={-1}
          role="status"
          className="text-sm outline-none"
        >
          {message}
        </p>
      </form>
    </Wrapper>
  );
}
