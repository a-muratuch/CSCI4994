import type { MetadataRoute } from "next";

// Public pages may be indexed. Signed-in workspaces, auth callbacks, API routes
// and the internal design-system reference stay out of search results.
// Role access is still enforced by the proxy, page checks and RLS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/customer",
        "/worker",
        "/api/",
        "/auth/",
        "/reset-password",
        "/design-system",
      ],
    },
  };
}
