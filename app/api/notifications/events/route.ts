import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { loadNotifications } from "@/lib/notifications/data";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  try {
    const client = await serverSupabase();
    const { account } = await readAccount(client);
    if (!account)
      return new Response("Sign in to receive notifications.", {
        status: 401,
        headers,
      });
    if ((await loadNotifications(client)).state !== "ready")
      return new Response("Notifications unavailable.", {
        status: 503,
        headers,
      });
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session)
      return new Response("Sign in to receive notifications.", {
        status: 401,
        headers,
      });
    await client.realtime.setAuth(session.access_token);
    const encoder = new TextEncoder();
    let finish = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let stopped = false,
          checking = false;
        const resources: {
          heartbeat?: ReturnType<typeof setInterval>;
          deadline?: ReturnType<typeof setTimeout>;
          channel?: ReturnType<typeof client.channel>;
        } = {};
        finish = () => {
          if (stopped) return;
          stopped = true;
          clearInterval(resources.heartbeat);
          clearTimeout(resources.deadline);
          request.signal.removeEventListener("abort", finish);
          if (resources.channel)
            void client.removeChannel(resources.channel).catch(() => {});
          try {
            controller.close();
          } catch {
            /* Reader already closed. */
          }
        };
        const emit = (event: string) => {
          if (stopped) return;
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
          } catch {
            finish();
          }
        };
        request.signal.addEventListener("abort", finish, { once: true });
        if (request.signal.aborted) {
          finish();
          return;
        }
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        const channel = client
          .channel(`notifications:${account.id}:${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `recipient_id=eq.${account.id}`,
            },
            () => emit("change"),
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "notifications",
              filter: `recipient_id=eq.${account.id}`,
            },
            () => emit("change"),
          );
        resources.channel = channel;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") emit("ready");
          else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            emit("unavailable");
            finish();
          }
        });
        if (stopped) return;
        resources.heartbeat = setInterval(async () => {
          if (stopped || checking) return;
          checking = true;
          try {
            const current = await readAccount(client);
            if (
              !current.account ||
              current.account.id !== account.id ||
              current.account.role !== account.role
            ) {
              emit("revoked");
              finish();
            } else emit("change"); // Also removes alerts hidden by reassignment without a notification-row update.
          } catch {
            emit("unavailable");
            finish();
          } finally {
            checking = false;
          }
        }, 15000);
        resources.deadline = setTimeout(finish, 55000);
      },
      cancel() {
        finish();
      },
    });
    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new Response("Live notifications unavailable.", {
      status: 503,
      headers,
    });
  }
}
