import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { AuthCentered } from "../../auth-shell";
import { confirmInvitation } from "@/lib/administration/invitation";
export const metadata: Metadata = {
  title: "Accept worker invitation",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const { token_hash: token } = await searchParams;
  const valid = typeof token === "string" && /^[a-f0-9]{32,128}$/i.test(token);
  return (
    <AuthCentered staff>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-brand">
            Worker invitation
          </p>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">
            Join the crew
          </h1>
        </div>
        {valid ? (
          <>
            <p className="text-muted-foreground">
              Continue to verify your invitation, then choose your own password.
              Never share the invitation link.
            </p>
            <form action={confirmInvitation}>
              <input type="hidden" name="token_hash" value={token} />
              <Button type="submit" className="w-full">
                Continue to password setup
              </Button>
            </form>
          </>
        ) : (
          <p className="text-muted-foreground">
            This invitation is unavailable. Contact your administrator.
          </p>
        )}
      </div>
    </AuthCentered>
  );
}
