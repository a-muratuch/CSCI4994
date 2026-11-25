"use client";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export function PageError({ retry }: { retry: () => void }) {
  return (
    <Card className="mx-auto max-w-lg gap-5 p-6">
      <title>Page error | Rebel Move</title>
      <Brand />
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
        We couldn’t load this page
      </h1>
      <p role="alert" className="text-muted-foreground">
        Please try again, or return home and reopen the page.
      </p>
      <Button className="min-h-11" onClick={retry}>
        Try again
      </Button>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-sm underline outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        Back to home
      </Link>
    </Card>
  );
}
