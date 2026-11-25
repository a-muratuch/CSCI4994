import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions, supabaseConfig } from "./config";
import type { Database } from "./database.types";

export async function serverSupabase(writable = false) {
  const config = supabaseConfig();
  if (!config) throw new Error("Authentication is not configured.");
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (changes) => {
        // Proxy refreshes render-time sessions; actions/handlers can write cookies.
        if (writable)
          changes.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
      },
    },
  });
}
