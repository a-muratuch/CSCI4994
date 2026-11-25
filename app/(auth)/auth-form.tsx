"use client";
import { useHydrated } from "@/lib/use-hydrated";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordToggle } from "@/components/password-toggle";
import { linkClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { authenticate } from "@/lib/auth/actions";
import {
  validateAuth,
  type AuthValues as Values,
  type AuthErrors as Errors,
} from "@/lib/auth/validation";
import type { AuthMode } from "@/lib/auth/roles";

type Field = "fullName" | "email" | "password" | "confirmation";
export function AuthForm({ mode }: { mode: AuthMode }) {
  const registering = mode === "register";
  const staff = mode === "worker-login" || mode === "admin-login";
  const role =
    mode === "worker-login"
      ? "worker"
      : mode === "admin-login"
        ? "admin"
        : "customer";
  const hydrated = useHydrated();
  const [values, setValues] = useState<Values>({
    fullName: "",
    email: "",
    password: "",
    confirmation: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [opening, startTransition] = useTransition();
  const [visible, setVisible] = useState({
    password: false,
    confirmation: false,
  });
  const [feedback, setFeedback] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  const fields: {
    id: Field;
    label: string;
    autoComplete: string;
    password?: boolean;
    hint?: string;
  }[] = [
    ...(registering
      ? [{ id: "fullName" as const, label: "Full name", autoComplete: "name" }]
      : []),
    { id: "email", label: "Email address", autoComplete: "username" },
    {
      id: "password",
      label: "Password",
      autoComplete: registering ? "new-password" : "current-password",
      password: true,
      hint: registering ? "Use at least 12 characters." : undefined,
    },
    ...(registering
      ? [
          {
            id: "confirmation" as const,
            label: "Confirm password",
            autoComplete: "new-password",
            password: true,
          },
        ]
      : []),
  ];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opening) return;
    const nextErrors = validateAuth(mode, values);
    setErrors(nextErrors);
    setFeedback("");
    setConfirmationSent(false);
    const firstError = fields.find(({ id }) => nextErrors[id]);
    if (firstError) {
      event.currentTarget
        .querySelector<HTMLInputElement>(`#${firstError.id}`)
        ?.focus();
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    // Credentials go only to the server action; never return/store them or use URLs.
    setValues((current) => ({ ...current, password: "", confirmation: "" }));
    setVisible({ password: false, confirmation: false });
    startTransition(async () => {
      try {
        const result = await authenticate(data);
        if (
          result.ok &&
          result.status === "success" &&
          result.destination === `/${role}`
        ) {
          // Start the verified session with a fresh page, never a previous-account route cache.
          window.location.replace(result.destination);
          return;
        }
        setErrors(result.errors ?? {});
        setConfirmationSent(result.status === "confirmation");
        setFeedback(
          result.message ??
            "Please correct the highlighted fields and try again.",
        );
        const invalid = fields.find(({ id }) => result.errors?.[id]);
        if (invalid)
          requestAnimationFrame(() =>
            form.querySelector<HTMLInputElement>(`#${invalid.id}`)?.focus(),
          );
      } catch {
        setFeedback("We could not reach the server. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {staff && (
          <p className="mb-2 text-sm font-medium text-brand">Staff only</p>
        )}
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">
          {registering
            ? "Create your account"
            : role === "worker"
              ? "Worker login"
              : role === "admin"
                ? "Administrator login"
                : "Welcome back"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          {registering
            ? "Free for customers. No payment details needed."
            : role === "worker"
              ? "Sign in with an account assigned the worker role by an administrator."
              : role === "admin"
                ? "Sign in with an administrator account to manage requests, estimates and jobs."
                : "Log in to follow your move, review estimates and message the team."}
        </p>
        {(registering || staff) && (
          <p
            id="auth-notice"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            {registering
              ? "Public registration is for customers only. Use an email you can access; you may need to confirm it before signing in."
              : "Your assigned account role controls which workspace you can open."}
          </p>
        )}
      </div>
      <form
        noValidate
        onSubmit={submit}
        aria-describedby={registering || staff ? "auth-notice" : undefined}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="mode" value={mode} />
        {fields.map(({ id, label, autoComplete, password, hint }) => {
          const passwordId =
            id === "confirmation" ? "confirmation" : "password";
          const shown = password && visible[passwordId];
          const description =
            [hint ? `${id}-hint` : "", errors[id] ? `${id}-error` : ""]
              .filter(Boolean)
              .join(" ") || undefined;
          return (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>{label}</Label>
              <div className="relative">
                <Input
                  id={id}
                  name={id}
                  type={
                    password
                      ? shown
                        ? "text"
                        : "password"
                      : id === "email"
                        ? "email"
                        : "text"
                  }
                  autoComplete={autoComplete}
                  autoCapitalize={id === "email" ? "none" : undefined}
                  spellCheck={password || id === "email" ? false : undefined}
                  required
                  disabled={!hydrated || opening}
                  maxLength={
                    id === "fullName" ? 100 : id === "email" ? 254 : 1024
                  }
                  value={values[id]}
                  aria-invalid={Boolean(errors[id])}
                  aria-describedby={description}
                  className={password ? "pr-16 md:text-base" : "md:text-base"}
                  onChange={(event) => {
                    setValues({ ...values, [id]: event.target.value });
                    // Recheck confirmation on submit after either password changes.
                    setErrors((current) => ({
                      ...current,
                      [id]: undefined,
                      ...(password ? { confirmation: undefined } : {}),
                    }));
                  }}
                />
                {password && (
                  <PasswordToggle
                    shown={Boolean(shown)}
                    field={
                      id === "confirmation" ? "confirmed password" : "password"
                    }
                    controls={id}
                    disabled={!hydrated || opening}
                    onToggle={() =>
                      setVisible({
                        ...visible,
                        [passwordId]: !visible[passwordId],
                      })
                    }
                  />
                )}
              </div>
              {hint && (
                <p
                  id={`${id}-hint`}
                  className="text-[13px] text-muted-foreground"
                >
                  {hint}
                </p>
              )}
              {errors[id] && (
                <p
                  id={`${id}-error`}
                  className="flex items-start gap-2 text-sm leading-6 text-destructive"
                >
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0"
                  />
                  {errors[id]}
                </p>
              )}
            </div>
          );
        })}
        {!registering && (
          <Link
            href="/forgot-password"
            className={cn(linkClass, "-mt-2 self-end font-medium")}
          >
            Forgot password?
          </Link>
        )}
        <div aria-live="polite" aria-atomic="true">
          {Object.values(errors).some(Boolean) && (
            <p className="text-sm text-destructive">
              Please correct the highlighted fields and try again.
            </p>
          )}
          {feedback && (
            <p
              className={`text-sm leading-6 ${confirmationSent ? "text-success" : "text-destructive"}`}
            >
              {feedback}
            </p>
          )}
          {opening && (
            <p className="text-sm text-muted-foreground">
              {registering ? "Creating your account…" : "Signing in…"}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={!hydrated || opening}
          className="w-full text-base"
        >
          {opening
            ? registering
              ? "Creating account…"
              : "Signing in…"
            : registering
              ? "Create account"
              : "Log in"}
        </Button>
        <noscript>
          <p className="text-sm text-muted-foreground">
            Enable JavaScript to use this sign-in form.
          </p>
        </noscript>
      </form>
      <p className="text-sm text-muted-foreground">
        {staff
          ? "Customer? "
          : registering
            ? "Already have an account? "
            : "New to Rebel Move? "}
        <Link
          href={registering || staff ? "/login" : "/register"}
          className={cn(linkClass, "font-semibold text-foreground")}
        >
          {staff ? "Log in here" : registering ? "Log in" : "Create an account"}
        </Link>
      </p>
      {!registering && !staff && (
        <nav
          aria-label="Staff login"
          className="flex flex-wrap items-center gap-x-2 border-t pt-4 text-[13px] text-muted-foreground"
        >
          <span>Staff:</span>
          <Link href="/worker/login" className={cn(linkClass, "text-[13px]")}>
            Worker login
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/admin/login" className={cn(linkClass, "text-[13px]")}>
            Administrator login
          </Link>
        </nav>
      )}
    </div>
  );
}
