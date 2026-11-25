export type PasswordErrors = Partial<
  Record<"email" | "currentPassword" | "password" | "confirmation", string>
>;
export function passwordErrors(
  value: { password: string; confirmation: string; currentPassword?: string },
  change = false,
): PasswordErrors {
  const errors: PasswordErrors = {};
  if (
    !value.password.trim() ||
    value.password.length < 12 ||
    value.password.length > 1024
  )
    errors.password = "Use a password between 12 and 1024 characters.";
  if (value.password !== value.confirmation)
    errors.confirmation = "The passwords do not match.";
  if (
    change &&
    (!value.currentPassword?.trim() || value.currentPassword.length > 1024)
  )
    errors.currentPassword = "Enter your current password.";
  return errors;
}
// Pass only claims verified by Auth, never user metadata or client-submitted JSON.
export function recentEmailProof(
  claims: unknown,
  userId: string,
  now = Date.now() / 1000,
): boolean {
  if (!claims || typeof claims !== "object") return false;
  const value = claims as Record<string, unknown>;
  return (
    value.sub === userId &&
    Array.isArray(value.amr) &&
    value.amr.some(
      (method) =>
        method &&
        typeof method === "object" &&
        (method.method === "recovery" ||
          method.method === "otp" ||
          method.method === "invite") &&
        typeof method.timestamp === "number" &&
        method.timestamp >= now - 900 &&
        method.timestamp <= now + 60,
    )
  );
}
