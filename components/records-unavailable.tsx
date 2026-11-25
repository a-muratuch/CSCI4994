import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { focusClass } from "@/lib/ui";
export function RecordsUnavailable({
  title = "Records unavailable",
  href,
  partial = false,
  linkLabel = "Try again",
}: {
  title?: string;
  href?: string;
  partial?: boolean;
  linkLabel?: string;
}) {
  // A partial-records banner sits above the page's own h1, so it is not a heading.
  const Heading = partial ? "p" : "h1";
  return (
    <Card className="border py-0 ring-0">
      <CardContent className="space-y-3 p-4 sm:p-6">
        <Heading className="text-xl font-semibold">{title}</Heading>
        <p role="alert">
          {partial
            ? "Some records could not be displayed safely. Refresh the page or contact the administrator."
            : "Records could not be loaded. Please try again."}
        </p>
        {href && (
          <Link
            href={href}
            className={`inline-flex min-h-11 items-center underline underline-offset-4 ${focusClass}`}
          >
            {linkLabel}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
