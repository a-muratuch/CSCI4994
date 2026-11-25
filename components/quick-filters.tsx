import Link from "next/link";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type QuickFilter = {
  label: string;
  href: string;
  count?: number;
  selected?: boolean;
};

/** Pill links for preset list filters. The selected one gets aria-current. */
export function QuickFilters({
  filters,
  label = "Quick filters",
  className,
}: {
  filters: QuickFilter[];
  label?: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <li key={filter.href}>
            <Link
              href={filter.href}
              aria-current={filter.selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                filter.selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input/40 bg-background text-foreground hover:bg-muted",
                focusClass,
              )}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className="tabular-nums">&nbsp;· {filter.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
