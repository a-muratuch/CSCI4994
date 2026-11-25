"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Role } from "@/lib/auth/roles";
import {
  notificationSnapshot,
  type NotificationState,
} from "@/lib/notifications/model";
type Context = {
  role: Role;
  state: NotificationState | null;
  version: number;
  live: string;
  refresh: () => Promise<void>;
};
const NotificationContext = createContext<Context | null>(null);
export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("Notification provider missing");
  return value;
}
export async function fetchNotifications(
  role: Role,
  unread = false,
  page = 1,
): Promise<NotificationState> {
  const response = await fetch(
    `/api/notifications?${new URLSearchParams({ unread: String(unread), page: String(page) })}`,
    { cache: "no-store" },
  );
  const value = await response.json();
  if (!response.ok || value.role !== role) return { state: "error" };
  if (value.state === "setup") return { state: "setup" };
  const snapshot = notificationSnapshot(value.snapshot);
  return snapshot ? { state: "ready", role, snapshot } : { state: "error" };
}
export function NotificationProvider({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<NotificationState | null>(null),
    [version, setVersion] = useState(0),
    [live, setLive] = useState("Connecting updates…");
  const alive = useRef(false),
    sequence = useRef(0);
  const refresh = useCallback(async () => {
    const turn = ++sequence.current;
    try {
      const next = await fetchNotifications(role);
      if (alive.current && turn === sequence.current) {
        setState(next);
        setVersion((v) => v + 1);
      }
    } catch {
      if (alive.current && turn === sequence.current)
        setState({ state: "error" });
    }
  }, [role]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(refresh);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
    };
  }, [refresh]);
  const ready = state?.state === "ready";
  useEffect(() => {
    if (!ready) return;
    const stream = new EventSource("/api/notifications/events");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 200);
    };
    const connected = () => {
      setLive("Live updates connected.");
      changed();
    };
    const unavailable = () =>
      setLive(
        "Live updates interrupted. Reconnecting; you can refresh notifications.",
      );
    const revoked = () => {
      stream.close();
      setState({ state: "error" });
      setLive("Account access changed. Sign in again.");
    };
    stream.addEventListener("ready", connected);
    stream.addEventListener("change", changed);
    stream.addEventListener("unavailable", unavailable);
    stream.addEventListener("revoked", revoked);
    stream.onerror = unavailable;
    return () => {
      clearTimeout(timer);
      stream.close();
    };
  }, [ready, refresh]);
  return (
    <NotificationContext.Provider
      value={{ role, state, version, live, refresh }}
    >
      <span className="sr-only" role="status">
        {state?.state === "ready"
          ? `${state.snapshot.unread} unread notifications`
          : ""}
      </span>
      {children}
    </NotificationContext.Provider>
  );
}
