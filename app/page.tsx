import type { Metadata } from "next";
import { DashboardLink } from "@/components/dashboard-link";
import { Brand } from "@/components/brand";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Camera,
  Check,
  MessageSquare,
  Route,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { focusClass } from "@/lib/ui";
import { cn } from "@/lib/utils";

const navLinkClass = cn(
  "inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  focusClass,
);

const estimateLines = [
  ["Crew of 3 · 5 hrs", "$825.00"],
  ["Truck & mileage", "$315.00"],
  ["Packing materials", "$100.00"],
];

const features = [
  {
    title: "Chat with your crew",
    description: "Message support or your assigned team. Replies show up live.",
    icon: MessageSquare,
  },
  {
    title: "Live move-day progress",
    description:
      "Follow each stage from scheduled to completed, with notifications as it changes.",
    icon: Route,
  },
  {
    title: "Private move photos",
    description:
      "Share photos of tricky items, and get a delivery photo when the job is done.",
    icon: Camera,
  },
];

const steps = [
  {
    title: "Share your move",
    description: "Pickup, destination, preferred date and what you're moving.",
  },
  {
    title: "Review your estimate",
    description:
      "The team sends an itemized price with a proposed arrival window.",
  },
  {
    title: "Accept to book",
    description:
      "Accepting reserves your crew and truck, or we confirm a new time.",
  },
  {
    title: "Follow the move",
    description: "Track progress and chat with your crew until delivery.",
  },
];

const eyebrowClass =
  "text-[13px] font-semibold tracking-[0.08em] text-brand uppercase";
const sectionHeadingClass =
  "mt-3 text-[32px] leading-[1.1] font-semibold tracking-tight sm:text-[44px]";

