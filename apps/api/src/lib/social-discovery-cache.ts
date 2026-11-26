export const SOCIAL_DISCOVERY_CACHE_TTL_MS = 20_000;
const SOCIAL_DISCOVERY_CACHE_MAX_ENTRIES = 1_500;

type SocialDiscoveryCacheEntry = {
  payload: unknown;
  expiresAt: number;
};

const socialDiscoveryCache = new Map<string, SocialDiscoveryCacheEntry>();

function pruneSocialDiscoveryCache(nowMs: number) {
  for (const [key, entry] of socialDiscoveryCache.entries()) {
    if (entry.expiresAt <= nowMs) {
      socialDiscoveryCache.delete(key);
    }
  }

  while (socialDiscoveryCache.size > SOCIAL_DISCOVERY_CACHE_MAX_ENTRIES) {
    const oldestKey = socialDiscoveryCache.keys().next().value;
    if (!oldestKey) break;
    socialDiscoveryCache.delete(oldestKey);
  }
}

export function getSocialDiscoveryCacheEntry<T>(
  key: string
): { payload: T; ttlMs: number } | null {
  const nowMs = Date.now();
  const existing = socialDiscoveryCache.get(key);
  if (!existing) return null;
  if (existing.expiresAt <= nowMs) {
    socialDiscoveryCache.delete(key);
    return null;
  }

  return {
    payload: existing.payload as T,
    ttlMs: Math.max(0, existing.expiresAt - nowMs),
  };
}

export function setSocialDiscoveryCacheEntry(key: string, payload: unknown) {
  const nowMs = Date.now();
  pruneSocialDiscoveryCache(nowMs);
  socialDiscoveryCache.set(key, {
    payload,
    expiresAt: nowMs + SOCIAL_DISCOVERY_CACHE_TTL_MS,
  });
}

export function clearSocialDiscoveryCache(input?: { userId?: string }) {
  const userId = input?.userId?.trim();
  if (!userId) {
    socialDiscoveryCache.clear();
    return;
  }

  const prefix = `${userId}|`;
  for (const key of socialDiscoveryCache.keys()) {
    if (key.startsWith(prefix)) {
      socialDiscoveryCache.delete(key);
    }
  }
}
