"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveUpdates({
  conversationId,
  quiet = false,
}: {
  conversationId: string;
  quiet?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("Connecting live updates…");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const events = new EventSource(`/api/messages/${conversationId}/events`);
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    const ready = () => {
      setStatus("Live updates connected.");
      refresh();
    };
    const change = () => {
      setStatus("Live updates connected. Conversation updated.");
      refresh();
    };
    const unavailable = () =>
      setStatus(
        "Live updates interrupted. Reconnecting; you can also refresh messages.",
      );
    const revoked = () => {
      events.close();
      setStatus("Conversation access changed. Refreshing…");
      refresh();
    };
    events.addEventListener("ready", ready);
    events.addEventListener("change", change);
    events.addEventListener("unavailable", unavailable);
    events.addEventListener("revoked", revoked);
    events.onerror = () =>
      setStatus(
        "Live updates disconnected. Reconnecting; refresh messages if this continues.",
      );
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      events.close();
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [conversationId, router]);
  return (
    <p
      role="status"
      className={
        quiet && status.startsWith("Live updates connected")
          ? "sr-only"
          : "text-xs leading-5 text-muted-foreground"
      }
    >
      {status}
    </p>
  );
}
