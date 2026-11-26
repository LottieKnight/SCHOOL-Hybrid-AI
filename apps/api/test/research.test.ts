import { test } from "node:test";
import assert from "node:assert/strict";

test("research consent route requires authentication", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret_key_long_enough_for_jwt";
  process.env.COOKIE_SECRET = "test_cookie_secret_long_enough";
  process.env.CORS_ORIGIN = "https://school.ditshego-ventures.co.za,http://localhost:3000";

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  // Without auth header or cookie -> 401
  const unauthRes = await app.inject({
    method: "POST",
    url: "/research/observational-silence-v1/consent",
    payload: { consentVersion: "v1" },
  });
  assert.equal(unauthRes.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("research consent route enforces CSRF token when using cookie auth", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret_key_long_enough_for_jwt";
  process.env.COOKIE_SECRET = "test_cookie_secret_long_enough";
  process.env.CORS_ORIGIN = "https://school.ditshego-ventures.co.za,http://localhost:3000";

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const token = app.jwt.sign({ sub: "user-123", email: "test@example.com", role: "STUDENT" });

  // Cookie-authenticated request without x-csrf-token header -> 403 Invalid CSRF token
  const noCsrfRes = await app.inject({
    method: "POST",
    url: "/research/observational-silence-v1/consent",
    cookies: {
      saedu_session: token,
      saedu_csrf: "test_csrf_token_123",
    },
    payload: { consentVersion: "v1" },
  });
  assert.equal(noCsrfRes.statusCode, 403);
  assert.deepEqual(noCsrfRes.json(), { error: "Invalid CSRF token" });

  // Cookie-authenticated request WITH matching x-csrf-token header -> passes CSRF check
  const withCsrfRes = await app.inject({
    method: "POST",
    url: "/research/observational-silence-v1/consent",
    headers: {
      "x-csrf-token": "test_csrf_token_123",
    },
    cookies: {
      saedu_session: token,
      saedu_csrf: "test_csrf_token_123",
    },
    payload: { consentVersion: "v1" },
  });
  // Since DB isn't running in unit test, it will fail at DB query (or 404/500), but NOT at 403 CSRF
  assert.notEqual(withCsrfRes.statusCode, 403);

  // Bearer-authenticated request does not require CSRF token
  const bearerRes = await app.inject({
    method: "POST",
    url: "/research/observational-silence-v1/consent",
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: { consentVersion: "v1" },
  });
  assert.notEqual(bearerRes.statusCode, 403);

  await app.close();
  await closeRedis();
});
