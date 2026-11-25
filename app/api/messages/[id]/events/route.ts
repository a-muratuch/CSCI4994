import { readAccount } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!uuid(id))
    return new Response("Conversation unavailable.", { status: 404, headers });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return new Response("Unavailable.", { status: 403, headers });
  try {
    const client = await serverSupabase();
    const { account } = await readAccount(client);
    if (!account)
      return new Response("Sign in to receive updates.", {
        status: 401,
        headers,
      });
    const conversation = await client
      .from("conversations")
      .select("id,job_id")
      .eq("id", id)
      .maybeSingle();
    if (conversation.error || !conversation.data)
      return new Response("Conversation unavailable.", {
        status: 404,
        headers,
      });
    // getUser/profile checks above authorize; this session is only the server-side transport credential.
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session)
      return new Response("Sign in to receive updates.", {
        status: 401,
        headers,
      });
    await client.realtime.setAuth(session.access_token);
    const jobId = conversation.data.job_id;
    const encoder = new TextEncoder();
    let finish = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let stopped = false;
        let checking = false;
        const resources: {
          channel?: ReturnType<typeof client.channel>;
          heartbeat?: ReturnType<typeof setInterval>;
          deadline?: ReturnType<typeof setTimeout>;
        } = {};
        const emit = (event: string) => {
          if (!stopped)
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
        };
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
            /* The reader may already have cancelled. */
          }
        };
        request.signal.addEventListener("abort", finish, { once: true });
        if (request.signal.aborted) {
          finish();
          return;
        }
        controller.enqueue(encoder.encode("retry: 3000\n\n"));
        const channel = client
          .channel(`conversation:${id}:${crypto.randomUUID()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${id}`,
            },
            () => emit("change"),
          );
        if (jobId)
          channel.on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "jobs",
              filter: `id=eq.${jobId}`,
            },
            () => emit("change"),
          );
        resources.channel = channel;
        channel.subscribe((status) => {
          if (status === "SUBSCRIBED") emit("ready");
          else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            emit("unavailable");
            finish();
          }
        });
        // Reassignment can revoke the worker's UPDATE event itself. Recheck access independently.
        if (stopped) return;
        resources.heartbeat = setInterval(async () => {
          if (stopped || checking) return;
          checking = true;
          try {
            const [user, access] = await Promise.all([
              client.auth.getUser(),
              client
                .from("conversations")
                .select("id")
                .eq("id", id)
                .maybeSingle(),
            ]);
            if (user.error || !user.data.user || access.error || !access.data) {
              emit("revoked");
              finish();
            } else if (!stopped)
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            emit("unavailable");
            finish();
          } finally {
            checking = false;
          }
        }, 15000);
        // Reconnect with fresh request cookies, including session renewal or logout.
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
    return new Response("Live updates unavailable.", { status: 503, headers });
  }
}
