import test from "node:test";
import assert from "node:assert/strict";
import {
  notificationPage,
  notificationPath,
  notificationHref,
  notificationSnapshot,
} from "./model.ts";
const id = "10000000-0000-4000-8000-000000000001";
const n = {
  id,
  kind: "message",
  created_at: "2026-10-24T12:00:00Z",
  read_at: null,
  target_kind: "conversation",
  target_id: id,
  title: "New message",
  detail: "Company support",
};
test("notification destinations stay in the current role and validate identifiers", () => {
  for (const role of ["customer", "worker", "admin"])
    assert.equal(notificationPath(n, role), `/${role}/messages/${id}`);
  assert.equal(
    notificationHref(n, "customer"),
    `/customer/messages/${id}?notification=${id}`,
  );
  assert.equal(
    notificationPath({ ...n, target_kind: "job" }, "worker"),
    `/worker/jobs/${id}`,
  );
  assert.equal(
    notificationPath({ ...n, target_kind: "move" }, "customer"),
    `/customer/moves/${id}`,
  );
  assert.equal(
    notificationPath({ ...n, target_kind: "estimate" }, "customer"),
    `/customer/estimates/${id}`,
  );
  // Administrators open declined estimates from their notification.
  assert.equal(
    notificationPath({ ...n, target_kind: "estimate" }, "admin"),
    `/admin/estimates/${id}`,
  );
  for (const target of [
    { target_kind: "estimate", target_id: id },
    { target_kind: "move", target_id: id },
    { target_kind: "conversation", target_id: "https://example.invalid" },
    { target_kind: "../../admin", target_id: id },
  ])
    assert.equal(notificationPath(target, "worker"), null);
});
test("notification pagination and payload validation reject malformed or oversized results", () => {
  assert.equal(notificationPage("2"), 2);
  for (const v of [null, ["2"], "-1", "1.5", "1000001", "Infinity"])
    assert.equal(notificationPage(v), 1);
  const good = { items: [n], total: 1, unread: 1, through: id };
  assert.deepEqual(notificationSnapshot(good), good);
  for (const bad of [
    {},
    null,
    { ...good, items: Array(21).fill(n) },
    { ...good, unread: -1 },
    { ...good, items: [{ ...n, created_at: "bad" }] },
    { ...good, items: [{ ...n, target_id: "../secrets" }] },
  ])
    assert.equal(notificationSnapshot(bad), null);
});
