import { describe, expect, it, vi } from "vitest";
import { HttpResponseError, fetchJsonOrThrow, safeJson } from "../lib/http";

describe("safeJson", () => {
  it("returns null for 204/no-body responses", async () => {
    const response = new Response(null, { status: 204 });
    await expect(safeJson(response)).resolves.toBeNull();
  });

  it("returns null for empty string body", async () => {
    const response = new Response("", { status: 200 });
    await expect(safeJson(response)).resolves.toBeNull();
  });

  it("parses valid JSON body", async () => {
    const response = new Response(JSON.stringify({ id: 1, name: "test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    await expect(safeJson(response)).resolves.toEqual({ id: 1, name: "test" });
  });

  it("returns a non-json marker for invalid JSON bodies", async () => {
    const response = new Response("<html>upstream error</html>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });
    const parsed = await safeJson(response);
    expect(parsed).toEqual({
      __nonJson: true,
      raw: "<html>upstream error</html>",
    });
  });

  it("truncates non-JSON raw body to 500 chars", async () => {
    const longHtml = "<p>" + "x".repeat(600) + "</p>";
    const response = new Response(longHtml, { status: 200 });
    const parsed = await safeJson(response) as { __nonJson: boolean; raw: string };
    expect(parsed.__nonJson).toBe(true);
    expect(parsed.raw.length).toBe(500);
  });
});

describe("HttpResponseError", () => {
  it("exposes status, name, and payload", () => {
    const response = new Response("{}", { status: 422, statusText: "Unprocessable Entity" });
    const payload = { field: "email", message: "invalid" };
    const err = new HttpResponseError(response, payload);
    expect(err.status).toBe(422);
    expect(err.name).toBe("HttpResponseError");
    expect(err.payload).toBe(payload);
  });

  it("message includes HTTP status and JSON snippet", () => {
    const response = new Response("{}", { status: 400, statusText: "Bad Request" });
    const err = new HttpResponseError(response, { error: "bad input" });
    expect(err.message).toContain("HTTP 400 Bad Request");
    expect(err.message).toContain('"error"');
  });

  it("message trims cleanly when statusText is empty", () => {
    const response = new Response(null, { status: 200, statusText: "" });
    const err = new HttpResponseError(response, null);
    expect(err.message).toBe("HTTP 200");
  });

  it("message includes raw snippet for non-JSON payload", () => {
    const response = new Response("", { status: 502, statusText: "Bad Gateway" });
    const nonJson = { __nonJson: true as const, raw: "<html>gateway error</html>" };
    const err = new HttpResponseError(response, nonJson);
    expect(err.message).toContain("gateway error");
  });

  it("is an instance of Error", () => {
    const response = new Response("{}", { status: 500 });
    const err = new HttpResponseError(response, null);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpResponseError);
  });
});

describe("fetchJsonOrThrow", () => {
  it("returns response and parsed data on 2xx", async () => {
    const body = { userId: 42 };
    const mockResponse = new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn(async () => mockResponse);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const result = await fetchJsonOrThrow<{ userId: number }>("/api/user");
      expect(result.response.status).toBe(200);
      expect(result.data).toEqual({ userId: 42 });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null data for 204 no-content", async () => {
    const mockResponse = new Response(null, { status: 204 });
    const fetchMock = vi.fn(async () => mockResponse);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const result = await fetchJsonOrThrow("/api/delete");
      expect(result.data).toBeNull();
      expect(result.response.status).toBe(204);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws HttpResponseError with parsed payload snippet on non-2xx", async () => {
    const response = new Response(JSON.stringify({ error: "Boom" }), {
      status: 500,
      statusText: "Server Error",
      headers: { "content-type": "application/json" },
    });
    const fetchMock = vi.fn(async () => response);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await expect(fetchJsonOrThrow("/api/test")).rejects.toBeInstanceOf(HttpResponseError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws HttpResponseError with correct status on 4xx", async () => {
    const mockResponse = new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      statusText: "Not Found",
    });
    const fetchMock = vi.fn(async () => mockResponse);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      await fetchJsonOrThrow("/api/missing");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpResponseError);
      expect((e as HttpResponseError).status).toBe(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
