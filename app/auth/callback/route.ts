import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { roleHome } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  let destination = "/auth/error?reason=confirmation";
  try {
    if (code) {
      const client = await serverSupabase(true);
      const { data, error } = await client.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error) {
        const { account } = await readAccount(client);
        destination = account
          ? "redirectType" in data && data.redirectType === "recovery"
            ? "/reset-password"
            : roleHome(account.role)
          : "/auth/error?reason=profile";
      }
    }
  } catch {
    destination = "/auth/error?reason=unavailable";
  }
  // Ignore caller-supplied next URLs; only trusted role destinations are used.
  const response = NextResponse.redirect(
    new URL(destination, request.url),
    303,
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
