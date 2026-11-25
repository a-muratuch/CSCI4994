import type { Metadata } from "next";
import {
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { controlClass, Panel } from "@/app/customer/customer-ui";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { ProgressSteps } from "@/components/progress-steps";
import {
  HeroPanel,
  heroActionClass,
  heroSecondaryClass,
} from "@/components/hero-panel";
import { PasswordSpecimen } from "./password-specimen";
import { QuickFilters } from "@/components/quick-filters";
import { FilterBar, FilterField } from "@/components/filter-bar";
import { ResponsiveTable, TableHead } from "@/components/responsive-table";
import { Timeline } from "@/components/timeline";
import { progressFor, workerProgressFor } from "@/lib/domain/status";

export const metadata: Metadata = {
  title: "Design system",
  description:
    "Rebel Move typography, colors, components, and accessible states.",
};

const specimenRows = [
  ["RM-1042", "Jordan Lee", "Oxford → Memphis", "requested"],
  ["RM-1038", "Sam Rivera", "Tupelo → Oxford", "awaiting"],
  ["RM-1031", "Casey Brooks", "Oxford → Jackson", "completed"],
] as const;

const colors = [
  ["Primary", "bg-primary text-primary-foreground"],
  ["Surface", "border bg-surface text-foreground"],
  ["Muted", "bg-muted text-muted-foreground"],
  ["Brand", "bg-brand text-brand-foreground"],
  ["Error", "bg-destructive-surface text-destructive"],
  ["Success", "bg-success-surface text-success"],
  ["Warning", "bg-warning-surface text-warning"],
];

export default function DesignSystemPage() {
  return (
    <main className="min-h-dvh bg-surface">
      <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-12 sm:px-8 sm:py-16">
        <header className="space-y-4 border-b pb-8">
          <p className="text-sm font-semibold tracking-wide text-brand">
            Rebel Move / Foundation
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Design system
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            A clear, calm foundation for every move. Neutral surfaces,
            purposeful color, and familiar controls.
          </p>
          <p className="text-sm text-muted-foreground">
            Component specimens only. Buttons do not save or submit data.
          </p>
        </header>

        <section aria-labelledby="palette" className="space-y-4">
          <h2 id="palette" className="text-2xl font-semibold tracking-tight">
            Color
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {colors.map(([label, style]) => (
              <div
                key={label}
                className={`rounded-xl p-4 text-sm font-medium ${style}`}
              >
                {label}
              </div>
            ))}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Brand red marks identity. Error red signals problems. Neutral
            accents remain the default for interaction. Signed-in pages sit on
            the surface tone so white cards stand out.
          </p>
        </section>

        <section aria-labelledby="typography" className="space-y-4">
          <h2 id="typography" className="text-2xl font-semibold tracking-tight">
            Typography
          </h2>
          <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
            <p className="text-[30px] leading-tight font-semibold tracking-[-0.03em]">
              Make room for what’s next.
            </p>
            <p className="text-xl font-medium">Geist keeps every step clear.</p>
            <p className="text-base leading-7">
              Body text uses a comfortable size and line height for everyday
              reading.
            </p>
            <p className="text-sm text-muted-foreground">
              Supporting text adds context without competing with the main
              message.
            </p>
            <p className="font-mono text-sm">Geist Mono · MF-0001</p>
          </div>
        </section>

        <section aria-labelledby="buttons" className="space-y-4">
          <h2 id="buttons" className="text-2xl font-semibold tracking-tight">
            Buttons
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete example</Button>
            <Button variant="link">Link style</Button>
            <Button disabled>Disabled</Button>
            <Button disabled aria-busy="true">
              <LoaderCircle
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
              Pending example
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small · 36px</Button>
            <Button>Default · 44px</Button>
            <Button size="lg">Large · 48px</Button>
            <Button size="sm" variant="outline">
              Small outline
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Buttons are pill-shaped. Small buttons sit inside dense rows; use
            the default or large size for standalone actions. Use Tab to inspect
            focus, and Space or Enter to activate a button.
          </p>
        </section>

        <section aria-labelledby="cards-inputs" className="space-y-4">
          <h2
            id="cards-inputs"
            className="text-2xl font-semibold tracking-tight"
          >
            Cards &amp; inputs
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Input states</h3>
                </CardTitle>
                <CardDescription>
                  Editable specimens with visible labels.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Alex Morgan"
                    aria-describedby="name-help"
                  />
                  <p id="name-help" className="text-sm text-muted-foreground">
                    Enter a name to preview the input style.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email · error example</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="alex@"
                    aria-invalid="true"
                    aria-describedby="email-error"
                  />
                  <p
                    id="email-error"
                    className="flex items-start gap-2 text-sm text-destructive"
                  >
                    <CircleAlert
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    Enter a complete email address.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="select">Select (controlClass)</Label>
                  <select id="select" className={controlClass} defaultValue="">
                    <option value="">Choose a truck size</option>
                    <option>16 ft</option>
                    <option>26 ft</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disabled">Disabled input</Label>
                  <Input id="disabled" disabled placeholder="Not available" />
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-sm text-muted-foreground">
                  The error is a fixed visual specimen.
                </p>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  <h3>Simple card</h3>
                </CardTitle>
                <CardDescription>
                  Group related content with a clear hierarchy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge variant="secondary">Example</Badge>
                <p className="text-base leading-7">
                  White surfaces and subtle borders keep the content in focus.
                </p>
                <div className="rounded-lg bg-muted p-4 text-muted-foreground">
                  Empty state: no items to display.
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline">Example action</Button>
              </CardFooter>
            </Card>
          </div>
          <Panel>
            <div>
              <h3 className="font-semibold">Workspace panel</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Customer, worker and administrator panels share this white,
                bordered card with 20px padding (24px from the small
                breakpoint).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="scheduled" />
              <Button size="sm" variant="outline">
                Panel action
              </Button>
            </div>
          </Panel>
        </section>

        <section aria-labelledby="statuses" className="space-y-4">
          <h2 id="statuses" className="text-2xl font-semibold tracking-tight">
            Badges &amp; status messages
          </h2>
          <div className="flex flex-wrap gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Neutral</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge className="bg-success-surface text-success">Success</Badge>
            <Badge className="bg-warning-surface text-warning">Warning</Badge>
            <Badge variant="destructive">Error</Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="requested" />
            <StatusBadge status="awaiting" />
            <StatusBadge status="in-progress" />
            <StatusBadge status="accepted" />
            <StatusBadge status="completed" />
          </div>
          <p className="text-sm text-muted-foreground">
            Status badges are text-bearing pills: neutral for pending and
            scheduled, amber for attention, green for accepted and completed.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Information",
                text: "This is a component preview.",
                icon: Info,
                style: "bg-muted text-foreground",
              },
              {
                title: "Success",
                text: "Example changes are complete.",
                icon: CheckCircle2,
                style: "bg-success-surface text-success",
              },
              {
                title: "Warning",
                text: "Review the example details before continuing.",
                icon: TriangleAlert,
                style: "bg-warning-surface text-warning",
              },
              {
                title: "Error",
                text: "Something went wrong. Try the action again.",
                icon: CircleAlert,
                style: "bg-destructive-surface text-destructive",
              },
            ].map(({ title, text, icon: Icon, style }) => (
              <div
                key={title}
                className={`flex items-start gap-3 rounded-xl p-4 ${style}`}
              >
                <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-6">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="patterns" className="space-y-8">
          <div className="space-y-2">
            <h2 id="patterns" className="text-2xl font-semibold tracking-tight">
              Page patterns
            </h2>
            <p className="text-sm text-muted-foreground">
              Shared pieces from the redesign mockups, shown with sample values.
              Links point back to this page.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Page heading</h3>
            <div className="rounded-2xl border bg-background p-5 sm:p-6">
              <PageHeading
                titleAs="h4"
                eyebrow="Requests / RM-1042"
                title="Move request"
                badge={<StatusBadge status="requested" />}
                description="Submitted today. Review the inventory before preparing an estimate."
                actions={
                  <>
                    <Button variant="outline">Message customer</Button>
                    <Button>Prepare estimate</Button>
                  </>
                }
                className="mb-0"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Stat cards</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Requests needing review"
                value={4}
                note="2 new today"
                href="/design-system"
              />
              <StatCard label="Awaiting customer decision" value={3} />
              <StatCard label="Accepted, not scheduled" value={1} />
              <StatCard
                label="Jobs today"
                value={2}
                note="1 on the way"
                dark
                href="/design-system"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Hero panel</h3>
            <HeroPanel
              titleAs="h4"
              eyebrow="Your estimate is ready"
              title="Oxford → Memphis · $1,240.00"
              actions={
                <>
                  <Button className={heroActionClass}>Review estimate</Button>
                  <Button className={heroSecondaryClass}>Message us</Button>
                </>
              }
            >
              Accepting books the proposed time if the crew and truck are still
              free.
            </HeroPanel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Password field</h3>
              <Panel>
                <PasswordSpecimen />
                <p className="text-sm text-muted-foreground">
                  The toggle&apos;s name follows its state: “Show password” /
                  “Hide password”.
                </p>
              </Panel>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Selection cards</h3>
              <Panel>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    Preferred arrival window (radio cards)
                  </legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      ["Morning", "8–10 a.m."],
                      ["Afternoon", "2–4 p.m."],
                    ].map(([name, time], index) => (
                      <label
                        key={name}
                        className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-[14px] border p-3.5 has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring"
                      >
                        <span className="flex items-center gap-2.5 text-sm font-medium">
                          <input
                            type="radio"
                            name="specimen-window"
                            defaultChecked={index === 0}
                            className="size-4 accent-primary outline-none"
                          />
                          {name}
                        </span>
                        <span className="pl-6.5 text-[13px] text-muted-foreground">
                          {time}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[14px] border p-3.5 text-sm has-checked:border-primary has-checked:bg-surface has-focus-visible:ring-3 has-focus-visible:ring-ring">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-0.5 size-5 shrink-0 accent-primary outline-none"
                  />
                  <span>
                    <span className="block font-semibold">Alex Morgan</span>
                    <span className="mt-1 inline-block rounded-full bg-success-surface px-2 py-0.5 text-xs font-semibold text-success">
                      Suggested
                    </span>
                  </span>
                </label>
              </Panel>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Progress steps</h3>
              <Panel>
                <ProgressSteps
                  label="Move progress"
                  steps={progressFor({ stage: "scheduled" })}
                />
                <ProgressSteps
                  label="Job progress"
                  steps={workerProgressFor({
                    status: "scheduled",
                    onTheWay: true,
                  })}
                />
              </Panel>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Timeline</h3>
              <Panel>
                <Timeline
                  label="Example history"
                  items={[
                    {
                      id: "submitted",
                      title: "Request submitted",
                      meta: "Today, 9:14 AM",
                    },
                    {
                      id: "estimate",
                      title: "Estimate sent",
                      meta: "Waiting on the office",
                      pending: true,
                    },
                  ]}
                />
              </Panel>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">
              Quick filters, filter bar and table
            </h3>
            <QuickFilters
              label="Example quick filters"
              filters={[
                {
                  label: "All",
                  count: 18,
                  href: "/design-system",
                  selected: true,
                },
                {
                  label: "Needs estimate",
                  count: 4,
                  href: "/design-system?filter=estimate",
                },
                {
                  label: "Moving this week",
                  count: 5,
                  href: "/design-system?filter=week",
                },
              ]}
            />
            <FilterBar aria-label="Filter example records" role="search">
              <FilterField label="Search" className="flex-[2_1_14rem]">
                <Input
                  type="search"
                  name="q"
                  placeholder="Name, reference or ZIP"
                />
              </FilterField>
              <FilterField label="Request status">
                <select name="status" className={controlClass} defaultValue="">
                  <option value="">All statuses</option>
                  <option>Request pending</option>
                </select>
              </FilterField>
            </FilterBar>
            <ResponsiveTable label="Example requests table">
              <caption className="sr-only">Example requests</caption>
              <TableHead columns={["Ref", "Customer", "Route", "Status"]} />
              <tbody>
                {specimenRows.map(([ref, name, route, status]) => (
                  <tr key={ref}>
                    <td className="font-mono text-[13px]">{ref}</td>
                    <td>{name}</td>
                    <td>{route}</td>
                    <td>
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          </div>
        </section>
      </div>
    </main>
  );
}
