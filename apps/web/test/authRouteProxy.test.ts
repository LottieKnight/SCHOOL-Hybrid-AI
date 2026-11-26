import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { proxyAuthRoute } from "../lib/server/authRouteProxy";
import type { NextRequest } from "next/server";

describe("proxyAuthRoute", () => {
  beforeEach(() => {
    process.env.API_BASE_URL = "https://api.example.test";
  });

  it("forwards the request and preserves upstream cookies", async () => {
    const upstream = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: [
        ["content-type", "application/json"],
        ["set-cookie", "saedu_session=abc; Path=/; HttpOnly"],
        ["set-cookie", "saedu_csrf=def; Path=/"],
      ],
    });

    const fetchMock = vi.fn(async () => upstream);
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ email: "learner@example.com", password: "password123" });
    const requestHeaders = new Headers({
      "content-type": "application/json",
      cookie: "existing=value",
    });
    const clonedRequest = new Request("https://school.example.test/api/auth/login?next=/dashboard", {
      method: "POST",
      headers: requestHeaders,
      body,
    });
    const request = {
      method: "POST",
      headers: requestHeaders,
      nextUrl: new URL("https://school.example.test/api/auth/login?next=/dashboard"),
      clone: () => clonedRequest,
    } as unknown as NextRequest;

    const response = await proxyAuthRoute(request, "/auth/login");
    const payload = await response.json();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as unknown as [
      string | URL | Request,
      RequestInit | undefined,
    ];
    const forwardedHeaders = new Headers(requestInit?.headers);
    const setCookies = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(requestUrl)).toBe("https://api.example.test/auth/login?next=/dashboard");
    expect(requestInit).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "manual",
    });
    expect(forwardedHeaders.get("cookie")).toBe("existing=value");
    expect(payload).toEqual({ ok: true });
    expect(setCookies.join(" | ")).toContain("saedu_session=abc");
    expect(setCookies.join(" | ")).toContain("saedu_csrf=def");
  });
});
