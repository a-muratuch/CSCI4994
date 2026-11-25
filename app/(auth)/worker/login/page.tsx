import type { Metadata } from "next";
import { AuthForm } from "../../auth-form";
import { AuthCentered } from "../../auth-shell";

export const metadata: Metadata = { title: "Worker login" };

export default function WorkerLoginPage() {
  return (
    <AuthCentered staff>
      <AuthForm key="worker-login" mode="worker-login" />
    </AuthCentered>
  );
}
