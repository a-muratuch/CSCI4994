"use server";
import { isUuid } from "@/lib/ids";
import { loadPhotos, photosReady } from "./data";

/**
 * Photos for one request, read with the signed-in user's session (RLS decides
 * access). Used by the "Request saved" screen, which has no page data to refresh.
 */
export async function requestPhotos(requestId: unknown) {
  if (!isUuid(requestId) || !(await photosReady())) return null;
  return loadPhotos(requestId);
}
