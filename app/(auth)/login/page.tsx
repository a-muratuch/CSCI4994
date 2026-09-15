import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in | WeGo" };

export default function LoginPage() {
  return <AuthForm key="login" mode="login" />;
}
