import Link from "next/link";

export function DashboardLink() {
  return (
    <Link
      href="/login"
      className="inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
    >
      Log in
    </Link>
  );
}
