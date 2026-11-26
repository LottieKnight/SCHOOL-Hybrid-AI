import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type HttpMethod = "GET" | "HEAD";
type HttpResponseType = "text" | "buffer";

export type PoliteHttpOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  minDelayMs?: number;
  jitterMs?: number;
  cacheTtlMs?: number;
  cacheDir?: string;
  skipCache?: boolean;
  logPrefix?: string;
  responseType?: HttpResponseType;
};

export type PoliteHttpResult = {
  ok: boolean;
  status: number;
  url: string;
  redirected: boolean;
  headers: Record<string, string>;
  text: string;
  bodyBuffer: Buffer;
  fromCache: boolean;
};

type QueueItem<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

class PoliteLimiter {
  private active = 0;
  private queue: Array<QueueItem<unknown>> = [];
  private readonly maxConcurrent: number;
  private readonly minIntervalMs: number;
  private lastStartedAt = 0;

  constructor(maxConcurrent = 2, minIntervalMs = 1000) {
    this.maxConcurrent = maxConcurrent;
    this.minIntervalMs = minIntervalMs;
  }

  schedule<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run, resolve, reject });
      this.drain();
    });
  }

  private drain() {
    if (this.active >= this.maxConcurrent) return;
    const item = this.queue.shift();
    if (!item) return;

    const now = Date.now();
    const waitMs = Math.max(0, this.minIntervalMs - (now - this.lastStartedAt));
    this.active += 1;

    setTimeout(() => {
      this.lastStartedAt = Date.now();
      item
        .run()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }, waitMs);
  }
}

const limiter = new PoliteLimiter(2, 1000);

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Error", message: String(error), stack: undefined };
}

function toHeaderRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function sanitizeForKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 120);
}

function hashKey(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function getDefaultHeaders(url: string) {
  const referer = (() => {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}/`;
    } catch {
      return "https://www.education.gov.za/";
    }
  })();

  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-ZA,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    Referer: referer,
    "Cache-Control": "no-cache",
  };
}

function buildCachePath(cacheDir: string, method: HttpMethod, url: string, responseType: HttpResponseType) {
  const parsed = new URL(url);
  const host = sanitizeForKey(parsed.host);
  const key = hashKey(`${method}:${url}:${responseType}`);
  return path.join(cacheDir, host, `${method.toLowerCase()}-${key}.json`);
}

async function readCachedResult(
  cachePath: string,
  cacheTtlMs: number
): Promise<Omit<PoliteHttpResult, "fromCache"> | null> {
  try {
    const raw = await fs.readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as {
      savedAt: number;
      result: Omit<PoliteHttpResult, "fromCache"> & { bodyBase64: string };
    };
    if (!parsed?.savedAt || !parsed?.result) return null;
    if (Date.now() - parsed.savedAt > cacheTtlMs) return null;
    const result = parsed.result;
    const bodyBuffer = Buffer.from(result.bodyBase64, "base64");
    return {
      ok: result.ok,
      status: result.status,
      url: result.url,
      redirected: result.redirected,
      headers: result.headers,
      text: result.text,
      bodyBuffer,
    };
  } catch {
    return null;
  }
}

async function writeCachedResult(cachePath: string, result: Omit<PoliteHttpResult, "fromCache">) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(
    cachePath,
    JSON.stringify(
      {
        savedAt: Date.now(),
        result: {
          ...result,
          bodyBase64: result.bodyBuffer.toString("base64"),
        },
      },
      null,
      2
    ),
    "utf-8"
  );
}

async function withTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithPoliteHeaders(url: string, options: PoliteHttpOptions = {}): Promise<PoliteHttpResult> {
  const method = options.method || "GET";
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 20000;
  const minDelayMs = options.minDelayMs ?? 1000;
  const jitterMs = options.jitterMs ?? 300;
  const cacheDir = options.cacheDir || path.join(process.cwd(), ".cache", "past-papers-http");
  const cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const responseType = options.responseType || "text";
  const skipCache = options.skipCache === true || method !== "GET";
  const logPrefix = options.logPrefix || "[http]";

  const headers = { ...getDefaultHeaders(url), ...(options.headers || {}) };

  const cachePath = buildCachePath(cacheDir, method, url, responseType);
  if (!skipCache) {
    const cached = await readCachedResult(cachePath, cacheTtlMs);
    if (cached) return { ...cached, fromCache: true };
  }

  let lastError: unknown = null;
  let attempt = 0;
  while (attempt < retries) {
    attempt += 1;
    try {
      const response = await limiter.schedule(() =>
        withTimeout(
          url,
          {
            method,
            headers,
          },
          timeoutMs
        )
      );

      const bodyBuffer =
        method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await response.arrayBuffer());
      const text = responseType === "text" ? bodyBuffer.toString("utf-8") : "";
      const baseResult: Omit<PoliteHttpResult, "fromCache"> = {
        ok: response.ok,
        status: response.status,
        url: response.url,
        redirected: response.redirected,
        headers: toHeaderRecord(response.headers),
        text,
        bodyBuffer,
      };

      if (!skipCache) {
        await writeCachedResult(cachePath, baseResult);
      }

      return { ...baseResult, fromCache: false };
    } catch (error) {
      lastError = error;
      const normalized = normalizeError(error);
      const backoffMs = Math.pow(2, attempt) * minDelayMs + Math.floor(Math.random() * jitterMs);
      if (attempt >= retries) break;
      console.warn(`${logPrefix} retry`, {
        url,
        method,
        attempt,
        error: normalized.message,
        backoffMs,
      });
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  const normalized = normalizeError(lastError);
  throw new Error(`${logPrefix} request failed: ${normalized.message}`);
}
