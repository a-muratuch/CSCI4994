import { cn } from "@/lib/utils";

/**
 * Card around a table that scrolls sideways inside its own region instead of
 * widening the page. Put a `<caption>` (it can be sr-only) in the table.
 */
export function ResponsiveTable({
  label,
  minWidth = "760px",
  children,
  className,
}: {
  label: string;
  minWidth?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border bg-card", className)}
    >
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <table
          style={{ minWidth }}
          className="w-full border-collapse text-sm [&_tbody_tr]:border-t [&_td]:px-5 [&_td]:py-3.5 [&_td]:align-middle"
        >
          {children}
        </table>
      </div>
    </div>
  );
}

/** Header row: uppercase, muted, on the surface tone. */
export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-surface">
      <tr>
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className="px-5 py-3 text-left text-xs font-semibold tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}
