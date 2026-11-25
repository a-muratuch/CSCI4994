import { cn } from "@/lib/utils";

/**
 * Card that lays out list search/sort fields in a wrapping row. Pass labelled
 * fields as children; each `<label>` should carry its own flex basis.
 */
export function FilterBar({
  children,
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form
      {...props}
      className={cn(
        "mb-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </form>
  );
}

/** One labelled field inside a FilterBar. */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-w-0 flex-[1_1_10rem] flex-col gap-1.5 text-[13px] font-medium",
        className,
      )}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
