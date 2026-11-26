import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeSessionToken, signToken, verifyToken } from "../lib/server/cookieAuth.js";

function setTestEnv() {
  process.env.JWT_SECRET = "test_secret_key_32_chars_minimum!";
}

describe("cookieAuth", () => {
  test("normalizes Fastify signed-cookie wrappers back to the raw JWT", () => {
    const rawToken = "header.payload.signature";
    expect(normalizeSessionToken(`s:${rawToken}.cookie-signature`)).toBe(rawToken);
  });

  test("verifies a raw JWT session token", async () => {
    setTestEnv();
    const token = await signToken({
      sub: "user-1",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
      role: "student",
    });

    await expect(verifyToken(token)).resolves.toMatchObject({ sub: "user-1", email: "user@example.com" });
  });

  test("verifies a Fastify signed-cookie wrapper around the JWT", async () => {
    setTestEnv();
    const token = await signToken({
      sub: "user-2",
      email: "signed@example.com",
      firstName: "Signed",
      lastName: "Session",
      role: "student",
    });

    await expect(verifyToken(`s:${token}.cookie-signature`)).resolves.toMatchObject({
      sub: "user-2",
      email: "signed@example.com",
    });
  });
});
