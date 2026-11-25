import { cn } from "@/lib/utils";

/**
 * Shared page title. `children` is accepted as the description so the worker
 * pages' `<Heading title="…">Description</Heading>` calls keep working.
 */
export function PageHeading({
  title,
  description,
  eyebrow,
  badge,
  actions,
  children,
  titleAs: Title = "h1",
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** Only the specimens page needs a lower level; pages keep the default h1. */
  titleAs?: "h1" | "h2" | "h3" | "h4";
  className?: string;
}) {
  const text = description ?? children;
  return (
    <div
      className={cn(
        "mb-6 flex min-w-0 flex-wrap items-end justify-between gap-4 break-words",
        className,
      )}
    >
      <div className="min-w-0 flex-[1_1_20rem]">
        {eyebrow && (
          <p className="mb-1 text-sm text-muted-foreground">{eyebrow}</p>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Title className="min-w-0 text-[30px] leading-tight font-semibold tracking-tight">
            {title}
          </Title>
          {badge}
        </div>
        {text && (
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {text}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
