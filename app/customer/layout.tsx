import { unreadCount } from "@/lib/workflow/data";
import type { Metadata } from "next";
import { CustomerShell } from "./customer-shell";
import { requireRole } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: {
    default: "Customer account | Rebel Move",
    template: "%s | Rebel Move",
  },
  description: "Rebel Move customer moves, estimates, and account settings.",
};

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await requireRole("customer");
  return (
    <CustomerShell
      account={{ name: account.name, unread: await unreadCount() }}
    >
      {children}
    </CustomerShell>
  );
}
