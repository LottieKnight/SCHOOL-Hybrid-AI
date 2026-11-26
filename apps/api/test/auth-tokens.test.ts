/**
 * Tests for token-based auth endpoints:
 *   POST /auth/verify-email          (requireAuth guard)
 *   POST /auth/verify-email/confirm  (input validation + token rejection)
 *   POST /auth/forgot-password       (always 200, anti-enumeration)
 *   POST /auth/reset-password/confirm (input validation + token rejection)
 *
 * These tests run without a real database. DB-touching happy paths (valid token
 * consumed, email marked verified, password updated) require integration tests
 * against a live Postgres instance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret_key_32_chars_minimum!";
  process.env.COOKIE_SECRET = "test_cookie_secret_32_chars_min!";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

// ---------------------------------------------------------------------------
// POST /auth/verify-email — requires a valid session cookie
// ---------------------------------------------------------------------------

test("verify-email requires authentication", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({ method: "POST", url: "/auth/verify-email" });
  assert.equal(res.statusCode, 401);

  await app.close();
  await closeRedis();
});

// ---------------------------------------------------------------------------
// POST /auth/verify-email/confirm — input validation
// ---------------------------------------------------------------------------

test("verify-email/confirm rejects missing token", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/verify-email/confirm",
    payload: {},
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("verify-email/confirm rejects token shorter than 10 chars", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/verify-email/confirm",
    payload: { token: "short" },
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("verify-email/confirm rejects unknown token (DB unavailable)", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  // A properly-formatted 64-char hex token that doesn't exist in the DB.
  // With no DB, consumeAuthToken throws → Fastify returns 500.
  // This asserts the endpoint never returns 200 for an unrecognised token.
  const res = await app.inject({
    method: "POST",
    url: "/auth/verify-email/confirm",
    payload: { token: "a".repeat(64) },
  });
  assert.notEqual(res.statusCode, 200);

  await app.close();
  await closeRedis();
});

// ---------------------------------------------------------------------------
// POST /auth/forgot-password — always returns 200 (anti-enumeration)
// ---------------------------------------------------------------------------

test("forgot-password returns 200 for malformed email", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/forgot-password",
    payload: { email: "not-an-email" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json<{ ok: boolean }>().ok, true);

  await app.close();
  await closeRedis();
});

test("forgot-password returns 200 for valid email format even when DB is unavailable", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  // DB is unreachable — findUserByEmail will throw — but anti-enumeration must hold.
  const res = await app.inject({
    method: "POST",
    url: "/auth/forgot-password",
    payload: { email: "anyone@example.com" },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json<{ ok: boolean }>().ok, true);

  await app.close();
  await closeRedis();
});

test("forgot-password returns 200 for missing body", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: {} });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json<{ ok: boolean }>().ok, true);

  await app.close();
  await closeRedis();
});

// ---------------------------------------------------------------------------
// POST /auth/reset-password/confirm — input validation
// ---------------------------------------------------------------------------

test("reset-password/confirm rejects missing fields", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/reset-password/confirm",
    payload: {},
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("reset-password/confirm rejects password shorter than 8 chars", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/reset-password/confirm",
    payload: { token: "a".repeat(64), password: "short" },
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("reset-password/confirm rejects short token", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const res = await app.inject({
    method: "POST",
    url: "/auth/reset-password/confirm",
    payload: { token: "tiny", password: "validpassword123" },
  });
  assert.equal(res.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("reset-password/confirm rejects unknown token (DB unavailable)", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  // Valid-format inputs but token doesn't exist — must never return 200.
  const res = await app.inject({
    method: "POST",
    url: "/auth/reset-password/confirm",
    payload: { token: "b".repeat(64), password: "newvalidpassword123" },
  });
  assert.notEqual(res.statusCode, 200);

  await app.close();
  await closeRedis();
});
