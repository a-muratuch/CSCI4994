import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

function AuthHeader({ staff = false }: { staff?: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          aria-label="Rebel Move home"
          className={cn("flex min-h-11 items-center rounded-lg", focusClass)}
        >
          <Brand />
        </Link>
        {staff && (
          <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            Staff login
          </span>
        )}
      </div>
      <Link
        href="/"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground",
          focusClass,
        )}
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
      </Link>
    </header>
  );
}

/** Centered card used by staff login, password and account-link pages. */
export function AuthCentered({
  children,
  staff = false,
}: {
  children: React.ReactNode;
  staff?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface px-4 py-5 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <AuthHeader staff={staff} />
      </div>
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 sm:p-8">
          {children}
        </div>
      </main>
      <footer className="text-center text-sm text-muted-foreground">
        Rebel Move · CSCI 4994
      </footer>
    </div>
  );
}

/** One decorative tracker line on the dark panel. */
function TrackerLine({
  tone,
  children,
}: {
  tone: "done" | "now" | "next";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 text-sm",
        tone === "next"
          ? "text-primary-foreground/60"
          : "text-primary-foreground",
      )}
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          tone === "done" && "bg-primary-foreground",
          tone === "now" && "bg-brand",
          tone === "next" && "bg-primary-foreground/30",
        )}
      />
      {children}
    </p>
  );
}

/**
 * Customer login/registration: the form on the left and a dark panel on the
 * right (below the form on small screens).
 */
export function AuthSplit({
  children,
  headline,
  points,
}: {
  children: React.ReactNode;
  headline: string;
  points: string[];
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <div className="flex min-w-0 flex-col px-4 py-5 sm:px-10 sm:py-7 lg:flex-[1_1_520px]">
        <AuthHeader />
        <main className="flex flex-1 items-center justify-center py-10 sm:py-12">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <p className="text-[13px] text-muted-foreground">
          Rebel Move · CSCI 4994 capstone. No real moving services are offered.
        </p>
      </div>
      <aside className="flex min-w-0 flex-col justify-center gap-8 bg-primary px-6 py-12 text-primary-foreground sm:px-10 lg:flex-[1_1_480px] lg:p-14">
        <h2 className="max-w-[440px] text-3xl leading-[1.08] font-semibold tracking-tight sm:text-[40px]">
          {headline}
        </h2>
        <ul className="flex max-w-[420px] flex-col gap-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex gap-3 text-[15px] leading-normal text-primary-foreground/80"
            >
              <span
                aria-hidden="true"
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand-on-primary"
              />
              {point}
            </li>
          ))}
        </ul>
        {/* Decorative example only; it describes no real move. */}
        <div
          aria-hidden="true"
          className="flex max-w-[380px] flex-col gap-3 rounded-[20px] bg-primary-foreground/10 p-5"
        >
          <div className="flex justify-between gap-3 text-[13px]">
            <span className="text-primary-foreground/60">Move #1058</span>
            <span className="font-semibold">Scheduled</span>
          </div>
          <p className="text-lg font-semibold">Oxford → Memphis</p>
          <TrackerLine tone="done">Estimate accepted · $1,240.00</TrackerLine>
          <TrackerLine tone="now">Sat, Dec 12 · arrival 8–10 AM</TrackerLine>
          <TrackerLine tone="next">Move day</TrackerLine>
        </div>
      </aside>
    </div>
  );
}
