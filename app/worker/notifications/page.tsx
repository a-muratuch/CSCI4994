import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/account";
import { notificationPage } from "@/lib/notifications/model";
import { NotificationsPage } from "@/components/notifications/page";
export const metadata: Metadata = { title: "Notifications" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("worker");
  const params = await searchParams;
  const page = notificationPage(params.page),
    unread = params.filter === "unread";
  return (
    <NotificationsPage key={`${page}:${unread}`} page={page} unread={unread} />
  );
}
