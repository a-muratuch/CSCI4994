import type { Metadata } from "next";
import { MessagesPage } from "@/components/messages/page";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  return <MessagesPage role="customer" group={(await searchParams).group} />;
}

export const metadata: Metadata = { title: "Messages" };
