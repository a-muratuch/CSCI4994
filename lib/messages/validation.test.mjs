import test from "node:test";
import assert from "node:assert/strict";
import { messageInput } from "./validation.ts";
const id = "00000000-0000-0000-0000-000000000001";
test("message trims text, preserves plain markup and strips forged identity", () => {
  assert.deepEqual(
    messageInput({
      conversationId: id,
      requestId: id,
      body: "  <b>Hello</b>  ",
      senderId: "other",
      createdAt: "tomorrow",
    }),
    { conversationId: id, requestId: id, body: "<b>Hello</b>" },
  );
});
test("message rejects missing values, malformed IDs, blank and oversized text", () => {
  for (const value of [
    null,
    {},
    { conversationId: "wrong", requestId: id, body: "Hi" },
    { conversationId: id, requestId: "wrong", body: "Hi" },
    { conversationId: id, requestId: id, body: "\n\t " },
    { conversationId: id, requestId: id, body: "x".repeat(2001) },
  ])
    assert.equal(messageInput(value), null);
});
test("message supports exact Unicode character limit", () => {
  assert.ok(
    messageInput({
      conversationId: id,
      requestId: id,
      body: "😀".repeat(2000),
    }),
  );
  assert.equal(
    messageInput({
      conversationId: id,
      requestId: id,
      body: "😀".repeat(2001),
    }),
    null,
  );
});
