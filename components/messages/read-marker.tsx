"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { markRead } from "@/lib/messages/actions";
export function ReadMarker({
  id,
  messageId,
}: {
  id: string;
  messageId?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!messageId) return;
    const read = () => {
      if (document.visibilityState === "visible")
        void markRead(id, messageId).then((ok) => {
          if (ok) router.refresh();
        });
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [id, messageId, router]);
  return null;
}
