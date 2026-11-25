import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import { sameOrigin } from "@/lib/photos/validation";

const noStore = { "Cache-Control": "private, no-store" };
const unavailable = () =>
  new Response("Photo unavailable.", { status: 404, headers: noStore });

/**
 * Stream one photo. Both the row read and the file download use the signed-in
 * user's session, so RLS and Storage policies decide access. Images are never
 * public or cached, and the stored type comes from the checked upload.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return unavailable();
  try {
    const client = await serverSupabase();
    const { data: photo, error } = await client
      .from("move_photos")
      .select("content_type")
      .eq("id", id)
      .maybeSingle();
    // Signed-out visitors have no table access at all: same answer as "not yours".
    if (error?.code === "42501") return unavailable();
    if (error) throw error;
    if (!photo) return unavailable();
    const file = await client.storage.from("move-photos").download(id);
    if (file.error || !file.data) return unavailable();
    return new Response(file.data, {
      headers: {
        ...noStore,
        "Content-Type": photo.content_type,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logFailure("photos:read", error);
    return new Response("Photo unavailable.", {
      status: 503,
      headers: noStore,
    });
  }
}

/** Remove an open-stage photo uploaded by the signed-in account. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!sameOrigin(request.headers.get("origin"), request.url))
    return Response.json(
      { message: "Refused." },
      { status: 403, headers: noStore },
    );
  if (!isUuid(id)) return unavailable();
  try {
    const client = await serverSupabase(true);
    const { data: allowed, error } = await client.rpc("can_delete_move_photo", {
      p_id: id,
    });
    if (error) throw error;
    if (!allowed)
      return Response.json(
        { message: "This photo can no longer be removed." },
        { status: 403, headers: noStore },
      );
    // File first (the Storage policy checks the same row), then the record.
    const removed = await client.storage.from("move-photos").remove([id]);
    if (removed.error) throw removed.error;
    const deleted = await client.rpc("delete_move_photo", { p_id: id });
    if (deleted.error) throw deleted.error;
    return Response.json({ message: "Photo removed." }, { headers: noStore });
  } catch (error) {
    logFailure("photos:delete", error);
    return Response.json(
      { message: "The photo could not be removed. Try again." },
      { status: 503, headers: noStore },
    );
  }
}
