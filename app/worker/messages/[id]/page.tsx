import type { Metadata } from "next";
import { MessagesPage } from "@/components/messages/page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <MessagesPage role="worker" id={(await params).id} />;
}

export const metadata: Metadata = { title: "Conversation" };
