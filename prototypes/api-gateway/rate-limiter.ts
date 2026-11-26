import { RateLimitConfig, GatewayContext } from './types';

interface RateLimitEntry {
  count: number;
  windowStart: number;
  resetAt: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly defaultConfig: RateLimitConfig;

  constructor(defaultConfig: RateLimitConfig) {
    this.defaultConfig = defaultConfig;
  }

  check(context: GatewayContext, config?: RateLimitConfig): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const rateConfig = config || this.defaultConfig;
    const key = this.getKey(context, rateConfig);
    const now = Date.now();

    let entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 1,
        windowStart: now,
        resetAt: now + rateConfig.windowMs,
      };
      this.store.set(key, entry);
      return { allowed: true, remaining: rateConfig.max - 1, retryAfterMs: 0 };
    }

    if (entry.count >= rateConfig.max) {
      return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
    }

    entry.count += 1;
    return { allowed: true, remaining: rateConfig.max - entry.count, retryAfterMs: 0 };
  }

  private getKey(context: GatewayContext, config: RateLimitConfig): string {
    const scope = config.scope || 'user';
    switch (scope) {
      case 'venture':
        return `${scope}:${context.venture}:${context.service}`;
      case 'global':
        return `${scope}:${context.service}`;
      default:
        return `${scope}:${context.venture}:${context.userId || 'anon'}`;
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

export class ResponseCache {
  private store = new Map<string, { body: unknown; expiresAt: number; timestamp: number }>();

  constructor(private readonly maxEntries = 1000) {}

  get(key: string): { body: unknown; timestamp: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return { body: entry.body, timestamp: entry.timestamp };
  }

  set(key: string, body: unknown, ttlSeconds: number) {
    if (this.store.size >= this.maxEntries) {
      this.evictOldest();
    }
    this.store.set(key, {
      body,
      expiresAt: Date.now() + ttlSeconds * 1000,
      timestamp: Date.now(),
    });
  }

  get cacheKey(): string {
    return `cache:${Math.random().toString(36).slice(2)}`;
  }

  buildKey(venture: string, path: string, query: Record<string, string>): string {
    const sortedQuery = Object.entries(query).sort(([a], [b]) => a.localeCompare(b));
    return `${venture}:${path}:${JSON.stringify(sortedQuery)}`;
  }

  private evictOldest() {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}