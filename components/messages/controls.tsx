"use client";
import { RotateCw } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { openChat, sendChat } from "@/lib/messages/actions";

export function OpenChat({
  kind,
  target,
  children,
  className,
}: {
  kind: string;
  target: string;
  children: React.ReactNode;
  /** Extra button classes, e.g. the light style on a dark panel. */
  className?: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <Button
        className={cn(
          "h-auto min-h-11 max-w-full whitespace-normal [overflow-wrap:anywhere]",
          className,
        )}
        disabled={!hydrated || pending}
        onClick={() =>
          start(async () => {
            const result = await openChat(kind, target);
            if (result.id && result.role)
              router.push(`/${result.role}/messages/${result.id}`);
            else setError(result.error || "Conversation unavailable.");
          })
        }
      >
        {pending ? "Opening…" : children}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function RefreshMessages({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      className={compact ? "size-11 shrink-0 rounded-full" : "min-h-11"}
      aria-label={pending ? "Refreshing messages" : "Refresh messages"}
      title="Refresh messages"
      disabled={!hydrated || pending}
      onClick={() => start(() => router.refresh())}
    >
      {compact ? (
        <RotateCw
          aria-hidden="true"
          className={`size-4 ${pending ? "motion-safe:animate-spin" : ""}`}
        />
      ) : pending ? (
        "Refreshing…"
      ) : (
        "Refresh messages"
      )}
    </Button>
  );
}
export function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const request = useRef<{ body: string; id: string } | null>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!pending && restoreFocus.current) {
      restoreFocus.current = false;
      composer.current?.focus();
    }
  }, [pending]);
  return (
    <form
      className="min-w-0 border-t p-4 sm:px-6 sm:py-5"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || Array.from(trimmed).length > 2000) {
          setFailed(true);
          setFeedback("Enter a message of 1–2000 characters.");
          resultRef.current?.focus();
          return;
        }
        if (!request.current || request.current.body !== trimmed)
          request.current = { body: trimmed, id: crypto.randomUUID() };
        const current = request.current;
        start(async () => {
          const result = await sendChat({
            conversationId,
            body: current.body,
            requestId: current.id,
          });
          setFailed(!result.ok);
          setFeedback(result.message);
          if (result.ok) {
            restoreFocus.current = true;
            setBody("");
            request.current = null;
            router.refresh();
          }
          if (!result.ok)
            requestAnimationFrame(() => resultRef.current?.focus());
        });
      }}
    >
      <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 flex-1">
          <Label htmlFor="message-body" className="mb-1.5 block">
            Message
          </Label>
          <textarea
            ref={composer}
            id="message-body"
            value={body}
            disabled={!hydrated || pending}
            onChange={(event) => setBody(event.target.value)}
            rows={2}
            placeholder="Write a reply"
            aria-describedby="message-hint message-result"
            aria-invalid={failed || undefined}
            className="block min-h-[88px] w-full min-w-0 resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-destructive"
          />
        </div>
        <Button
          disabled={!hydrated || pending}
          className="h-12 w-full shrink-0 px-5 sm:w-auto"
          type="submit"
        >
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
      <p
        id="message-hint"
        className="mt-3 text-xs leading-5 text-muted-foreground"
      >
        Up to 2,000 characters.
        <span className="sr-only">
          {" "}
          Text only. Messages do not change appointments or estimates.
        </span>
      </p>
      <p
        ref={resultRef}
        tabIndex={-1}
        id="message-result"
        role="status"
        className={`mt-2 rounded-lg text-sm outline-none empty:hidden focus-visible:ring-3 focus-visible:ring-ring [overflow-wrap:anywhere] ${failed ? "text-destructive" : "text-muted-foreground"}`}
      >
        {feedback}
      </p>
    </form>
  );
}
