import type { Metadata } from "next";
import Link from "next/link";
import { currentAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { recentEmailProof } from "@/lib/auth/password";
import { PasswordForm } from "@/components/password-form";
import { CircleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AuthCentered } from "../auth-shell";
export const metadata: Metadata = { title: "Set new password" };
export default async function Page() {
  const { account } = await currentAccount();
  if (account) {
    const client = await serverSupabase();
    const claims = await client.auth.getClaims();
    if (!claims.error && recentEmailProof(claims.data?.claims, account.id))
      return (
        <AuthCentered>
          <PasswordForm mode="reset" />
        </AuthCentered>
      );
  }
  return (
    <AuthCentered>
      <div className="flex flex-col items-start gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <CircleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
          Reset link unavailable
        </h1>
        <p className="text-muted-foreground">
          Open a fresh reset link in the browser where you requested it.
        </p>
        <div className="flex w-full flex-col gap-2.5">
          <Link href="/forgot-password" className={buttonVariants()}>
            Request a new reset link
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to log in
          </Link>
        </div>
      </div>
    </AuthCentered>
  );
}
