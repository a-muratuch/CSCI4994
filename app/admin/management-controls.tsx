"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inviteWorker,
  saveTruck,
  setAccountActive,
} from "@/lib/administration/actions";
import { useHydrated } from "@/lib/use-hydrated";

export function AccessControl({
  id,
  active,
  name,
  onResult,
}: {
  id: string;
  active: boolean;
  name?: string;
  onResult?: (message: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    feedback = useRef<HTMLParagraphElement>(null);
  const heading = useId(),
    hydrated = useHydrated();
  useEffect(() => {
    if (message && !pending && !onResult) feedback.current?.focus();
  }, [message, pending, onResult]);
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  return (
    <div className="space-y-2">
      <Button
        ref={trigger}
        variant="outline"
        className="min-h-11"
        disabled={!hydrated || pending}
        onClick={() => dialog.current?.showModal()}
      >
        {active ? "Deactivate access" : "Restore access"}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby={heading}
        onCancel={(e) => {
          if (pending) e.preventDefault();
          else close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-background p-6 text-foreground backdrop:bg-black/40"
      >
        <h2 id={heading} className="text-lg font-semibold">
          {active ? "Deactivate access?" : "Restore access?"}
        </h2>
        <p className="mt-3 font-medium break-words">{name || "This account"}</p>
        <p className="my-4">
          {active
            ? "Access will stop. Existing records remain. Reassign or close active jobs first."
            : "This account will regain access appropriate to its stored role. Existing records remain unchanged."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            autoFocus
            variant="outline"
            disabled={pending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setAccountActive(id, !active);
                setMessage(r.message);
                onResult?.(r.message);
                dialog.current?.close();
              })
            }
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </dialog>
      {!onResult && (
        <p
          ref={feedback}
          role="status"
          tabIndex={-1}
          className="rounded-sm text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          {message}
        </p>
      )}
    </div>
  );
}
export function WorkerInvitation({ configured }: { configured: boolean }) {
  const [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const hydrated = useHydrated();
  const id = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && !pending) feedback.current?.focus();
  }, [message, pending]);
  if (!configured)
    return (
      <div className="space-y-2">
        <h2 className="text-[17px] font-semibold">
          Worker invitations unavailable
        </h2>
        <p className="text-sm text-muted-foreground">
          Email setup is required before you can invite workers.
        </p>
        <details>
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring">
            Setup details
          </summary>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            The project owner must configure email delivery (SMTP), the
            invitation email template and the invitation redirect in Supabase
            Auth, then enable worker invitations on the server. Invitations
            remain off until setup is complete. Only new worker accounts can be
            invited; existing roles are not changed.
          </p>
        </details>
      </div>
    );
  return (
    <form
      aria-label="Invite worker"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const data = new FormData(f);
        start(async () => {
          const r = await inviteWorker({
            name: data.get("name"),
            email: data.get("email"),
          });
          setMessage(r.message);
          if (r.ok) f.reset();
        });
      }}
    >
      <h2 className="text-[17px] font-semibold">Invite a worker</h2>
      <p className="text-sm text-muted-foreground">
        Only new worker accounts can be invited. Existing account roles are
        never changed.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id + "name"}>Worker name</Label>
          <Input
            id={id + "name"}
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            disabled={!configured || pending || !hydrated}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id + "email"}>Worker email</Label>
          <Input
            id={id + "email"}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            disabled={!configured || pending || !hydrated}
          />
        </div>
      </div>
      <Button
        type="submit"
        disabled={!configured || pending || !hydrated}
        aria-describedby={configured ? undefined : id + "smtp"}
      >
        {pending ? "Sending…" : "Send worker invitation"}
      </Button>
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className="text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {message}
      </p>
    </form>
  );
}
export function TruckEditor({
  truck,
}: {
  truck?: { id: string; name: string; active: boolean };
}) {
  const [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const hydrated = useHydrated(),
    id = useId();
  const feedback = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message && !pending) feedback.current?.focus();
  }, [message, pending]);
  return (
    <form
      aria-label={truck ? `Edit ${truck.name}` : "Add truck"}
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = e.currentTarget,
          data = new FormData(f);
        start(async () => {
          const r = await saveTruck(
            truck?.id ?? null,
            String(data.get("name") ?? ""),
            data.get("active") === "on",
          );
          setMessage(r.message);
          if (r.ok && !truck) f.reset();
        });
      }}
    >
      <Label htmlFor={id + "name"}>
        {truck ? "Truck name" : "New truck name"}
      </Label>
      <Input
        id={id + "name"}
        name="name"
        defaultValue={truck?.name ?? ""}
        required
        maxLength={100}
        disabled={pending || !hydrated}
      />
      <label
        className="flex min-h-11 items-center gap-3"
        htmlFor={id + "active"}
      >
        <input
          id={id + "active"}
          name="active"
          type="checkbox"
          defaultChecked={truck?.active ?? true}
          disabled={pending || !hydrated}
          className="size-4 accent-primary"
        />
        Active for scheduling
      </label>
      <p className="text-sm text-muted-foreground">
        Deactivation keeps history. Reassign or close active jobs first.
      </p>
      <Button
        type="submit"
        className="min-h-11"
        variant={truck ? "outline" : "default"}
        disabled={pending || !hydrated}
      >
        {pending ? "Saving…" : truck ? "Save truck" : "Add truck"}
      </Button>
      <p
        ref={feedback}
        role="status"
        tabIndex={-1}
        className="text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {message}
      </p>
    </form>
  );
}
