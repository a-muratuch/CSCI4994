import { serverSupabase } from "@/lib/supabase/server";
import { readAccount } from "@/lib/auth/account";
import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import {
  detectPhotoType,
  isPhotoStage,
  maxPhotoBytes,
  photoProblem,
  sameOrigin,
} from "@/lib/photos/validation";

const headers = { "Cache-Control": "private, no-store" };
const reply = (status: number, message: string, id?: string) =>
  Response.json({ message, id }, { status, headers });

/**
 * Upload one photo. The database reserves the photo after checking role,
 * ownership or assignment, the open stage and limits; then the file is stored
 * with the user's own session, so Storage policies check the same row.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), request.url))
    return reply(403, "Upload refused.");
  // Reject oversized bodies before reading them (form overhead allowed).
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxPhotoBytes + 64 * 1024)
    return reply(413, "Photos must be 5 MB or smaller.");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(400, "Choose a photo to upload.");
  }
  const file = form.get("photo");
  const requestId = form.get("requestId");
  const jobId = form.get("jobId") || null;
  const stage = form.get("stage");
  if (
    !(file instanceof File) ||
    !isUuid(requestId) ||
    (jobId !== null && !isUuid(jobId)) ||
    !isPhotoStage(stage)
  )
    return reply(400, "Choose a photo to upload.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectPhotoType(bytes);
  const problem = photoProblem(bytes.length, type);
  if (problem || !type) return reply(400, problem ?? "Unsupported photo.");

  try {
    const client = await serverSupabase(true);
    const { account } = await readAccount(client);
    if (!account) return reply(401, "Sign in to add photos.");
    const reserved = await client.rpc("add_move_photo", {
      p_request_id: requestId,
      p_job_id: jobId as string,
      p_stage: stage,
      p_content_type: type,
      p_size_bytes: bytes.length,
    });
    if (reserved.error) {
      const { code, hint, message } = reserved.error;
      if (hint === "rate_limit")
        return reply(429, "Too many photos. Wait a few minutes and try again.");
      if (code === "22023") return reply(400, message);
      if (code === "42501") return reply(403, "You cannot add photos here.");
      throw reserved.error;
    }
    const id = reserved.data;
    const stored = await client.storage
      .from("move-photos")
      .upload(id, bytes, { contentType: type, upsert: false });
    if (stored.error) {
      // Undo the reservation so a failed upload does not count or show.
      await client.rpc("delete_move_photo", { p_id: id });
      throw stored.error;
    }
    return reply(201, "Photo added.", id);
  } catch (error) {
    logFailure("photos:upload", error);
    return reply(503, "The photo could not be saved. Try again.");
  }
}
