import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function JobViewLinks({ calendar = false }: { calendar?: boolean }) {
  return (
    <nav
      aria-label="Schedule views"
      className="mb-5 inline-flex flex-wrap gap-1 rounded-full border bg-card p-1"
    >
      {[
        ["/admin/jobs", "Agenda", !calendar],
        ["/admin/jobs/calendar", "Week calendar", calendar],
      ].map(([href, label, active]) => (
        <Link
          key={String(href)}
          href={String(href)}
          aria-current={active ? "page" : undefined}
          className={cn(
            buttonVariants({ variant: active ? "default" : "ghost" }),
            "min-h-11 px-4",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
