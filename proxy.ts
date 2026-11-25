import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions, supabaseConfig } from "@/lib/supabase/config";
import { isRole, protectedRole, roleHome, roleLogin } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const required = protectedRole(request.nextUrl.pathname);
  const config = supabaseConfig();
  const moveTo = (path: string) => {
    const target = new URL(path, request.url);
    const redirected = NextResponse.redirect(
      target,
      request.method === "GET" || request.method === "HEAD" ? 307 : 303,
    );
    response.cookies
      .getAll()
      .forEach((cookie) => redirected.cookies.set(cookie));
    for (const header of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(header);
      if (value) redirected.headers.set(header, value);
    }
    return redirected;
  };
  if (!config)
    return required ? moveTo("/auth/error?reason=configuration") : response;
  try {
    const client = createServerClient<Database>(config.url, config.key, {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (changes, headers) => {
          changes.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          const earlierCookies = response.cookies.getAll();
          response = NextResponse.next({ request });
          earlierCookies.forEach((cookie) => response.cookies.set(cookie));
          changes.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.headers.set("Cache-Control", "private, no-store");
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    });
    const { data, error } = await client.auth.getClaims();
    if (!required) return response;
    if (error || !data?.claims) return moveTo(roleLogin(required));
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("*")
      .eq("id", data.claims.sub)
      .single();
    if (
      profileError ||
      !profile ||
      !isRole(profile.role) ||
      profile.active === false
    )
      return moveTo("/auth/error?reason=profile");
    if (profile.role !== required) return moveTo(roleHome(profile.role));
    return response;
  } catch {
    return required ? moveTo("/auth/error?reason=unavailable") : response;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
