import { redis } from "@/lib/redis";

const AI_RATE_WINDOW_SECONDS = 60;
const AI_RATE_MAX_REQUESTS = 10;

// Free/trial accounts get a daily cap on AI generations; paid accounts are
// unlimited. The client gates guests at 1 generation; this is the server-side
// guard for signed-in free/trial users.
const AI_DAILY_WINDOW_SECONDS = 86400;
const AI_DAILY_MAX_FREE = 10;

export async function checkAiRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!redis || !userId) return { allowed: true, retryAfter: 0 };

  const key = `ratelimit:ai:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, AI_RATE_WINDOW_SECONDS);
    }
    if (count > AI_RATE_MAX_REQUESTS) {
      const ttl = await redis.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : AI_RATE_WINDOW_SECONDS };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    // Redis failure → allow through to avoid false 429s
    return { allowed: true, retryAfter: 0 };
  }
}

export async function checkAiDailyLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter: number;
}> {
  if (!redis || !userId) {
    return { allowed: true, remaining: AI_DAILY_MAX_FREE, limit: AI_DAILY_MAX_FREE, retryAfter: 0 };
  }

  const key = `ratelimit:ai:daily:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, AI_DAILY_WINDOW_SECONDS);
    }
    const remaining = Math.max(0, AI_DAILY_MAX_FREE - count);
    if (count > AI_DAILY_MAX_FREE) {
      const ttl = await redis.ttl(key);
      return { allowed: false, remaining: 0, limit: AI_DAILY_MAX_FREE, retryAfter: ttl > 0 ? ttl : AI_DAILY_WINDOW_SECONDS };
    }
    return { allowed: true, remaining, limit: AI_DAILY_MAX_FREE, retryAfter: 0 };
  } catch {
    // Redis failure → allow through to avoid false 429s
    return { allowed: true, remaining: AI_DAILY_MAX_FREE, limit: AI_DAILY_MAX_FREE, retryAfter: 0 };
  }
}

export async function getAiDailyUsage(userId: string): Promise<{
  remaining: number;
  limit: number;
  allowed: boolean;
}> {
  if (!redis || !userId) {
    return { remaining: AI_DAILY_MAX_FREE, limit: AI_DAILY_MAX_FREE, allowed: true };
  }

  const key = `ratelimit:ai:daily:${userId}`;
  try {
    const count = Number((await redis.get(key)) ?? "0");
    const remaining = Math.max(0, AI_DAILY_MAX_FREE - count);
    return { remaining, limit: AI_DAILY_MAX_FREE, allowed: remaining > 0 };
  } catch {
    return { remaining: AI_DAILY_MAX_FREE, limit: AI_DAILY_MAX_FREE, allowed: true };
  }
}

export function isPaidAccess(access: { planType?: string; planStatus?: string }): boolean {
  const planType = access.planType?.toLowerCase() ?? "";
  const planStatus = access.planStatus?.toLowerCase() ?? "";
  return (
    Boolean(planType) &&
    planType !== "free" &&
    planType !== "trial" &&
    planStatus !== "canceled" &&
    planStatus !== "expired"
  );
}
