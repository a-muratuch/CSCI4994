import { ArrowLeft, ChevronDown } from "lucide-react";
import { inboxTime } from "@/lib/messages/inbox";
import { QuickFilters } from "@/components/quick-filters";
import { AdminInbox } from "./admin-inbox";
import { NotificationReceipt } from "@/components/notifications/receipt";
import { ReadMarker } from "./read-marker";
import { shortReference } from "@/lib/reference";
import { formatMessageTime } from "@/lib/format";
import { LiveUpdates } from "./live-updates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/account";
import { type Role, isRole, roleLabel } from "@/lib/auth/roles";
import { serverSupabase } from "@/lib/supabase/server";
import { uuid } from "@/lib/estimates/validation";
import { Panel, PageHeading, ActionLink } from "@/app/customer/customer-ui";
import { OpenChat, MessageComposer, RefreshMessages } from "./controls";

function personName(
  person: { person_id: string; full_name: string; role: string } | undefined,
) {
  if (!person) return "Participant";
  const label = isRole(person.role) ? roleLabel(person.role) : "Participant";
  return person.full_name.trim() || label;
}
const linkFocus =
  "min-h-11 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring";
export async function MessagesPage({
  role,
  id,
  group,
}: {
  role: Role;
  id?: string;
  group?: string;
}) {
  if (role === "admin" && !id)
    return <AdminInbox key={group ?? "all"} group={group} />;
  const account = await requireRole(role);
  const base = `/${role}/messages`;
  const unavailable = (
    <Panel>
      <h1 className="text-2xl font-semibold">Conversation unavailable</h1>
      <p role="alert">
        Messages could not be loaded or you do not have access. Try refreshing.
      </p>
      <ActionLink href={base} outline>
        Back to messages
      </ActionLink>
    </Panel>
  );
  if (id && !uuid(id)) notFound();
  const client = await serverSupabase();
  const kind = role === "worker" ? "worker-support" : "customer-support";
  if (!id && role !== "admin") {
    const conversationPage = (offset: number) =>
      client
        .from("conversations")
        .select("id,kind,job_id,created_at,conversation_reads(read_at)")
        .eq("conversation_reads.user_id", account.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
    const data: NonNullable<
      Awaited<ReturnType<typeof conversationPage>>["data"]
    > = [];
    for (let offset = 0; ; offset += 500) {
      const result = await conversationPage(offset);
      if (result.error) return unavailable;
      data.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 500) break;
    }
    const unread = new Map<string, number>();
    // Count incoming messages after this viewer's saved read cutoff. Read only
    // counts, not message bodies, and bound concurrent requests to eight chats.
    for (let offset = 0; offset < data.length; offset += 8) {
      const counts = await Promise.all(
        data.slice(offset, offset + 8).map(async (chat) => {
          let query = client
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", chat.id)
            .neq("sender_id", account.id);
          const readAt = chat.conversation_reads[0]?.read_at;
          if (readAt) query = query.gt("created_at", readAt);
          const result = await query;
          return { id: chat.id, count: result.count ?? 0, error: result.error };
        }),
      );
      if (counts.some((result) => result.error)) return unavailable;
      for (const result of counts) unread.set(result.id, result.count);
    }
    const unreadOnly = group === "unread";
    const visible = data.filter(
      (chat) => !unreadOnly || (unread.get(chat.id) ?? 0) > 0,
    );
    const support = data.find((c) => c.kind === kind);
    const showSupport =
      !unreadOnly || !!(support && (unread.get(support.id) ?? 0) > 0);
    const teams = visible.filter((c) => c.kind === "move-team");
    const unreadTotal = [...unread.values()].reduce(
      (sum, count) => sum + count,
      0,
    );
    const rowClass = `${linkFocus} flex items-center gap-3 rounded-[14px] p-3 hover:bg-muted`;
    const unreadBadge = (chatId: string) =>
      (unread.get(chatId) ?? 0) > 0 ? (
        <span
          id={`unread-${chatId}`}
          className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-foreground tabular-nums"
        >
          {unread.get(chatId)}
          <span className="sr-only"> unread messages</span>
        </span>
      ) : null;
    return (
      <>
        <PageHeading
          title="Messages"
          description={
            role === "customer"
              ? "Talk with company support anytime, and with your move team once a move is scheduled."
              : "Talk with company support, and with each move team you are assigned to."
          }
        />
        <QuickFilters
          label="Message filters"
          className="mb-5"
          filters={[
            { label: "All", href: base, selected: !unreadOnly },
            {
              label: "Unread",
              href: `${base}?group=unread`,
              count: unreadTotal,
              selected: unreadOnly,
            },
          ]}
        />
        {unreadOnly && !visible.length ? (
          <Panel className="max-w-2xl items-center py-10 text-center">
            <h2 className="font-semibold">You’re all caught up</h2>
            <p className="text-sm text-muted-foreground">
              No unread messages in your conversations.
            </p>
            <ActionLink href={base} outline>
              Show all conversations
            </ActionLink>
          </Panel>
        ) : (
          <Panel className="max-w-2xl gap-1 p-2 sm:p-3">
            <ul className="flex flex-col">
              {showSupport && (
                <li>
                  {support ? (
                    <Link
                      href={`${base}/${support.id}`}
                      aria-label="Open company support"
                      aria-describedby={
                        (unread.get(support.id) ?? 0) > 0
                          ? `unread-${support.id}`
                          : undefined
                      }
                      className={`${rowClass} ${(unread.get(support.id) ?? 0) > 0 ? "bg-muted/60" : ""}`}
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold"
                      >
                        RM
                      </span>
                      <span className="min-w-0 text-[13px]">
                        <span className="block text-[15px] font-semibold">
                          Company support
                        </span>
                        <span className="text-muted-foreground">
                          Rebel Move administrators · always open
                        </span>
                      </span>
                      {unreadBadge(support.id)}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <span className="min-w-0 text-[13px]">
                        <span className="block text-[15px] font-semibold">
                          Company support
                        </span>
                        <span className="text-muted-foreground">
                          Contact the administrators before, during or after a
                          move.
                        </span>
                      </span>
                      <OpenChat kind={kind} target={account.id}>
                        Start conversation
                      </OpenChat>
                    </div>
                  )}
                </li>
              )}
              {teams.map((c) => (
                <li key={c.id} className="border-t first:border-t-0">
                  <Link
                    href={`${base}/${c.id}`}
                    aria-label={`Open team conversation for job ${shortReference(c.job_id!)}`}
                    aria-describedby={
                      (unread.get(c.id) ?? 0) > 0 ? `unread-${c.id}` : undefined
                    }
                    className={`${rowClass} ${(unread.get(c.id) ?? 0) > 0 ? "bg-muted/60" : ""}`}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    >
                      #
                    </span>
                    <span className="min-w-0 text-[13px]">
                      <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">
                        Team · job {shortReference(c.job_id!)}
                      </span>
                      <span className="text-muted-foreground">
                        Move-team conversation
                      </span>
                    </span>
                    {unreadBadge(c.id)}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </>
    );
  }
  const conversationResult = id
    ? await client.from("conversations").select("*").eq("id", id).maybeSingle()
    : null;
  if (conversationResult?.error) return unavailable;
  if (id && !conversationResult?.data) notFound();
  const conversation = conversationResult?.data;
  const team = conversation?.kind === "move-team";
  if (!conversation) notFound();
  const [messages, people, job] = await Promise.all([
    client
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
    client.rpc("get_conversation_people", {
      p_conversation_id: conversation.id,
    }),
    team
      ? client
          .from("jobs")
          .select("id,status,request_id")
          .eq("id", conversation.job_id!)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (messages.error || people.error || job.error || (team && !job.data))
    return unavailable;
  const closed =
    team && ["completed", "cancelled"].includes(job.data?.status ?? "");
  const owner = people.data?.find(
    (person) => person.person_id === conversation.owner_id,
  );
  const moveId = job.data?.request_id;
  const title = team
    ? `Move team · #${shortReference(moveId ?? conversation.job_id!)}`
    : role === "admin"
      ? personName(owner)
      : "Company support";
  const subtitle = team
    ? "Customer, assigned workers and all administrators"
    : role === "admin"
      ? `${conversation.kind === "worker-support" ? "Worker" : "Customer"} support · all administrators`
      : "Rebel Move administrators · company support";
  const jobHref = team
    ? role === "customer"
      ? `/customer/moves/${moveId}`
      : `/${role}/jobs/${conversation.job_id}`
    : null;
  const now = new Date().toISOString();
  return (
    <>
      <Link
        href={base}
        aria-label="Back to messages"
        className={`${linkFocus} mb-4 inline-flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground hover:text-foreground`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Messages
      </Link>
      <PageHeading
        title={team ? "Move-team conversation" : title}
        eyebrow="Conversation"
      />
      <section
        aria-label="Conversation"
        className="min-w-0 rounded-2xl border bg-card"
      >
        <NotificationReceipt />
        <ReadMarker id={conversation.id} messageId={messages.data?.[0]?.id} />
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold ${team ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            >
              {team
                ? "#"
                : role === "admin"
                  ? title
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "RM"}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold [overflow-wrap:anywhere]">
                {title}
              </h2>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                {subtitle}
              </p>
            </div>
          </div>
          {jobHref && (
            <ActionLink href={jobHref} outline>
              {role === "customer" ? "Move details" : "Job details"}
            </ActionLink>
          )}
        </header>
        <ol
          aria-label="Message history"
          className="space-y-5 p-4 sm:space-y-6 sm:p-6"
        >
          {messages.data?.length === 0 && (
            <li className="rounded-lg bg-muted p-4 text-sm">
              No messages yet.
            </li>
          )}
          {messages.data?.length === 100 && (
            <li className="text-sm text-muted-foreground">
              Showing the latest 100 messages.
            </li>
          )}
          {[...(messages.data ?? [])].reverse().map((message) => {
            const person = people.data?.find(
              (item) => item.person_id === message.sender_id,
            );
            const own = message.sender_id === account.id;
            const name = person?.full_name.trim();
            const senderRole = own
              ? roleLabel(account.role)
              : person && isRole(person.role)
                ? roleLabel(person.role)
                : null;
            return (
              <li
                key={message.id}
                className={`flex min-w-0 ${own ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex min-w-0 max-w-[85%] flex-col gap-1.5 sm:max-w-[75%] ${own ? "items-end" : "items-start"}`}
                >
                  <p
                    className={`max-w-full text-sm font-semibold leading-5 [overflow-wrap:anywhere] ${own ? "text-right" : "text-left"}`}
                  >
                    {name
                      ? `${name}${own ? " (you)" : ""}`
                      : own
                        ? "You"
                        : personName(person)}
                    {senderRole && (name || own) && (
                      <span className="font-normal text-muted-foreground">
                        {" · "}
                        {senderRole}
                      </span>
                    )}
                  </p>
                  <p
                    className={`max-w-full rounded-[18px] px-4 py-3 text-[15px] leading-6 whitespace-pre-wrap [overflow-wrap:anywhere] ${own ? "rounded-br-[4px] bg-primary text-primary-foreground" : "rounded-bl-[4px] bg-muted text-foreground"}`}
                  >
                    {message.body}
                  </p>
                  <time
                    dateTime={message.created_at}
                    title={formatMessageTime(message.created_at)}
                    aria-label={formatMessageTime(message.created_at)}
                    className={`max-w-full text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere] ${own ? "text-right" : "text-left"}`}
                  >
                    {inboxTime(message.created_at, now)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
        {closed ? (
          <div className="space-y-3 border-t p-4 sm:px-6 sm:py-5">
            <p className="font-medium">
              This conversation is closed because the move is completed or
              cancelled.
            </p>
            <ActionLink href={base} outline>
              Open company support
            </ActionLink>
          </div>
        ) : (
          <MessageComposer
            key={`composer:${conversation.id}`}
            conversationId={conversation.id}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-4 py-1 sm:px-6">
          <details className="min-w-0 open:basis-full">
            <summary
              className={`${linkFocus} inline-flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden`}
            >
              Participants and earlier senders
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </summary>
            <p className="mb-2 text-xs leading-5 text-muted-foreground">
              {team
                ? "Visible to the customer, currently assigned workers and all administrators."
                : "Private to the account owner and all administrators."}
            </p>
            <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs leading-5">
              {people.data?.map((person) => (
                <li key={person.person_id}>
                  {personName(person)}
                  {person.full_name.trim() && isRole(person.role) && (
                    <> · {roleLabel(person.role)}</>
                  )}
                </li>
              ))}
            </ul>
          </details>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            {!closed && (
              <LiveUpdates
                key={`live:${conversation.id}`}
                conversationId={conversation.id}
                quiet
              />
            )}
            <RefreshMessages compact />
          </div>
        </div>
      </section>
    </>
  );
}
