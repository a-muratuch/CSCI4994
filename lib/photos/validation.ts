// Phase 7C photo rules shared by the upload route and the photo panel.
// The database repeats every limit; these checks give early, clear messages.

export const photoStages = ["request", "pickup", "delivery"] as const;
export type PhotoStage = (typeof photoStages)[number];
export const photoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof photoTypes)[number];

export const maxPhotoBytes = 5 * 1024 * 1024;

export const stageLabels: Record<PhotoStage, string> = {
  request: "Customer photos",
  pickup: "Pickup condition",
  delivery: "Delivery condition",
};

export function isPhotoStage(value: unknown): value is PhotoStage {
  return photoStages.includes(value as PhotoStage);
}

/**
 * Detect the real image type from the file's first bytes, ignoring the
 * file name and the browser-reported type, which a client can fake.
 */
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  const starts = (values: number[], offset = 0) =>
    bytes.length >= offset + values.length &&
    values.every((value, index) => bytes[offset + index] === value);
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  // "RIFF" .... "WEBP"
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  return null;
}

/** Returns a user-facing problem with the file, or null when it is acceptable. */
export function photoProblem(size: number, type: PhotoType | null) {
  if (size <= 0) return "Choose a photo to upload.";
  if (size > maxPhotoBytes) return "Photos must be 5 MB or smaller.";
  if (!type) return "Use a JPEG, PNG or WebP photo.";
  return null;
}

/** Cross-site form posts carry another origin; refuse them before any work. */
export function sameOrigin(origin: string | null, requestUrl: string) {
  return origin !== null && origin === new URL(requestUrl).origin;
}
