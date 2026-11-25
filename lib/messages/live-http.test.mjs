import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.AUTH_TEST_URL ?? "http://localhost:3000";
const id = "00000000-0000-0000-0000-000000000001";
test("signed-out event streams return 401 without event data or cacheable responses", async () => {
  const r = await fetch(`${base}/api/messages/${id}/events`);
  assert.equal(r.status, 401);
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.doesNotMatch(r.headers.get("content-type") ?? "", /event-stream/);
});
test("malformed event IDs fail before subscribing", async () => {
  const r = await fetch(`${base}/api/messages/not-an-id/events`);
  assert.equal(r.status, 404);
});
test("cross-origin event requests are rejected", async () => {
  const r = await fetch(`${base}/api/messages/${id}/events`, {
    headers: { origin: "https://example.invalid" },
  });
  assert.equal(r.status, 403);
});
