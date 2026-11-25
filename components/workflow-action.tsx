"use client";
import { useHydrated } from "@/lib/use-hydrated";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { workflowAction } from "@/lib/workflow/actions";
export function WorkflowAction({
  kind,
  id,
  revision,
  available = true,
}: {
  available?: boolean;
  kind: "cancel-job" | "cancel-request" | "revise-estimate";
  id: string;
  revision: number;
}) {
  const label =
    kind === "revise-estimate"
      ? "Create revised estimate"
      : kind === "cancel-job"
        ? "Cancel scheduled job"
        : "Cancel request";
  const hydrated = useHydrated();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  const router = useRouter();
  const titleId = useId();
  const focusResult = useRef(false);
  useEffect(() => {
    if (!pending && focusResult.current) {
      focusResult.current = false;
      feedback.current?.focus();
    }
  }, [pending, message]);
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  if (!available && !message) return null;
  return (
    <div className="space-y-3">
      {available && (
        <Button
          ref={trigger}
          variant="outline"
          className="min-h-11"
          disabled={!hydrated || pending}
          onClick={() => dialog.current?.showModal()}
        >
          {label}
        </Button>
      )}
      <dialog
        aria-labelledby={titleId}
        ref={dialog}
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-background p-6 text-foreground backdrop:bg-black/40"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {label}?
        </h2>
        <p className="my-4">
          {kind === "revise-estimate"
            ? "The old estimate remains in history. The new version starts as a draft."
            : kind === "cancel-job"
              ? "This releases the assigned workers and truck and makes the team conversation read-only."
              : "This request can no longer be estimated or scheduled."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            autoFocus
            disabled={!hydrated || pending}
            variant="outline"
            className="min-h-11"
            onClick={close}
          >
            Keep current record
          </Button>
          <Button
            disabled={!hydrated || pending}
            className="min-h-11"
            onClick={() =>
              start(async () => {
                const result = await workflowAction(kind, id, revision);
                focusResult.current = true;
                setMessage(result.message);
                dialog.current?.close();
                if (result.ok && kind === "revise-estimate" && result.id)
                  router.push(`/admin/estimates/${result.id}/edit`);
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </dialog>
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className="rounded-sm text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {message}
      </p>
    </div>
  );
}
