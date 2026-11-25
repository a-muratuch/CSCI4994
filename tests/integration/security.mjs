// Runs only against the local stack. Leaves clearly fictional concurrency fixtures.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const status = spawnSync("npx", ["supabase", "status", "--output", "json"], {
  encoding: "utf8",
});
assert.equal(status.status, 0, "Local stack required");
const config = JSON.parse(status.stdout),
  url = config.API_URL;
assert.ok(
  url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "Local URL required",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, config.SERVICE_ROLE_KEY, options);
const email = "concurrency-" + randomUUID() + "@example.invalid",
  password = "Local-Concurrency-Test-2026!";
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Local concurrency fixture" },
});
assert.equal(created.error, null, "Local fixture creation failed");
const client = createClient(
  url,
  config.PUBLISHABLE_KEY ?? config.ANON_KEY,
  options,
);
assert.equal(
  (await client.auth.signInWithPassword({ email, password })).error,
  null,
);
const date = new Date(Date.now() + 10000 * 86400000).toISOString().slice(0, 10);
const input = {
  pickup: "10 Test Lane",
  destination: "20 Test Road",
  requestedDate: date,
  property: "House",
  size: "Studio",
  items: "Fictional boxes",
  access: "Ground floor",
  notes: "Local concurrency fixture",
  pickupAddress: {
    street: "10 Test Lane",
    city: "Oxford",
    state: "MS",
    zip: "38655",
  },
  destinationAddress: {
    street: "20 Test Road",
    city: "Tupelo",
    state: "MS",
    zip: "38801",
  },
};
const submit = (key) =>
  client.rpc("change_request", {
    p_id: null,
    p_revision: 0,
    p_input: { ...input, _requestId: key },
    p_cancel: false,
  });
const key = randomUUID();
const retries = await Promise.all(Array.from({ length: 6 }, () => submit(key)));
assert.ok(
  retries.every((r) => !r.error),
  "Concurrent retry failed",
);
assert.equal(
  new Set(retries.map((r) => r.data.id)).size,
  1,
  "Concurrent retries duplicated a request",
);
const requests = await Promise.all(
  Array.from({ length: 6 }, () => submit(randomUUID())),
);
assert.equal(
  requests.filter((r) => !r.error).length,
  4,
  "Request quota was not atomic",
);
assert.equal(requests.filter((r) => r.error?.hint === "rate_limit").length, 2);
const conversation = await client.rpc("open_conversation", {
  p_kind: "customer-support",
  p_target_id: created.data.user.id,
});
assert.equal(conversation.error, null);
const messageIds = Array.from({ length: 31 }, () => randomUUID());
const send = (id) =>
  client.rpc("send_message", {
    p_conversation_id: conversation.data.id,
    p_body: "Fictional concurrent message",
    p_request_id: id,
  });
const messages = await Promise.all(messageIds.map(send));
assert.equal(
  messages.filter((r) => !r.error).length,
  30,
  "Message quota was not atomic",
);
assert.equal(messages.filter((r) => r.error?.hint === "rate_limit").length, 1);
const succeeded = messages.findIndex((r) => !r.error);
assert.equal(
  (await send(messageIds[succeeded])).error,
  null,
  "Message retry failed at quota",
);
await client.auth.signOut({ scope: "local" });
console.log(
  "PASS: concurrent request retries, request quota, message quota and retry at quota. Local fictional fixtures retained.",
);
