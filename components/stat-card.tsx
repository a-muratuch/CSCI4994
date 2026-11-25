import Link from "next/link";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** A labelled number for overview pages. Becomes a link when `href` is set. */
export function StatCard({
  label,
  value,
  note,
  href,
  dark = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  href?: string;
  dark?: boolean;
  className?: string;
}) {
  const classes = cn(
    "flex min-w-0 flex-col gap-2.5 rounded-2xl border p-5 break-words",
    dark
      ? "border-primary bg-primary text-primary-foreground"
      : "bg-card text-card-foreground",
    href &&
      cn(
        "transition-colors",
        dark ? "hover:bg-primary/90" : "hover:bg-muted",
        focusClass,
      ),
    className,
  );
  const content = (
    <>
      <span
        className={cn(
          "text-sm",
          dark ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-4xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {note && (
          <span
            className={cn(
              "text-[13px] font-medium",
              dark ? "text-brand-on-primary" : "text-brand",
            )}
          >
            {note}
          </span>
        )}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
