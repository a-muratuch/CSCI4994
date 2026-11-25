import "server-only";
// Database messages may include submitted values. Log only context and stable codes.
export function logFailure(operation: string, error: unknown) {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "unavailable";
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : "";
  // Supabase uses an empty code for fetch failures. Classify known prefixes
  // without logging the message, URL, submitted values or stack.
  const category = message.startsWith("AbortError:")
    ? "request_aborted"
    : message.startsWith("TypeError: fetch failed")
      ? "fetch_failed"
      : "unavailable";
  // Keep the code in the message: the development overlay can display object
  // arguments as {}, hiding the only safe diagnostic we record.
  console.error(`[Rebel Move] ${operation} (code: ${code || category})`);
}
