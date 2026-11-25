import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const controlClass =
  "select-control min-h-11 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive";
export { linkClass as textLinkClass } from "@/lib/ui";
export { PageHeading } from "@/components/page-heading";

export function ActionLink({
  href,
  children,
  outline = false,
}: {
  href: string;
  children: React.ReactNode;
  outline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: outline ? "outline" : "default" }),
        "min-h-11 px-4",
      )}
    >
      {children}
    </Link>
  );
}
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 gap-5 break-words p-5 sm:p-6", className)}>
      {children}
    </Card>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel className="items-center py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-sm leading-6 text-muted-foreground">{children}</div>
    </Panel>
  );
}
export function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