/** Example tracker in the hero. Text-only status, decorative sample values. */
function ExampleTracker() {
  const stages = [
    { label: "Request sent", state: "done" },
    { label: "Estimate accepted · $1,240.00", state: "done" },
    { label: "Sat, Dec 12 · arrival 8–10 AM", state: "now" },
    { label: "Move day", state: "next" },
  ] as const;
  return (
    <figure
      aria-label="Example move tracker"
      className="flex flex-col gap-3.5 rounded-[28px] bg-muted p-5 sm:p-7"
    >
      <div className="rounded-[18px] bg-card p-5 shadow-xs sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              MOVE #1042
            </p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight">
              Oxford → Memphis
            </p>
          </div>
          <span className="rounded-full bg-success-surface px-2.5 py-0.5 text-xs font-semibold text-success">
            Scheduled
          </span>
        </div>
        <ol className="mt-5 flex flex-col gap-3">
          {stages.map(({ label, state }) => (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 text-sm",
                state === "now" && "font-semibold",
                state === "next" && "text-muted-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-[22px] shrink-0 place-items-center rounded-full",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "now" && "border-2 border-brand",
                  state === "next" && "border-2 border-border",
                )}
              >
                {state === "done" && <Check className="size-3" />}
                {state === "now" && (
                  <span className="size-2 rounded-full bg-brand" />
                )}
              </span>
              {label}
              <span className="sr-only">
                {state === "done"
                  ? "(done)"
                  : state === "now"
                    ? "(next up)"
                    : "(upcoming)"}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-3.5">
        <div className="min-w-0 flex-[1_1_180px] rounded-[18px] bg-card p-4.5 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Your crew</p>
          <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm leading-normal">
            Truck is loaded — heading to Memphis now.
          </p>
        </div>
        <div className="flex min-w-0 flex-[1_1_140px] flex-col justify-between gap-2 rounded-[18px] bg-primary p-4.5 text-primary-foreground">
          <p className="text-xs font-medium text-brand-on-primary">
            Arrival window
          </p>
          <p className="text-[26px] font-semibold tracking-tight tabular-nums">
            8–10 AM
          </p>
        </div>
      </div>
    </figure>
  );
}

export default async function Home() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0 focus:ring-3 focus:ring-ring focus:outline-none"
      >
        Skip to content
      </a>

      <header className="top-0 z-10 border-b bg-background/90 backdrop-blur sm:sticky">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <a
            href="#top"
            className={cn("flex items-center rounded-lg", focusClass)}
            aria-label="Rebel Move home"
          >
            <Brand />
          </a>
          <nav
            aria-label="Main navigation"
            className="order-3 flex w-full flex-wrap gap-1 sm:order-2 sm:w-auto"
          >
            <a href="#features" className={navLinkClass}>
              Features
            </a>
            <a href="#how-it-works" className={navLinkClass}>
              How it works
            </a>
            <DashboardLink />
          </nav>
          <Link
            href="/register"
            className={cn(buttonVariants(), "order-2 sm:order-3")}
          >
            Plan your move
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section
          id="top"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:gap-16"
        >
          <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
            <span className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-[13px] font-medium text-muted-foreground">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-brand"
              />
              Request, estimate, book and track — in one place
            </span>
            <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] sm:text-6xl lg:text-[72px]">
              A calmer way to plan your{" "}
              <span className="text-brand">next move.</span>
            </h1>
            <p className="max-w-[520px] text-lg leading-relaxed text-muted-foreground sm:text-[19px]">
              Send your move details once. Get an itemized estimate, accept it
              to book your arrival window, then follow your crew on move day.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "lg" }), "min-h-13 px-6")}
              >
                Plan your move
                <ArrowRight aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-h-13 px-6",
                )}
              >
                See how it works
              </a>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Free customer account · No payment details needed
            </p>
          </div>
          <div className="min-w-0 flex-[1_1_420px]">
            <ExampleTracker />
          </div>
        </section>

        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-20 border-t"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[560px]">
                <p className={eyebrowClass}>Features</p>
                <h2 id="features-heading" className={sectionHeadingClass}>
                  Everything about your move, in one account
                </h2>
              </div>
              <p className="max-w-[380px] leading-relaxed text-muted-foreground">
                No phone tag or lost emails. Every detail and update stays in
                one record you and the moving team share.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-wrap items-center gap-8 rounded-3xl bg-muted p-6 sm:col-span-2 sm:p-8 lg:col-span-3">
                <div className="min-w-0 flex-[1_1_240px]">
                  <h3 className="text-[22px] font-semibold tracking-tight">
                    Itemized estimates you can read
                  </h3>
                  <p className="mt-2.5 leading-relaxed text-muted-foreground">
                    See every line, what&apos;s included and what isn&apos;t.
                    Accept it, or ask for changes with one tap.
                  </p>
                </div>
                <div
                  aria-hidden="true"
                  className="min-w-0 flex-[1_1_260px] rounded-2xl bg-card p-4.5 text-sm tabular-nums"
                >
                  {estimateLines.map(([label, amount]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-3 border-b py-2"
                    >
                      <span>{label}</span>
                      <span>{amount}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 pt-2.5 font-semibold">
                    <span>Total</span>
                    <span>$1,240.00</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-8">
                <CalendarCheck
                  aria-hidden="true"
                  className="size-6 text-brand-on-primary"
                />
                <h3 className="mt-2 text-[22px] font-semibold tracking-tight">
                  Book when you accept
                </h3>
                <p className="leading-relaxed text-primary-foreground/80">
                  Your estimate comes with a proposed date and arrival window.
                  Accepting books it.
                </p>
              </div>
              {features.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="flex flex-col gap-3 rounded-3xl border p-6 sm:p-8"
                >
                  <Icon aria-hidden="true" className="size-6" />
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          aria-labelledby="process-heading"
          className="scroll-mt-20 bg-muted"
        >
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <p className={eyebrowClass}>How it works</p>
            <h2
              id="process-heading"
              className={cn(sectionHeadingClass, "max-w-[620px]")}
            >
              Four steps from request to move day
            </h2>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-3 rounded-[20px] bg-card p-7"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-10 place-items-center rounded-full font-semibold text-primary-foreground",
                      index === 2 ? "bg-brand" : "bg-primary",
                    )}
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="cta-heading"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
        >
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[32px] bg-primary px-6 py-12 text-primary-foreground sm:px-12 sm:py-16">
            <div className="min-w-0 flex-[1_1_420px]">
              <p className="text-[13px] font-semibold tracking-[0.08em] text-brand-on-primary uppercase">
                Ready when you are
              </p>
              <h2
                id="cta-heading"
                className="mt-3 text-[32px] leading-[1.08] font-semibold tracking-tight sm:text-5xl"
              >
                Make your next move easier to follow.
              </h2>
            </div>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "min-h-13 bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90",
              )}
            >
              Create a free account
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <div className="space-y-1">
            <p>
              <span className="font-semibold text-foreground">Rebel Move</span>{" "}
              · CSCI 4994 capstone project. No real moving services are offered.
            </p>
            <a
              href="https://www.pngmart.com/image/636260/png/636259"
              className={cn(
                "inline-flex min-h-11 items-center rounded text-xs underline underline-offset-4",
                focusClass,
              )}
            >
              Ole Miss logo via PNG Mart
            </a>
          </div>
          <nav aria-label="Staff access" className="flex flex-wrap gap-x-5">
            <Link
              href="/worker/login"
              className={cn(
                "inline-flex min-h-11 items-center rounded hover:text-foreground",
                focusClass,
              )}
            >
              Worker login
            </Link>
            <Link
              href="/admin/login"
              className={cn(
                "inline-flex min-h-11 items-center rounded hover:text-foreground",
                focusClass,
              )}
            >
              Administrator login
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export const metadata: Metadata = {
  title: "A clearer way to move | Rebel Move",
};
