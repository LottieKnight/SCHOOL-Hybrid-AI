import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isSameOrigin, isValidCsrfToken } from "../lib/csrf";

function makeRequest(input: {
  method?: string;
  origin?: string;
  referer?: string;
  expectedOrigin?: string;
  csrfHeader?: string | null;
  csrfCookie?: string | null;
}) {
  const headers = new Headers();
  if (input.origin) headers.set("origin", input.origin);
  if (input.referer) headers.set("referer", input.referer);
  if (input.csrfHeader) headers.set("x-csrf-token", input.csrfHeader);

  const csrfCookie = input.csrfCookie;
  const request = {
    method: input.method ?? "GET",
    headers,
    nextUrl: { origin: input.expectedOrigin ?? "http://localhost:3000" },
    cookies: {
      get(name: string) {
        if (name !== "saedu_csrf") return undefined;
        if (!csrfCookie) return undefined;
        return { value: csrfCookie };
      },
    },
  } as unknown as NextRequest;

  return request;
}

describe("csrf helpers", () => {
  it("accepts matching same-origin header", () => {
    const request = makeRequest({
      origin: "http://localhost:3000",
      expectedOrigin: "http://localhost:3000",
    });
    expect(isSameOrigin(request)).toBe(true);
  });

  it("rejects cross-origin header", () => {
    const request = makeRequest({
      origin: "https://attacker.example",
      expectedOrigin: "http://localhost:3000",
    });
    expect(isSameOrigin(request)).toBe(false);
  });

  it("accepts matching csrf header and cookie", () => {
    const request = makeRequest({
      method: "POST",
      csrfHeader: "token-123",
      csrfCookie: "token-123",
    });
    expect(isValidCsrfToken(request)).toBe(true);
  });

  it("rejects missing csrf cookie", () => {
    const request = makeRequest({
      method: "PATCH",
      csrfHeader: "token-123",
      csrfCookie: null,
    });
    expect(isValidCsrfToken(request)).toBe(false);
  });

  it("rejects mismatched csrf token", () => {
    const request = makeRequest({
      method: "DELETE",
      csrfHeader: "token-abc",
      csrfCookie: "token-xyz",
    });
    expect(isValidCsrfToken(request)).toBe(false);
  });
});
