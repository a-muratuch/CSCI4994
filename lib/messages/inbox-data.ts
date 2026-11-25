import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { shortReference } from "@/lib/reference";
import { unstable_rethrow } from "next/navigation";
import type { InboxEntry } from "./inbox";

export async function loadAdminInbox(): Promise<InboxEntry[] | null> {
  const account = await requireRole("admin");
  try {
    const client = await serverSupabase();
    // Ordered pages avoid silently losing conversations at the API row cap.
    const conversationPage = (offset: number) =>
      client
        .from("conversations")
        .select(
          "id,kind,owner_id,job_id,created_at,jobs(request_id),messages(body,created_at,sender_id),conversation_reads(read_at)",
        )
        .order("id")
        .range(offset, offset + 499)
        .order("created_at", { referencedTable: "messages", ascending: false })
        .order("id", { referencedTable: "messages", ascending: false })
        .limit(1, { referencedTable: "messages" })
        .eq("conversation_reads.user_id", account.id);
    const profilePage = (offset: number) =>
      client
        .from("profiles")
        .select("id,full_name,role")
        .order("id")
        .range(offset, offset + 499);
    const chats: NonNullable<
      Awaited<ReturnType<typeof conversationPage>>["data"]
    > = [];
    const profiles: NonNullable<
      Awaited<ReturnType<typeof profilePage>>["data"]
    > = [];
    const loadChats = async () => {
      for (let offset = 0; ; offset += 500) {
        const result = await conversationPage(offset);
        if (result.error) throw result.error;
        chats.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 500) break;
      }
    };
    const loadProfiles = async () => {
      for (let offset = 0; ; offset += 500) {
        const result = await profilePage(offset);
        if (result.error) throw result.error;
        profiles.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 500) break;
      }
    };
    await Promise.all([loadChats(), loadProfiles()]);
    const names = new Map(
      profiles.map((person) => [person.id, person.full_name.trim()]),
    );
    const entries: InboxEntry[] = [];
    // Count on the server, without downloading unread message bodies. Bound the
    // parallel requests so a large inbox does not flood the connection pool.
    for (let offset = 0; offset < chats.length; offset += 8) {
      entries.push(
        ...(await Promise.all(
          chats
            .slice(offset, offset + 8)
            .map(async (chat): Promise<InboxEntry> => {
              const latest = chat.messages[0];
              const readAt = chat.conversation_reads[0]?.read_at;
              let unread = 0;
              if (latest) {
                let query = client
                  .from("messages")
                  .select("id", { count: "exact", head: true })
                  .eq("conversation_id", chat.id)
                  .neq("sender_id", account.id);
                if (readAt) query = query.gt("created_at", readAt);
                const result = await query;
                if (result.error) throw result.error;
                unread = result.count ?? 0;
              }
              const team = chat.kind === "move-team";
              const reference = team
                ? shortReference(chat.jobs?.request_id ?? chat.job_id!)
                : "";
              let description =
                chat.kind === "worker-support"
                  ? "Worker support"
                  : "Customer support";
              if (team) {
                const people = await client.rpc("get_conversation_people", {
                  p_conversation_id: chat.id,
                });
                if (people.error) throw people.error;
                description =
                  people.data
                    .filter((p) => p.role !== "admin")
                    .map(
                      (p) =>
                        p.full_name.trim() ||
                        (p.role === "worker" ? "Worker" : "Customer"),
                    )
                    .join(", ") || "Move-team conversation";
              }
              return {
                id: chat.id,
                conversationId: chat.id,
                ownerId: chat.owner_id,
                kind: chat.kind as InboxEntry["kind"],
                name: team
                  ? `Team · move #${reference}`
                  : names.get(chat.owner_id!) ||
                    (chat.kind === "worker-support" ? "Worker" : "Customer"),
                description,
                preview: latest
                  ? `${team ? `${names.get(latest.sender_id) || "Participant"}: ` : ""}${latest.body}`
                  : "No messages yet.",
                updatedAt: latest?.created_at ?? null,
                unread,
                reference,
              };
            }),
        )),
      );
    }
    // Retain the existing ability to start support chats from the inbox.
    const owners = new Set(chats.map((chat) => chat.owner_id));
    for (const person of profiles) {
      if (
        !["customer", "worker"].includes(person.role) ||
        owners.has(person.id)
      )
        continue;
      const worker = person.role === "worker";
      entries.push({
        id: person.id,
        conversationId: null,
        ownerId: person.id,
        kind: worker ? "worker-support" : "customer-support",
        name: person.full_name.trim() || (worker ? "Worker" : "Customer"),
        description: worker ? "Worker support" : "Customer support",
        preview: "Start a conversation",
        updatedAt: null,
        unread: 0,
        reference: "",
      });
    }
    entries.sort(
      (a, b) =>
        (b.updatedAt ? Date.parse(b.updatedAt) : 0) -
          (a.updatedAt ? Date.parse(a.updatedAt) : 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
    return entries;
  } catch (error) {
    unstable_rethrow(error);
    logFailure("messages:admin-inbox", error);
    return null;
  }
}
