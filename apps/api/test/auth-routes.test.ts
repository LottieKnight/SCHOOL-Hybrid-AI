import { test } from "node:test";
import assert from "node:assert/strict";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

test("inferInstitutionShortName builds acronym from multi-word names", async () => {
  setTestEnv();
  const { inferInstitutionShortName } = await import("../src/routes/auth.js");

  assert.equal(inferInstitutionShortName("Cape Town High School"), "CTHS");
  assert.equal(inferInstitutionShortName("St John's College"), "SJC");
  assert.equal(inferInstitutionShortName("University of Cape Town"), "UOCT");
});

test("inferInstitutionShortName returns null for single-word or empty names", async () => {
  setTestEnv();
  const { inferInstitutionShortName } = await import("../src/routes/auth.js");

  assert.equal(inferInstitutionShortName("Harvard"), null);
  assert.equal(inferInstitutionShortName(""), null);
  assert.equal(inferInstitutionShortName(null), null);
  assert.equal(inferInstitutionShortName(undefined), null);
});

test("inferInstitutionShortName caps acronym at first 4 words", async () => {
  setTestEnv();
  const { inferInstitutionShortName } = await import("../src/routes/auth.js");

  const result = inferInstitutionShortName("South African National Defence Force College");
  assert.equal(result?.length, 4);
  assert.equal(result, "SAND");
});

test("POST /auth/register returns 400 when required fields are missing", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email: "test@example.com", password: "password123" },
  });
  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: string };
  assert.ok(body.error);

  await app.close();
  await closeRedis();
});

test("POST /auth/register returns 400 for password shorter than 8 characters", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "test@example.com",
      password: "short",
      firstName: "Test",
      lastName: "User",
      phone: "+27110000000",
    },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("POST /auth/register returns 400 for malformed email address", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "notanemail",
      password: "password123",
      firstName: "Test",
      lastName: "User",
      phone: "+27110000000",
    },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("POST /auth/login returns 401 with AUTH_EMAIL_NOT_FOUND for unregistered email", async () => {
  setTestEnv();
  const { pool } = await import("../src/db/pool.js");
  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;
  mutablePool.query = async () => ({ rows: [] });

  try {
    const { buildServer } = await import("../src/server.js");
    const { closeRedis } = await import("../src/cache.js");
    const app = await buildServer();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@example.com", password: "password123" },
    });
    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.body) as { code: string };
    assert.equal(body.code, "AUTH_EMAIL_NOT_FOUND");

    await app.close();
    await closeRedis();
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("POST /auth/login returns 401 with AUTH_WRONG_PASSWORD for incorrect password", async () => {
  setTestEnv();
  const bcrypt = await import("bcryptjs");
  const knownHash = await bcrypt.default.hash("correctpassword", 4);

  const { pool } = await import("../src/db/pool.js");
  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;
  mutablePool.query = async () => ({
    rows: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        email: "user@example.com",
        password_hash: knownHash,
        first_name: "Test",
        last_name: "User",
        phone: "+27110000000",
        role: "learner",
        is_email_verified: false,
        is_phone_verified: false,
        verification_level: "none",
        trial_started_at: null,
        trial_ends_at: null,
        plan_type: "free",
        plan_status: "inactive",
        plan_expires_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        password_reset_token: null,
        password_reset_expires: null,
      },
    ],
  });

  try {
    const { buildServer } = await import("../src/server.js");
    const { closeRedis } = await import("../src/cache.js");
    const app = await buildServer();

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "user@example.com", password: "wrongpassword" },
    });
    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.body) as { code: string };
    assert.equal(body.code, "AUTH_WRONG_PASSWORD");

    await app.close();
    await closeRedis();
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("GET /auth/session returns 401 when no auth cookie is present", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/auth/session" });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("POST /auth/forgot-password always returns 200 regardless of whether email exists", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/auth/forgot-password",
    payload: { email: "nobody@example.com" },
  });
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { ok: boolean };
  assert.equal(body.ok, true);

  await app.close();
  await closeRedis();
});

test("POST /auth/reset-password returns 400 for invalid payload", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/auth/reset-password",
    payload: { token: "", email: "notanemail", password: "short" },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
  await closeRedis();
});
