import { Redis } from "ioredis";
import { config } from "./config.js";

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  // maxRetriesPerRequest only fails pending commands; ioredis still
  // reconnects forever by default. In tests there is no Redis service,
  // and the reconnect timer keeps the process from ever exiting.
  ...(config.env === "test" ? { retryStrategy: () => null } : {}),
});

redis.on("error", () => {
  // Prevent unhandled "error" events from crashing the process when the
  // Redis service is unreachable. Callers must handle per-command failures.
});

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(key: string, payload: unknown, ttlSeconds: number) {
  try {
    await redis.set(key, JSON.stringify(payload), "EX", ttlSeconds);
  } catch {
    return;
  }
}

export async function closeRedis() {
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
