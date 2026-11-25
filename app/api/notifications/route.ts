import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { loadNotifications } from "@/lib/notifications/data";
import { notificationPage } from "@/lib/notifications/model";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  try {
    const client = await serverSupabase();
    const { account } = await readAccount(client);
    if (!account)
      return Response.json({ state: "error" }, { status: 401, headers });
    const params = new URL(request.url).searchParams;
    const result = await loadNotifications(
      client,
      params.get("unread") === "true",
      notificationPage(params.get("page")),
    );
    return Response.json(
      { ...result, role: account.role },
      { status: result.state === "error" ? 503 : 200, headers },
    );
  } catch {
    return Response.json({ state: "error" }, { status: 503, headers });
  }
}
