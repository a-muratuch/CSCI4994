import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Design system | MoveFlow",
  description: "MoveFlow typography, colors, components, and accessible states.",
};

const colors = [
  ["Primary", "bg-primary text-primary-foreground"],
  ["Muted", "bg-muted text-muted-foreground"],
  ["Brand", "bg-brand text-brand-foreground"],
  ["Error", "bg-destructive-surface text-destructive"],
  ["Success", "bg-success-surface text-success"],
  ["Warning", "bg-warning-surface text-warning"],
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 px-4 py-12 sm:px-8 sm:py-16">
      <header className="space-y-4 border-b pb-8">
        <p className="text-sm font-semibold tracking-wide text-brand">MoveFlow / Foundation</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Design system</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">A clear, calm foundation for every move. Neutral surfaces, purposeful color, and familiar controls.</p>
        <p className="text-sm text-muted-foreground">Component specimens only. Buttons do not save or submit data.</p>
      </header>

      <section aria-labelledby="palette" className="space-y-4">
        <h2 id="palette" className="text-2xl font-semibold tracking-tight">Color</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {colors.map(([label, style]) => <div key={label} className={`rounded-lg p-4 text-sm font-medium ${style}`}>{label}</div>)}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">Brand red marks identity. Error red signals problems. Neutral accents remain the default for interaction.</p>
      </section>

      <section aria-labelledby="typography" className="space-y-4">
        <h2 id="typography" className="text-2xl font-semibold tracking-tight">Typography</h2>
        <div className="space-y-4 rounded-xl border p-6">
          <p className="text-3xl font-semibold tracking-tight sm:text-4xl">Make room for what’s next.</p>
          <p className="text-xl font-medium">Geist keeps every step clear.</p>
          <p className="text-base leading-7">Body text uses a comfortable size and line height for everyday reading.</p>
          <p className="text-sm text-muted-foreground">Supporting text adds context without competing with the main message.</p>
          <p className="font-mono text-sm">Geist Mono · MF-0001</p>
        </div>
      </section>

      <section aria-labelledby="buttons" className="space-y-4">
        <h2 id="buttons" className="text-2xl font-semibold tracking-tight">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button className="min-h-11">Primary</Button>
          <Button className="min-h-11" variant="secondary">Secondary</Button>
          <Button className="min-h-11" variant="outline">Outline</Button>
          <Button className="min-h-11" variant="ghost">Ghost</Button>
          <Button className="min-h-11" variant="destructive">Delete example</Button>
          <Button className="min-h-11" variant="link">Link style</Button>
          <Button className="min-h-11" disabled>Disabled</Button>
          <Button className="min-h-11" disabled aria-busy="true"><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />Pending example</Button>
        </div>
        <p className="text-sm text-muted-foreground">Use Tab to inspect focus, and Space or Enter to activate a button.</p>
      </section>

      <section aria-labelledby="cards-inputs" className="space-y-4">
        <h2 id="cards-inputs" className="text-2xl font-semibold tracking-tight">Cards &amp; inputs</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle><h3>Input states</h3></CardTitle><CardDescription>Editable specimens with visible labels.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label htmlFor="name">Name</Label><Input className="min-h-11" id="name" placeholder="Alex Morgan" aria-describedby="name-help" /><p id="name-help" className="text-sm text-muted-foreground">Use a fictional name for this example.</p></div>
              <div className="space-y-2"><Label htmlFor="email">Email · error example</Label><Input className="min-h-11" id="email" type="email" defaultValue="alex@" aria-invalid="true" aria-describedby="email-error" /><p id="email-error" className="flex items-start gap-2 text-sm text-destructive"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />Enter a complete email address.</p></div>
              <div className="space-y-2"><Label htmlFor="disabled">Disabled input</Label><Input className="min-h-11" id="disabled" disabled placeholder="Not available" /></div>
            </CardContent>
            <CardFooter><p className="text-sm text-muted-foreground">The error is a fixed visual specimen.</p></CardFooter>
          </Card>
          <Card>
            <CardHeader><CardTitle><h3>Simple card</h3></CardTitle><CardDescription>Group related content with a clear hierarchy.</CardDescription></CardHeader>
            <CardContent className="space-y-4"><Badge variant="secondary">Example</Badge><p className="text-base leading-7">White surfaces and subtle borders keep the content in focus.</p><div className="rounded-lg bg-muted p-4 text-muted-foreground">Empty state: no items to display.</div></CardContent>
            <CardFooter><Button className="min-h-11" variant="outline">Example action</Button></CardFooter>
          </Card>
        </div>
      </section>

      <section aria-labelledby="statuses" className="space-y-4">
        <h2 id="statuses" className="text-2xl font-semibold tracking-tight">Badges &amp; status messages</h2>
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge><Badge variant="secondary">Neutral</Badge><Badge variant="outline">Outline</Badge>
          <Badge className="bg-success-surface text-success">Success</Badge><Badge className="bg-warning-surface text-warning">Warning</Badge><Badge variant="destructive">Error</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Information", text: "This is a component preview.", icon: Info, style: "bg-muted text-foreground" },
            { title: "Success", text: "Example changes are complete.", icon: CheckCircle2, style: "bg-success-surface text-success" },
            { title: "Warning", text: "Review the example details before continuing.", icon: TriangleAlert, style: "bg-warning-surface text-warning" },
            { title: "Error", text: "Something went wrong. Try the action again.", icon: CircleAlert, style: "bg-destructive-surface text-destructive" },
          ].map(({ title, text, icon: Icon, style }) => (
            <div key={title} className={`flex items-start gap-3 rounded-lg p-4 ${style}`}>
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm leading-6">{text}</p></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
