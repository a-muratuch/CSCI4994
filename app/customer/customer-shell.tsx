import { AppShell } from "@/components/app-shell";
export function CustomerShell({
  children,
  account,
}: {
  children: React.ReactNode;
  account: { name: string; unread?: number };
}) {
  return (
    <AppShell role="customer" account={account}>
      {children}
    </AppShell>
  );
}
