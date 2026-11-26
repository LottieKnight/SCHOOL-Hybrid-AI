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

test("auth cookies are issued as raw JWT cookies", async () => {
  setTestEnv();

  const { setAuthCookies } = await import("../src/routes/auth/utils.js");

  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const reply = {
    setCookie(name: string, value: string, options: Record<string, unknown>) {
      cookies.push({ name, value, options });
      return reply;
    },
  };

  setAuthCookies(reply as never, "jwt-token", "csrf-token");

  const sessionCookie = cookies.find((cookie) => cookie.name === "saedu_session");
  assert.ok(sessionCookie);
  assert.equal(sessionCookie?.value, "jwt-token");
  assert.equal(sessionCookie?.options.signed, undefined);
});
