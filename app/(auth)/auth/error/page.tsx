import type { Metadata } from "next";
import { serverSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AuthCentered } from "../../auth-shell";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const signedIn = await serverSupabase()
    .then((client) => client.auth.getUser())
    .then((result) => Boolean(result.data.user))
    .catch(() => false);
  const { reason } = await searchParams;
  const message =
    reason === "confirmation"
      ? "The confirmation link is invalid, expired, or was opened in a different browser. Try signing in if you already confirmed your email, or register again to request another link."
      : reason === "profile"
        ? "Your account profile could not be loaded. Please contact the project owner."
        : reason === "configuration"
          ? "Sign-in has not been configured. Please contact the project owner."
          : "Sign-in is temporarily unavailable. Please try again.";
  return (
    <AuthCentered>
      <div className="flex flex-col items-start gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-muted">
          <CircleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
          We could not open your account
        </h1>
        <p className="leading-7 text-muted-foreground">{message}</p>
        <div className="flex w-full flex-col gap-2.5">
          <Link href="/login" className={buttonVariants()}>
            Back to log in
          </Link>
          {signedIn && <SignOutButton />}
        </div>
      </div>
    </AuthCentered>
  );
}

export const metadata: Metadata = { title: "Account error" };
