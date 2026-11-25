import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Muted dot for items that have not happened yet. */
  pending?: boolean;
};

/** Vertical dot list for record history. */
export function Timeline({
  items,
  label,
  className,
}: {
  items: TimelineItem[];
  label?: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("flex flex-col gap-3.5", className)}>
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[12px_1fr] gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-2.5 rounded-full",
              item.pending ? "bg-border" : "bg-primary",
            )}
          />
          <span className="min-w-0 text-sm leading-snug break-words">
            <span className="block font-medium">
              {item.title}
              {item.pending && <span className="sr-only"> (upcoming)</span>}
            </span>
            {item.meta && (
              <span className="text-[13px] text-muted-foreground">
                {item.meta}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
