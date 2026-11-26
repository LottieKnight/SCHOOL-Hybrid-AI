import { test } from "node:test";
import assert from "node:assert/strict";
import { hashApiKey, scopesToPermissions } from "../src/lib/api-keys.js";

test("hashApiKey produces a stable sha256 hex digest", () => {
  const a = hashApiKey("schl_abc123");
  const b = hashApiKey("schl_abc123");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, hashApiKey("schl_abc124"));
});

test("different keys hash to different values", () => {
  assert.notEqual(hashApiKey("schl_key_one"), hashApiKey("schl_key_two"));
});

test("scopesToPermissions maps scopes to RBAC permissions", () => {
  const perms = scopesToPermissions(["read:analytics", "write:users", "write:webhooks"]);
  assert.ok(perms.includes("analytics:institution"));
  assert.ok(perms.includes("institution:manage_users"));
  assert.ok(perms.includes("webhooks:manage"));
  assert.equal(perms.includes("institution:write"), false);
});

test("unknown scopes are ignored", () => {
  const perms = scopesToPermissions(["bogus:scope"]);
  assert.deepEqual(perms, []);
});
