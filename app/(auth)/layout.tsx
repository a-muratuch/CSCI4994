import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/50">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link href="/" aria-label="WeGo home" className="flex min-h-11 items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground">W</span>
          <span className="text-lg">WeGo</span>
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
        </Link>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-10">{children}</main>
      <footer className="px-4 py-6 text-center text-sm text-muted-foreground">WeGo · CSCI 4994 capstone prototype</footer>
    </div>
  );
}
