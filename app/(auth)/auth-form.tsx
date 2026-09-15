"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CircleAlert, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Field = "fullName" | "email" | "password" | "confirmation";
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const [values, setValues] = useState<Values>({ fullName: "", email: "", password: "", confirmation: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState({ password: false, confirmation: false });

  const fields: { id: Field; label: string; autoComplete: string; password?: boolean; hint?: string }[] = [
    ...(registering ? [{ id: "fullName" as const, label: "Full name", autoComplete: "name" }] : []),
    { id: "email", label: "Email address", autoComplete: "email" },
    { id: "password", label: "Password", autoComplete: registering ? "new-password" : "current-password", password: true, hint: registering ? "Use at least 8 characters for this demo." : undefined },
    ...(registering ? [{ id: "confirmation" as const, label: "Confirm password", autoComplete: "new-password", password: true }] : []),
  ];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (registering && !values.fullName.trim()) nextErrors.fullName = "Enter your full name.";
    if (!values.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a complete email address, such as alex@example.com.";
    if (!values.password.trim()) nextErrors.password = "Enter your password.";
    else if (registering && values.password.length < 8) nextErrors.password = "Use at least 8 characters for this demo.";
    if (registering && !values.confirmation) nextErrors.confirmation = "Confirm your password.";
    else if (registering && values.confirmation !== values.password) nextErrors.confirmation = "The passwords do not match.";

    setErrors(nextErrors);
    setChecked(Object.keys(nextErrors).length === 0);
    const firstError = fields.find(({ id }) => nextErrors[id]);
    if (firstError) event.currentTarget.querySelector<HTMLInputElement>(`#${firstError.id}`)?.focus();
  }

  return (
    <Card className="gap-6 shadow-sm sm:[--card-spacing:--spacing(6)]">
      <CardHeader className="gap-3">
        <p className="text-sm font-medium text-brand">{registering ? "Customer registration" : "Welcome back"}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{registering ? "Create your account" : "Log in to WeGo"}</h1>
        <p className="text-base leading-7 text-muted-foreground">
          {registering ? "Public registration is for customers only." : "Try the login form with fictional details."}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div id="prototype-notice" className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm leading-6">
          <Info aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <p><strong className="font-medium">Prototype only.</strong> Authentication is not connected. Nothing is sent or saved, and no one will be signed in or have an account created. Use a made-up password.</p>
        </div>
        <form noValidate onSubmit={submit} aria-describedby="prototype-notice" className="space-y-5">
          {fields.map(({ id, label, autoComplete, password, hint }) => {
            const passwordId = id === "confirmation" ? "confirmation" : "password";
            const shown = password && visible[passwordId];
            const description = [hint ? `${id}-hint` : "", errors[id] ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
            return (
              <div key={id} className="space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <div className="flex items-start gap-2">
                  <Input
                    id={id}
                    type={password ? (shown ? "text" : "password") : id === "email" ? "email" : "text"}
                    autoComplete={autoComplete}
                    autoCapitalize={id === "email" ? "none" : undefined}
                    spellCheck={password || id === "email" ? false : undefined}
                    required
                    value={values[id]}
                    aria-invalid={Boolean(errors[id])}
                    aria-describedby={description}
                    className="h-11 md:text-base"
                    onChange={(event) => {
                      setValues({ ...values, [id]: event.target.value });
                      setChecked(false);
                      // Recheck confirmation on submit after either password changes.
                      setErrors((current) => ({ ...current, [id]: undefined, ...(password ? { confirmation: undefined } : {}) }));
                    }}
                  />
                  {password && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`${shown ? "Hide" : "Show"} ${id === "confirmation" ? "confirmed password" : "password"}`}
                      aria-controls={id}
                      onClick={() => setVisible({ ...visible, [passwordId]: !visible[passwordId] })}
                    >
                      {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </Button>
                  )}
                </div>
                {hint && <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>}
                {errors[id] && <p id={`${id}-error`} className="flex items-start gap-2 text-sm leading-6 text-destructive"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />{errors[id]}</p>}
              </div>
            );
          })}
          <div aria-live="polite" aria-atomic="true">
            {Object.values(errors).some(Boolean) && <p className="text-sm text-destructive">Please correct the highlighted fields and try again.</p>}
            {checked && (
              <p className="rounded-lg bg-muted p-4 text-sm leading-6">
                Demo checks passed. {registering ? "No account was created." : "You are not signed in."} Authentication is not connected, and nothing was sent or saved.
              </p>
            )}
          </div>
          <Button type="submit" className="h-11 w-full text-base">{registering ? "Check registration details" : "Check login details"}</Button>
          <noscript><p className="text-sm text-muted-foreground">Enable JavaScript to try local form validation. Authentication is not connected.</p></noscript>
        </form>
        <p className="text-center text-sm leading-7 text-muted-foreground">
          {registering ? "Already have an account? " : "New to WeGo? "}
          <Link href={registering ? "/login" : "/register"} className="inline-flex min-h-11 items-center rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {registering ? "Log in" : "Register as a customer"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
