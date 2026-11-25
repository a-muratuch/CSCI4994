"use client";

import { useActionState } from "react";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { requestDraftKey } from "@/lib/requests/details";

/** `compact` is the small pill used in the workspace sidebar footer. */
export function SignOutButton({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(signOut, {
    ok: false,
    message: "",
  });
  return (
    <form
      action={action}
      className={className}
      // An unsaved move request never outlives the signed-in session.
      onSubmit={() => sessionStorage.removeItem(requestDraftKey)}
    >
      <Button
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={pending}
        // The compact pill keeps a 44px touch target.
        className={compact ? "min-h-11" : "min-h-11 w-full"}
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      <p role="status" className="mt-1 text-sm text-destructive empty:mt-0">
        {state.message}
      </p>
    </form>
  );
}
