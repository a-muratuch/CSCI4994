import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return (
    <section className="mx-auto my-12 max-w-lg space-y-5 rounded-2xl border bg-background p-6 text-foreground">
      <title>Page not found | Rebel Move</title>
      <Brand />
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-muted-foreground">
        This page or record is not available to your account. Check the address
        or return home.
      </p>
      <Link href="/" className={buttonVariants() + " min-h-11"}>
        Back to home
      </Link>
    </section>
  );
}
