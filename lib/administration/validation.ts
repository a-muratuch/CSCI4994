export function workerInvitation(
  value: unknown,
): { email: string; name: string } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.email !== "string" || typeof v.name !== "string") return null;
  const email = v.email.trim().toLowerCase(),
    name = v.name.trim();
  return email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    name.length > 0 &&
    name.length <= 100
    ? { email, name }
    : null;
}
