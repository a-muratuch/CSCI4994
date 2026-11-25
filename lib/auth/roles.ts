export type Role = "customer" | "worker" | "admin";
export type Account = { id: string; role: Role; name: string; email: string };
export type AuthMode = "login" | "register" | "worker-login" | "admin-login";

// Call with the user ID verified by Auth and the profile fetched by that ID.
export function accountFromProfile(
  userId: string,
  email: string,
  profile: unknown,
): Account | null {
  if (!profile || typeof profile !== "object") return null;
  const value = profile as Record<string, unknown>;
  if (
    value.id !== userId ||
    (value.active !== undefined && value.active !== true) ||
    !isRole(value.role) ||
    typeof value.full_name !== "string"
  )
    return null;
  return {
    id: userId,
    role: value.role,
    name: value.full_name.trim() || email || "Account",
    email,
  };
}

export function isRole(value: unknown): value is Role {
  return value === "customer" || value === "worker" || value === "admin";
}

export function roleHome(role: Role) {
  return `/${role}`;
}
export function roleLogin(role: Role) {
  return role === "customer" ? "/login" : `/${role}/login`;
}
export function roleLabel(role: Role) {
  return role === "admin"
    ? "Administrator"
    : role === "worker"
      ? "Worker"
      : "Customer";
}

export function protectedRole(pathname: string): Role | null {
  for (const role of ["customer", "worker", "admin"] as const) {
    if (pathname === roleLogin(role)) return null;
    if (
      pathname === roleHome(role) ||
      pathname.startsWith(`${roleHome(role)}/`)
    )
      return role;
  }
  return null;
}
