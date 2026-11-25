import { unreadCount } from "@/lib/workflow/data";
import type { Metadata } from "next";
import { WorkerShell } from "./worker-shell";
import { requireRole } from "@/lib/auth/account";

export const metadata: Metadata = {
  title: {
    default: "Worker account | Rebel Move",
    template: "%s | Rebel Move",
  },
  description: "Rebel Move worker assignments, schedule, and availability.",
};

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await requireRole("worker");
  return (
    <WorkerShell account={{ name: account.name, unread: await unreadCount() }}>
      {children}
    </WorkerShell>
  );
}
