import type { Metadata } from "next";
import { AuthForm } from "../../auth-form";
import { AuthCentered } from "../../auth-shell";

export const metadata: Metadata = { title: "Administrator login" };

export default function AdminLoginPage() {
  return (
    <AuthCentered staff>
      <AuthForm key="admin-login" mode="admin-login" />
    </AuthCentered>
  );
}
