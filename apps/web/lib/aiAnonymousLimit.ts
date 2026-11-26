import { redis } from "./redis";

/**
 * Server-side anonymous rate limiting for AI-generation endpoints.
 *
 * Why this exists: authenticated callers are limited per-user by
 * `aiRateLimit.ts`. Anonymous callers have no trusted user identity, so the
 * guest allowance previously lived entirely in localStorage (`useGuestLimit`)
 * which is trivially reset and is NOT a security boundary. This module gives
 * unauthenticated requests a server-enforced bucket keyed on the client's
 * network identity (proxy-set x-forwarded-for / x-real-ip).
 *
 * Storage: Redis primary → in-memory fallback. The in-memory fallback is a
 * per-instance bucket (same pattern as `equipmentQuoteGuard.ts`) so the limiter
 * NEVER silently fails open during a Redis outage — it degrades to weaker
 * per-instance enforcement instead. Multi-instance parity requires Redis.
 *
 * The identity is derived server-side from headers rewritten by the hosting
 * edge/proxy; a client-supplied user ID is never used as the trust boundary.
 */

const AI_ANON_RATE_WINDOW_SECONDS = 60;
const AI_ANON_RATE_MAX_REQUESTS = 2;
const AI_ANON_DAILY_WINDOW_SECONDS = 86_400;
const AI_ANON_DAILY_MAX_GENERATIONS = 5;

type HeaderSource = { get(name: string): string | null };

type Counter = {
  count: number;
  windowStartedAtMs: number;
};

const inMemoryStore = new Map<string, Counter>();

export function extractClientIdentity(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const candidate = forwarded.split(",")[0]?.trim();
    if (candidate) return candidate;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

async function incrementCounter(
  key: string,
  windowSeconds: number,
  nowMs: number
): Promise<{ count: number; ttl: number }> {
  try {
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      const ttl = await redis.ttl(key);
      return { count, ttl: ttl > 0 ? ttl : windowSeconds };
    }
  } catch {
    // Redis unavailable/erroring → fall through to in-memory enforcement.
  }

  const windowMs = windowSeconds * 1000;
  const previous = inMemoryStore.get(key);
  if (!previous || nowMs - previous.windowStartedAtMs >= windowMs) {
    inMemoryStore.set(key, { count: 1, windowStartedAtMs: nowMs });
    return { count: 1, ttl: windowSeconds };
  }
  const count = previous.count + 1;
  inMemoryStore.set(key, { count, windowStartedAtMs: previous.windowStartedAtMs });
  const ttl = Math.max(1, Math.ceil((windowMs - (nowMs - previous.windowStartedAtMs)) / 1000));
  return { count, ttl };
}

export type AnonymousAiLimitResult = {
  allowed: boolean;
  retryAfter: number;
  dailyRemaining?: number;
  reason?: "rate" | "daily";
};

export async function checkAnonymousAiLimit(
  headers: HeaderSource,
  nowMs: number = Date.now()
): Promise<AnonymousAiLimitResult> {
  const identity = extractClientIdentity(headers);

  const [rate, daily] = await Promise.all([
    incrementCounter(`ratelimit:ai:anon:60:${identity}`, AI_ANON_RATE_WINDOW_SECONDS, nowMs),
    incrementCounter(`ratelimit:ai:anon:daily:${identity}`, AI_ANON_DAILY_WINDOW_SECONDS, nowMs),
  ]);

  if (rate.count > AI_ANON_RATE_MAX_REQUESTS) {
    return { allowed: false, retryAfter: rate.ttl, reason: "rate" };
  }
  if (daily.count > AI_ANON_DAILY_MAX_GENERATIONS) {
    return { allowed: false, retryAfter: daily.ttl, reason: "daily" };
  }
  return {
    allowed: true,
    retryAfter: 0,
    dailyRemaining: Math.max(0, AI_ANON_DAILY_MAX_GENERATIONS - daily.count),
  };
}