// Requires a running local app configured with .env.local; never uses real credentials.
import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.AUTH_TEST_URL ?? "http://localhost:3000";
const paths = [
  ["/customer/notifications", "/login"],
  ["/worker/notifications", "/worker/login"],
  ["/admin/notifications", "/admin/login"],
  ["/customer/messages", "/login"],
  ["/customer/messages/arbitrary-id", "/login"],
  ["/worker/messages", "/worker/login"],
  ["/worker/messages/arbitrary-id", "/worker/login"],
  ["/admin/messages", "/admin/login"],
  ["/admin/messages/arbitrary-id", "/admin/login"],
  ["/customer", "/login"],
  ["/customer/moves/arbitrary-id", "/login"],
  ["/worker", "/worker/login"],
  ["/worker/jobs/arbitrary-id", "/worker/login"],
  ["/admin", "/admin/login"],
  ["/admin/analytics", "/admin/login"],
  ["/admin/jobs/calendar", "/admin/login"],
  ["/admin/jobs/arbitrary-id", "/admin/login"],
  ["/admin/customers", "/admin/login"],
  ["/admin/customers/arbitrary-id", "/admin/login"],
  ["/admin/workers", "/admin/login"],
  ["/admin/workers/arbitrary-id", "/admin/login"],
  ["/admin/trucks", "/admin/login"],
  ["/admin/trucks/arbitrary-id", "/admin/login"],
];

test("signed-out workspace and detail requests redirect to the matching login", async () => {
  for (const [path, expected] of paths) {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      expected,
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});

test("query parameters cannot select privileged access", async () => {
  const response = await fetch(`${base}/admin?role=admin&user_metadata=admin`, {
    redirect: "manual",
  });
  assert.equal(
    new URL(response.headers.get("location"), base).pathname,
    "/admin/login",
  );
});

test("forged session cookies and role metadata fail closed", async () => {
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const payload = {
    sub: "00000000-0000-0000-0000-000000000001",
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: "authenticated",
    user_metadata: { role: "admin" },
  };
  const session = {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.invalid-signature`,
    refresh_token: "invalid-test-token",
    token_type: "bearer",
    expires_at: payload.exp,
    user: { id: payload.sub, user_metadata: { role: "admin" } },
  };
  const cookie = `sb-${project}-auth-token=base64-${encode(session)}`;
  for (const path of [
    "/admin/messages",
    "/admin/messages/arbitrary-id",
    "/admin",
    "/admin/customers",
    "/admin/customers/arbitrary-id",
    "/admin/workers",
    "/admin/workers/arbitrary-id",
    "/admin/trucks",
    "/admin/trucks/arbitrary-id",
  ]) {
    const response = await fetch(`${base}${path}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(response.status, 307);
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      "/admin/login",
    );
  }
});

test("confirmation callback ignores external redirect input", async () => {
  const response = await fetch(
    `${base}/auth/callback?next=https://example.invalid`,
    { redirect: "manual" },
  );
  const target = new URL(response.headers.get("location"), base);
  assert.equal(response.status, 303);
  assert.equal(target.origin, new URL(base).origin);
  assert.equal(target.pathname, "/auth/error");
  assert.equal(target.searchParams.get("reason"), "confirmation");
});

test("unknown public routes render the branded not-found page", async () => {
  const response = await fetch(`${base}/missing-polish-record`, {
    redirect: "manual",
  });
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Page not found/);
  assert.match(html, /Back to home/);
});

test("signed-out home and Auth error copy match session state", async () => {
  const home = await fetch(`${base}/`).then((response) => response.text());
  assert.match(home, /href="\/login"/);
  assert.match(home, /href="\/register"/);
  assert.doesNotMatch(home, /Go to your dashboard/);
  assert.doesNotMatch(home, /Example date/);
  const error = await fetch(`${base}/auth/error?reason=confirmation`).then(
    (response) => response.text(),
  );
  assert.doesNotMatch(error, />Sign out</);
  assert.match(error, /Account error \| Rebel Move/);
});

test("notification snapshot and stream reject signed-out requests without caching", async () => {
  for (const path of ["/api/notifications", "/api/notifications/events"]) {
    const response = await fetch(base + path, { redirect: "manual" });
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
});
