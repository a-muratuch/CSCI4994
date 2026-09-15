import {
  ArrowRight,
  Box,
  CalendarCheck,
  Check,
  ClipboardList,
  House,
  MapPin,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const services = [
  {
    title: "Household moves",
    description:
      "Organize the details of a local move in one clear, guided request.",
    icon: House,
  },
  {
    title: "Packing coordination",
    description:
      "Tell the team what needs extra care so the right plan can be prepared.",
    icon: PackageCheck,
  },
  {
    title: "Move-day progress",
    description:
      "Follow the planned job from scheduling through completion in the full prototype.",
    icon: Route,
  },
];

const steps = [
  {
    number: "01",
    title: "Share your move",
    description:
      "Provide the pickup, destination, preferred date, property details, and notes.",
  },
  {
    number: "02",
    title: "Review your estimate",
    description:
      "The moving team reviews the request and prepares a manual estimate.",
  },
  {
    number: "03",
    title: "Confirm the plan",
    description:
      "Accept the estimate before the team schedules the job and assigns resources.",
  },
  {
    number: "04",
    title: "Follow the move",
    description:
      "See clear progress as the scheduled move advances toward completion.",
  },
];

export default function Home() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0 focus:outline-none focus:ring-3 focus:ring-ring"
      >
        Skip to content
      </a>

      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            className="flex items-center gap-2 rounded-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring"
            aria-label="WeGo home"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-foreground"
            >
              W
            </span>
            <span className="text-lg">WeGo</span>
          </a>

          <nav
            aria-label="Main navigation"
            className="order-3 flex w-full items-center justify-between gap-1 border-t pt-3 sm:order-2 sm:w-auto sm:border-0 sm:pt-0"
          >
            <a
              href="#services"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
            >
              Services
            </a>
            <a
              href="#how-it-works"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
            >
              How it works
            </a>
          </nav>

          <a
            href="#get-started"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "order-2 min-h-11 px-4 sm:order-3",
            )}
          >
            Plan your move
          </a>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section id="top" className="overflow-hidden border-b">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8 lg:py-28">
            <div className="space-y-7">
              <Badge className="bg-brand/10 text-brand">Moving, made clearer</Badge>
              <div className="space-y-5">
                <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  A calmer way to plan your next move.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  WeGo brings requests, estimates, scheduling, and move-day
                  progress into one straightforward experience.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#get-started"
                  className={cn(
                    buttonVariants({ variant: "default", size: "lg" }),
                    "min-h-12 px-5 text-base",
                  )}
                >
                  Plan your move
                  <ArrowRight aria-hidden="true" />
                </a>
                <a
                  href="#how-it-works"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-h-12 px-5 text-base",
                  )}
                >
                  See how it works
                </a>
              </div>
              <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Capstone prototype — no request or personal information is saved.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
              <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-full bg-brand/5 blur-3xl" />
              <Card className="gap-0 py-0 shadow-sm">
                <CardHeader className="border-b bg-muted/50 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
                        <Truck aria-hidden="true" className="size-5" />
                      </span>
                      <div>
                        <CardTitle>Move overview</CardTitle>
                        <CardDescription>Prototype journey</CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-success-surface text-success">On track</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 py-6">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-5">
                    <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                      <MapPin aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pickup</p>
                      <p className="mt-1 font-medium">Oxford, Mississippi</p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Box aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Move type</p>
                      <p className="mt-1 font-medium">Two-bedroom home</p>
                    </div>
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                      <CalendarCheck aria-hidden="true" className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Requested date</p>
                      <p className="mt-1 font-medium">Example date</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="flex items-center gap-2 font-medium">
                      <Check aria-hidden="true" className="size-4 text-success" />
                      Details ready for review
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      A coordinator would use these details to prepare a manual estimate.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="services" aria-labelledby="services-heading" className="scroll-mt-6">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">Services</p>
              <h2 id="services-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Support for the whole moving journey
              </h2>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                The WeGo prototype focuses on the information and coordination that keep a move understandable.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {services.map(({ title, description, icon: Icon }) => (
                <Card key={title} className="h-full">
                  <CardHeader className="gap-4">
                    <span className="grid size-11 place-items-center rounded-lg bg-muted text-foreground">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <CardTitle>
                      <h3 className="text-lg">{title}</h3>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-7 text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="process-heading" className="scroll-mt-6 bg-muted/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="max-w-2xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">How it works</p>
              <h2 id="process-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Four clear steps from request to move day
              </h2>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                Each step keeps the customer and moving team aligned on what comes next.
              </p>
            </div>

            <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <li key={step.number} className="bg-background p-6 sm:p-7">
                  <span className="font-mono text-sm font-medium text-brand">{step.number}</span>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="get-started" aria-labelledby="cta-heading" className="scroll-mt-6">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            <div className="overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-14">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand">Ready when you are</p>
                <h2 id="cta-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Make your next move easier to follow.
                </h2>
                <p className="mt-4 text-base leading-7 text-primary-foreground/75">
                  The move-request form is the next stage of this capstone prototype. For now, review the journey and see what WeGo is designed to simplify.
                </p>
              </div>
              <a
                href="#how-it-works"
                className={cn(
                  buttonVariants({ variant: "secondary", size: "lg" }),
                  "mt-7 min-h-12 px-5 text-base lg:mt-0",
                )}
              >
                Review the process
                <ClipboardList aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="font-medium text-foreground">WeGo</p>
          <p>CSCI 4994 capstone prototype. No real moving services are offered.</p>
        </div>
      </footer>
    </div>
  );
}
