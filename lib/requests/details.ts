// Small helpers that keep the request form short while the database keeps
// its existing text columns (move_size, access_details).

export const moveSizes = [
  "Studio",
  "1 bedroom",
  "2 bedrooms",
  "3 bedrooms",
  "4+ bedrooms",
  "Office",
  "Other",
] as const;

/** sessionStorage key for an unsaved new request in this browser tab. */
export const requestDraftKey = "rebel-move:request-draft";

const accessPattern = /^Pickup: ([\s\S]*?)\nDestination: ([\s\S]*)$/;

/** Two short answers saved as two labelled lines in one column. */
export function composeAccess(pickup: string, destination: string) {
  const p = pickup.trim(),
    d = destination.trim();
  return p || d ? `Pickup: ${p}\nDestination: ${d}` : "";
}

/** Reverse of composeAccess; older free text goes into the pickup answer. */
export function splitAccess(access: string) {
  const match = accessPattern.exec(access);
  return match
    ? { pickup: match[1], destination: match[2] }
    : { pickup: access, destination: "" };
}
