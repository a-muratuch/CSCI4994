import type { Metadata } from "next";
import Link from "next/link";
import { PasswordForm } from "@/components/password-form";
import { linkClass } from "@/lib/ui";
import { AuthCentered } from "../auth-shell";
export const metadata: Metadata = { title: "Forgot password" };
export default function Page() {
  return (
    <AuthCentered>
      <PasswordForm mode="request" />
      <Link className={`${linkClass} mt-2`} href="/login">
        Back to log in
      </Link>
    </AuthCentered>
  );
}
