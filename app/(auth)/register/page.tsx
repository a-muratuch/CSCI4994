import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Customer registration | WeGo" };

export default function RegisterPage() {
  return <AuthForm key="register" mode="register" />;
}
