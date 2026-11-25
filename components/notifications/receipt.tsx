"use client";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { readDestination } from "@/lib/notifications/actions";
import { isUuid } from "@/lib/ids";
import { useNotifications } from "./provider";
function Receipt() {
  const id = useSearchParams().get("notification"),
    path = usePathname(),
    { refresh } = useNotifications();
  useEffect(() => {
    if (isUuid(id))
      void readDestination(id, path)
        .then((ok) => {
          if (ok) void refresh();
        })
        .catch(() => {});
  }, [id, path, refresh]);
  return null;
}
export function NotificationReceipt() {
  return (
    <Suspense fallback={null}>
      <Receipt />
    </Suspense>
  );
}
