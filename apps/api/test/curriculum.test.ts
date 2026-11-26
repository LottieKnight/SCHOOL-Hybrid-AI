import { test } from "node:test";
import assert from "node:assert/strict";

test("curriculum outline endpoint returns stub", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/curriculum/outline" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.status, "stub");

  await app.close();
  await closeRedis();
});
