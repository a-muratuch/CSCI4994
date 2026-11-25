import test from "node:test";
import assert from "node:assert/strict";
import { passwordErrors, recentEmailProof } from "./password.ts";
test("password validation distinguishes current password, length and confirmation", () => {
  assert.deepEqual(
    passwordErrors({
      password: "long-enough-test",
      confirmation: "long-enough-test",
    }),
    {},
  );
  assert.ok(
    passwordErrors({ password: "short", confirmation: "different" }, true)
      .currentPassword,
  );
  assert.ok(
    passwordErrors({ password: " ".repeat(8), confirmation: " ".repeat(8) })
      .password,
  );
  assert.ok(
    passwordErrors({
      password: "x".repeat(1025),
      confirmation: "x".repeat(1025),
    }).password,
  );
});
test("reset requires matching recently verified email proof, not password login or metadata", () => {
  const valid = { sub: "user", amr: [{ method: "otp", timestamp: 1000 }] };
  assert.equal(recentEmailProof(valid, "user", 1100), true);
  assert.equal(
    recentEmailProof(
      { sub: "user", amr: [{ method: "recovery", timestamp: 1000 }] },
      "user",
      1100,
    ),
    true,
  );
  assert.equal(recentEmailProof(valid, "other", 1100), false);
  assert.equal(recentEmailProof(valid, "user", 2000), false);
  assert.equal(
    recentEmailProof(
      { sub: "user", amr: [{ method: "password", timestamp: 1000 }] },
      "user",
      1100,
    ),
    false,
  );
  assert.equal(
    recentEmailProof({ sub: "user", user_metadata: valid }, "user", 1100),
    false,
  );
  assert.equal(recentEmailProof(valid, "user", 900), false);
});

test("invitation proof must be current and tied to the verified user", () => {
  const now = 10000;
  assert.equal(
    recentEmailProof(
      { sub: "worker", amr: [{ method: "invite", timestamp: now }] },
      "worker",
      now,
    ),
    true,
  );
  assert.equal(
    recentEmailProof(
      { sub: "worker", amr: [{ method: "invite", timestamp: now - 1000 }] },
      "worker",
      now,
    ),
    false,
  );
  assert.equal(
    recentEmailProof(
      { sub: "worker", amr: [{ method: "invite", timestamp: now }] },
      "other",
      now,
    ),
    false,
  );
});
