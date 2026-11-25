import { unreadCount } from "@/lib/workflow/data";
import type { Metadata } from "next";
import { AdminShell } from "./admin-shell";
import { requireRole } from "@/lib/auth/account";
export const metadata: Metadata = {
  title: { default: "Administrator | Rebel Move", template: "%s | Rebel Move" },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await requireRole("admin");
  return (
    <AdminShell account={{ name: account.name, unread: await unreadCount() }}>
      {children}
    </AdminShell>
  );
}
