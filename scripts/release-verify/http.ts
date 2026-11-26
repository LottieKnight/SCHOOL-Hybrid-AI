import { Agent as HttpsAgent } from "node:https";
import { Agent as HttpAgent } from "node:http";
import { redactText, safeJsonStringify } from "./result.js";

/**
 * Secret-safe HTTP client for the release verification runner.
 *
 * - Tracks cookies by NAME only for reporting; cookie VALUES are never printed.
 * - Records a fixed allow-list of response headers (never cookies/auth/authorization).
 * - Redacts token/csrf/password/cookie patterns from any captured body/header text.
 */

export interface CookieAttrs {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
  headers?: Record<string, string>;
  json?: unknown;
  body?: string;
  useCookies?: boolean;
  followRedirects?: boolean;
  timeoutMs?: number;
}

export interface ApiResponse {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  redirected: boolean;
  latencyMs: number;
  contentType?: string;
  retryAfterHeader?: string;
  setCookieNames: string[];
  cookieAttrs: Record<string, CookieAttrs>;
  body: string; // already redacted + trimmed
  json: () => unknown;
}

const HEADER_ALLOWLIST = new Set([
  "content-type",
  "retry-after",
  "x-ratelimit-remaining",
  "x-ratelimit-limit",
  "x-ratelimit-reset",
  "cache-control",
  "x-content-type-options",
  "x-frame-options",
  "strict-transport-security",
  "content-security-policy",
  "referrer-policy",
]);

function parseSetCookie(header: string): { name: string; attrs: CookieAttrs } {
  const parts = header.split(";").map((p) => p.trim());
  const first = parts.shift() ?? "";
  const eq = first.indexOf("=");
  const name = eq > 0 ? first.slice(0, eq) : first;
  const attrs: CookieAttrs = {};
  for (const part of parts) {
    const [k, ...rest] = part.split("=");
    const key = k?.trim().toLowerCase() ?? "";
    const value = rest.join("=").trim();
    if (key === "httponly") attrs.httpOnly = true;
    else if (key === "secure") attrs.secure = true;
    else if (key === "samesite") attrs.sameSite = value;
    else if (key === "path") attrs.path = value;
  }
  return { name, attrs };
}

function extractCookies(setCookieHeaders: string[]): Record<string, CookieAttrs> {
  const map = new Map<string, CookieAttrs>();
  for (const raw of setCookieHeaders) {
    if (!raw) continue;
    try {
      const { name, attrs } = parseSetCookie(raw);
      if (name) map.set(name, attrs);
    } catch {
      // never fail the run because a Set-Cookie was malformed
    }
  }
  return Object.fromEntries(map);
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly agent: HttpAgent | HttpsAgent;
  private jar = new Map<string, string>();

  constructor(baseUrl: string, opts: { allowInsecure?: boolean } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    const isHttps = this.baseUrl.startsWith("https:");
    this.agent = isHttps
      ? new HttpsAgent({ rejectUnauthorized: opts.allowInsecure ? false : true, keepAlive: true })
      : new HttpAgent({ keepAlive: true });
  }

  clearCookies(): void {
    this.jar.clear();
  }

  async request(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    const method = options.method ?? "GET";
    const startedAt = performance.now();
    const timeoutMs = options.timeoutMs ?? 20000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = { ...(options.headers ?? {}) };
    if (options.json !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (options.useCookies !== false && this.jar.size > 0) {
      const cookieHeader = [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
      headers.cookie = cookieHeader;
    }

    let body: string | undefined;
    if (options.json !== undefined) body = JSON.stringify(options.json);
    else if (options.body !== undefined) body = options.body;

    try {
      const init: RequestInit = {
        method,
        headers,
        body,
        redirect: options.followRedirects === false ? "manual" : "follow",
        signal: controller.signal,
      };
      (init as { agent?: unknown }).agent = this.agent;

      const res = await fetch(new URL(path, this.baseUrl), init);

      const latencyMs = performance.now() - startedAt;
      const raw = await res.text();
      const getSetCookie = (): string[] =>
        typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : [];

      if (options.useCookies !== false) {
        for (const rawCookie of getSetCookie()) {
          try {
            const { name } = parseSetCookie(rawCookie);
            if (!name) continue;
            const eq = rawCookie.indexOf("=");
            this.jar.set(name, eq > 0 ? rawCookie.slice(eq + 1).split(";")[0].trim() : "");
          } catch {
            // ignore malformed cookies
          }
        }
      }

      const cookieNames = getSetCookie().map((c) => {
        const eq = c.indexOf("=");
        return eq > 0 ? c.slice(0, eq).trim() : "?(malformed)";
      });

      const cookieAttrs = extractCookies(getSetCookie());
      const limitedBody = redactText(raw).slice(0, 4000);

      let parsedJson: unknown | null = null;
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        // not JSON
      }

      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        redirected: res.redirected,
        latencyMs,
        contentType: res.headers.get("content-type") ?? undefined,
        retryAfterHeader: res.headers.get("retry-after") ?? undefined,
        setCookieNames: cookieNames,
        cookieAttrs,
        body: limitedBody,
        json: () => parsedJson,
      };
    } catch (error) {
      const latencyMs = performance.now() - startedAt;
      const reason = error instanceof Error ? error.name === "AbortError" ? "timeout" : error.message : String(error);
      throw new RequestError(`${method} ${path} failed: ${reason}`, latencyMs);
    } finally {
      clearTimeout(timer);
    }
  }

  async get(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.request(path, { ...options, method: "GET" });
  }
  async post(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
    return this.request(path, { ...options, method: "POST" });
  }
}

export class RequestError extends Error {
  readonly latencyMs: number;
  constructor(message: string, latencyMs: number) {
    super(message);
    this.latencyMs = latencyMs;
  }
}

export function describeResponse(res: ApiResponse, maxBody = 220): string {
  const pieces = [`status=${res.status}`, `latency=${res.latencyMs.toFixed(0)}ms`, `body=${res.body.slice(0, maxBody).replace(/\s+/g, " ")}`];
  if (res.retryAfterHeader) pieces.push(`retry-after=${res.retryAfterHeader}`);
  if (res.setCookieNames.length) pieces.push(`set-cookie=[${res.setCookieNames.join(",")}]`);
  return pieces.join(" | ");
}

export function safeTail(res: ApiResponse): string {
  return redactText(safeJsonStringify(res.json(), 800));
}