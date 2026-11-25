import { AppShell } from "@/components/app-shell";
export function AdminShell({
  children,
  account,
}: {
  children: React.ReactNode;
  account: { name: string; unread?: number };
}) {
  return (
    <AppShell role="admin" account={account}>
      {children}
    </AppShell>
  );
}
