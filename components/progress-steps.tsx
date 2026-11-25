import type { ProgressStep } from "@/lib/domain/status";
import { cn } from "@/lib/utils";

const stateText = {
  complete: "completed",
  current: "current step",
  upcoming: "not started",
} as const;

/**
 * Segmented progress bar. Build steps with `progressFor` (customer moves) or
 * `workerProgressFor` (crew jobs) from lib/domain/status.ts.
 */
export function ProgressSteps({
  steps,
  label = "Progress",
  className,
}: {
  steps: ProgressStep[];
  label?: string;
  className?: string;
}) {
  return (
    // Sized by its container, not the viewport: narrow cards get a vertical
    // list; from 24rem one equal column per step, so the bar never breaks.
    <div className={cn("@container", className)}>
      <ol
        aria-label={label}
        style={{ "--steps": steps.length } as React.CSSProperties}
        className="grid gap-2 @sm:grid-cols-[repeat(var(--steps),minmax(0,1fr))]"
      >
        {steps.map((step) => (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex min-w-0 items-center gap-3 @sm:flex-col @sm:items-stretch @sm:gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-8 shrink-0 rounded-full @sm:w-auto",
                step.state === "complete" && "bg-primary",
                step.state === "current" && "bg-brand",
                step.state === "upcoming" && "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[13px] break-words",
                step.state === "upcoming"
                  ? "text-muted-foreground"
                  : "text-foreground",
                step.state === "current" && "font-semibold",
              )}
            >
              {step.label}
              {step.state === "current" && (
                <span aria-hidden="true"> · now</span>
              )}
              <span className="sr-only"> ({stateText[step.state]})</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
