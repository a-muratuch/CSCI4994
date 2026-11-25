import { AppShell } from "@/components/app-shell";
export function WorkerShell({
  children,
  account,
}: {
  children: React.ReactNode;
  account: { name: string; unread?: number };
}) {
  return (
    <AppShell role="worker" account={account}>
      {children}
    </AppShell>
  );
}
