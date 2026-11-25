import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { AuthSplit } from "../auth-shell";

export const metadata: Metadata = { title: "Customer registration" };

export default function RegisterPage() {
  return (
    <AuthSplit
      headline="Request a move in a few minutes."
      points={[
        "Route, date and preferred arrival window",
        "List your items for a more accurate estimate",
        "Estimates aren't binding and no payment is collected",
      ]}
    >
      <AuthForm key="register" mode="register" />
    </AuthSplit>
  );
}
