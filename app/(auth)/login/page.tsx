import type { Metadata } from "next";
import { AuthForm } from "../auth-form";
import { AuthSplit } from "../auth-shell";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthSplit
      headline="Your move, in one calm place."
      points={[
        "See estimates line by line before you decide",
        "Accept to book your arrival window",
        "Chat with your crew on move day",
      ]}
    >
      <AuthForm key="login" mode="login" />
    </AuthSplit>
  );
}
