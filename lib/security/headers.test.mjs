import test from "node:test";
import assert from "node:assert/strict";
import { securityHeaders } from "./headers.ts";
test("production headers prohibit framing, restrict browser capabilities and omit eval", () => {
  const h = Object.fromEntries(
    securityHeaders(true).map((x) => [x.key, x.value]),
  );
  assert.match(h["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.doesNotMatch(h["Content-Security-Policy"], /unsafe-eval|https:\/\/\*/);
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["Strict-Transport-Security"], "max-age=31536000");
  assert.match(h["Permissions-Policy"], /geolocation=\(\)/);
});
test("development supports Next debugging without enabling HSTS", () => {
  const h = Object.fromEntries(
    securityHeaders(false).map((x) => [x.key, x.value]),
  );
  assert.match(h["Content-Security-Policy"], /unsafe-eval/);
  assert.equal(h["Strict-Transport-Security"], undefined);
});
