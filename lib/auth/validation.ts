import type { ActionResult } from "../action-result";
import type { AuthMode } from "./roles";

export type AuthField = "fullName" | "email" | "password" | "confirmation";
export type AuthValues = Record<AuthField, string>;
export type AuthErrors = Partial<Record<AuthField, string>>;
export type AuthResult = ActionResult<{
  status: "error" | "confirmation" | "success";
  errors?: AuthErrors;
  message?: string;
  destination?: string;
}>;

export function validateAuth(mode: AuthMode, values: AuthValues): AuthErrors {
  const errors: AuthErrors = {};
  const registering = mode === "register";
  if (
    registering &&
    (!values.fullName.trim() || values.fullName.trim().length > 100)
  )
    errors.fullName = "Enter a name between 1 and 100 characters.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (
    values.email.trim().length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  )
    errors.email = "Enter a complete email address, such as alex@example.com.";
  if (!values.password.trim()) errors.password = "Enter your password.";
  else if (registering && values.password.length < 12)
    errors.password = "Use at least 12 characters.";
  else if (values.password.length > 1024)
    errors.password = "The password is too long.";
  if (registering && !values.confirmation)
    errors.confirmation = "Confirm your password.";
  else if (registering && values.confirmation !== values.password)
    errors.confirmation = "The passwords do not match.";
  return errors;
}

export function readAuthInput(
  form: FormData,
): { mode: AuthMode; values: AuthValues } | null {
  const mode = form.get("mode");
  if (
    !["login", "register", "worker-login", "admin-login"].includes(String(mode))
  )
    return null;
  const read = (field: AuthField) =>
    typeof form.get(field) === "string" ? String(form.get(field)) : "";
  return {
    mode: mode as AuthMode,
    values: {
      fullName: read("fullName"),
      email: read("email"),
      password: read("password"),
      confirmation: read("confirmation"),
    },
  };
}
