import Redis from "ioredis";

type RedisGlobal = typeof globalThis & {
  __schoolWebRedis?: Redis | null;
};

function getRedisUrl() {
  return (
    process.env.REDIS_URL?.trim() ||
    process.env.REDIS_PUBLIC_URL?.trim() ||
    ""
  );
}

function createRedisClient() {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 8000,
    enableOfflineQueue: false,
  });

  // Vercel will log and sometimes treat Redis connection errors as fatal
  // unless the client has an error listener. The app already treats cache
  // access as best-effort, so swallow client-level errors here.
  client.on("error", () => {});
  client.on("close", () => {});
  client.on("end", () => {});

  return client;
}

export function getRedisClient() {
  const globalForRedis = globalThis as RedisGlobal;
  if (typeof globalForRedis.__schoolWebRedis === "undefined") {
    globalForRedis.__schoolWebRedis = createRedisClient();
  }
  return globalForRedis.__schoolWebRedis;
}

export const redis = getRedisClient();
