import "server-only";
import { cache } from "react";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { isUuid } from "@/lib/ids";
import { isPhotoStage, type PhotoStage } from "./validation";

export type MovePhoto = {
  id: string;
  stage: PhotoStage;
  jobId: string | null;
  createdAt: string;
  mine: boolean;
};

const missing = (code?: string) =>
  ["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "");

// Hide photo controls until the owner applies the Phase 7C migration.
export const photosReady = cache(async () => {
  const client = await serverSupabase();
  const { data, error } = await client.rpc("photo_capabilities");
  if (error && !missing(error.code)) logFailure("photos:capabilities", error);
  return !error && data === 9;
});

/**
 * Photos for one request that the signed-in account may see (RLS decides),
 * optionally limited to request photos plus one job's condition photos.
 * Returns null when loading fails.
 */
export async function loadPhotos(
  requestId: string,
  jobId?: string,
): Promise<MovePhoto[] | null> {
  if (!isUuid(requestId) || (jobId !== undefined && !isUuid(jobId)))
    return null;
  try {
    const client = await serverSupabase();
    const { data: user } = await client.auth.getUser();
    let query = client
      .from("move_photos")
      .select("id,stage,job_id,uploaded_by,created_at")
      .eq("request_id", requestId)
      .order("created_at")
      .order("id");
    if (jobId) query = query.or(`job_id.is.null,job_id.eq.${jobId}`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).flatMap((row) =>
      isPhotoStage(row.stage)
        ? [
            {
              id: row.id,
              stage: row.stage,
              jobId: row.job_id,
              createdAt: row.created_at,
              mine: row.uploaded_by === user.user?.id,
            },
          ]
        : [],
    );
  } catch (error) {
    logFailure("photos:load", error);
    return null;
  }
}
