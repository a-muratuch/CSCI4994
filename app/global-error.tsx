"use client";
import "./globals.css";
import { PageError } from "@/components/page-error";
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Page error | Rebel Move</title>
      </head>
      <body className="min-h-screen bg-background p-6 font-sans text-foreground">
        <PageError retry={retry} />
      </body>
    </html>
  );
}
