import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Light pill for the primary action on a dark HeroPanel. */
export const heroActionClass = cn(
  buttonVariants(),
  "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
);
/** Outline pill for a secondary action on a dark HeroPanel. */
export const heroSecondaryClass = cn(
  buttonVariants({ variant: "outline" }),
  "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
);

/** Dark call-out panel for the single most important next step on a page. */
export function HeroPanel({
  eyebrow,
  title,
  children,
  actions,
  titleAs: Title = "h2",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  titleAs?: "h2" | "h3" | "h4";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-6 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-7",
        className,
      )}
    >
      <div className="flex min-w-0 flex-[1_1_22rem] flex-col gap-2 break-words">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.08em] text-brand-on-primary uppercase">
            {eyebrow}
          </p>
        )}
        <Title className="text-2xl font-semibold tracking-tight sm:text-[26px]">
          {title}
        </Title>
        {children && (
          <div className="text-[15px] leading-relaxed text-primary-foreground/80">
            {children}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </section>
  );
}
