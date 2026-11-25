import test from "node:test";
import assert from "node:assert/strict";
import {
  accountFromProfile,
  protectedRole,
  roleHome,
  roleLogin,
} from "./roles.ts";
import { readAuthInput, validateAuth } from "./validation.ts";

const valid = {
  fullName: "Test Customer",
  email: "customer@example.com",
  password: "Example-password-123",
  confirmation: "Example-password-123",
};

test("registration rejects invalid fields and password mismatch", () => {
  assert.deepEqual(validateAuth("register", valid), {});
  for (const [field, value] of [
    ["fullName", " "],
    ["fullName", "x".repeat(101)],
    ["email", "not-an-email"],
    ["email", `${"x".repeat(250)}@example.com`],
    ["password", "short"],
    ["password", "x".repeat(1025)],
    ["confirmation", "different"],
  ]) {
    assert.ok(validateAuth("register", { ...valid, [field]: value })[field]);
  }
});

test("all login forms require credentials without registration-only fields", () => {
  for (const mode of ["login", "worker-login", "admin-login"]) {
    assert.deepEqual(
      validateAuth(mode, { ...valid, fullName: "", confirmation: "" }),
      {},
    );
    assert.ok(validateAuth(mode, { ...valid, password: " " }).password);
    assert.ok(validateAuth(mode, { ...valid, email: "" }).email);
  }
});

test("submitted metadata cannot choose a privileged signup role", () => {
  const form = new FormData();
  form.set("mode", "register");
  for (const [name, value] of Object.entries(valid)) form.set(name, value);
  form.set("role", "admin");
  const input = readAuthInput(form);
  assert.deepEqual(Object.keys(input.values).sort(), [
    "confirmation",
    "email",
    "fullName",
    "password",
  ]);
  assert.equal(input.mode, "register");
  form.set("mode", "admin-register");
  assert.equal(readAuthInput(form), null);
});

test("only a matching database profile determines account role", () => {
  const profile = {
    id: "verified-id",
    role: "customer",
    full_name: "Test Customer",
    is_admin: true,
    metadata: { role: "admin" },
  };
  assert.equal(
    accountFromProfile("verified-id", "test@example.com", profile).role,
    "customer",
  );
  for (const invalid of [
    null,
    {},
    { ...profile, id: "other-user" },
    { ...profile, role: "presenter" },
    { ...profile, role: null },
    { ...profile, full_name: 123 },
  ]) {
    assert.equal(
      accountFromProfile("verified-id", "test@example.com", invalid),
      null,
    );
  }
  for (const role of ["customer", "worker", "admin"]) {
    assert.equal(
      accountFromProfile("verified-id", "test@example.com", {
        ...profile,
        role,
      }).role,
      role,
    );
  }
});

test("protected route detection covers nested pages but leaves login routes public", () => {
  for (const role of ["customer", "worker", "admin"]) {
    assert.equal(protectedRole(roleHome(role)), role);
    assert.equal(protectedRole(`${roleHome(role)}/records/arbitrary-id`), role);
    assert.equal(protectedRole(roleLogin(role)), null);
    assert.equal(protectedRole(`/${role}-unrelated`), null);
  }
  for (const path of [
    "/",
    "/register",
    "/auth/callback",
    "/auth/error",
    "/design-system",
  ])
    assert.equal(protectedRole(path), null);
});

test("file-valued credential fields are not treated as strings", () => {
  const form = new FormData();
  form.set("mode", "login");
  form.set("email", new Blob(["not a credential"]), "upload.txt");
  form.set("password", valid.password);
  assert.equal(readAuthInput(form).values.email, "");
});

test("inactive or malformed activation cannot create an account", () => {
  assert.equal(
    accountFromProfile("id", "test@example.invalid", {
      id: "id",
      role: "worker",
      full_name: "Test",
      active: false,
    }),
    null,
  );
  assert.equal(
    accountFromProfile("id", "test@example.invalid", {
      id: "id",
      role: "admin",
      full_name: "Test",
      active: "true",
    }),
    null,
  );
  assert.equal(
    accountFromProfile("id", "test@example.invalid", {
      id: "id",
      role: "worker",
      full_name: "Test",
      active: true,
    }).role,
    "worker",
  );
});
