import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasPermission,
  effectivePermissions,
  isValidRole,
  ROLE_HIERARCHY,
} from "../src/lib/rbac/roles.js";
import { hasRole, can } from "../src/middleware/rbac.js";

test("role hierarchy is ordered highest to lowest", () => {
  assert.deepEqual(ROLE_HIERARCHY, [
    "superadmin",
    "institution_admin",
    "educator",
    "parent",
    "learner",
    "guest",
  ]);
});

test("isValidRole rejects unknown roles", () => {
  assert.equal(isValidRole("superadmin"), true);
  assert.equal(isValidRole("learner"), true);
  assert.equal(isValidRole("admin"), false);
  assert.equal(isValidRole("hacker"), false);
});

test("guest role only has auth:login", () => {
  const perms = effectivePermissions("guest");
  assert.equal(perms.has("auth:login"), true);
  assert.equal(perms.has("learn:access"), false);
});

test("learner has learning + wallet permissions but no institution analytics", () => {
  const perms = effectivePermissions("learner");
  assert.equal(perms.has("learn:access"), true);
  assert.equal(perms.has("learn:quiz"), true);
  assert.equal(perms.has("wallet:spend"), true);
  assert.equal(perms.has("analytics:institution"), false);
  assert.equal(perms.has("institution:read"), false);
});

test("roles inherit permissions of lower roles in the hierarchy", () => {
  // learner has auth:login (from guest inheritance via effectivePermissions)
  assert.equal(effectivePermissions("learner").has("auth:login"), true);
  // institution_admin inherits all learner permissions
  const instAdmin = effectivePermissions("institution_admin");
  assert.equal(instAdmin.has("learn:access"), true);
  assert.equal(instAdmin.has("analytics:institution"), true);
  assert.equal(instAdmin.has("institution:write"), true);
  assert.equal(instAdmin.has("api_keys:manage"), true);
});

test("explicit permission denial overrides role", () => {
  const perms = effectivePermissions("institution_admin", ["!institution:write"]);
  assert.equal(perms.has("institution:write"), false);
  assert.equal(perms.has("institution:read"), true); // other perms remain
});

test("explicit permission grant extends role", () => {
  const perms = effectivePermissions("learner", ["analytics:predictive"]);
  assert.equal(perms.has("analytics:predictive"), true);
});

test("hasPermission helper checks effective set", () => {
  assert.equal(hasPermission({ role: "institution_admin" }, "institution:write"), true);
  assert.equal(hasPermission({ role: "learner" }, "institution:write"), false);
  assert.equal(hasPermission({ role: "learner", permissions: ["!learn:quiz"] }, "learn:quiz"), false);
});

test("hasRole respects hierarchy (higher or equal)", () => {
  const principal = { sub: "x", role: "institution_admin" };
  assert.equal(hasRole(principal, "institution_admin"), true);
  assert.equal(hasRole(principal, "educator"), true); // inst admin is above educator
  assert.equal(hasRole(principal, "superadmin"), false); // cannot be above superadmin target
  // superadmin satisfies institution_admin requirement
  assert.equal(hasRole({ sub: "x", role: "superadmin" }, "institution_admin"), true);
});

test("can primitive returns boolean and handles null principal", () => {
  assert.equal(can({ sub: "x", role: "learner" }, "learn:access"), true);
  assert.equal(can(null, "learn:access"), false);
  assert.equal(can(undefined, "learn:access"), false);
  assert.equal(can({ sub: "x", role: "learner" }, "institution:write"), false);
});
