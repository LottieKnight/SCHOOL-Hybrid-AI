import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService, extractBearerToken, extractApiKey, verifyRequiredScopes } from '../api-gateway/auth';
import { RateLimiter, ResponseCache } from '../api-gateway/rate-limiter';
import { GatewayContext, GatewayErrorCode } from '../api-gateway/types';
import { CREDIT_RULES, getVentureDisplayName, getSourceDisplayName, isEarnSource, isSpendSource } from '../scholar-credits/types';

const auth = new AuthService('test-jwt-secret', 'test-api-key-secret');

function makeContext(overrides: Partial<GatewayContext> = {}): GatewayContext {
  return {
    userId: 1,
    venture: 'SCHOOL',
    service: 'school-service',
    scopes: ['school:read', 'school:write'],
    requestId: 'test-request',
    startedAt: Date.now(),
    ...overrides,
  };
}

describe('AuthService', () => {
  describe('API keys', () => {
    it('generates and verifies a valid API key', () => {
      const credentials = auth.createVentureCredentials('SCHOOL', ['school:read']);
      const verified = auth.verifyApiKey(credentials.apiKey);
      expect(verified).not.toBeNull();
      expect(verified?.venture).toBe('SCHOOL');
    });

    it('rejects tampered API keys', () => {
      const credentials = auth.createVentureCredentials('SCHOOL', ['school:read']);
      const tampered = credentials.apiKey.slice(0, -4) + 'AAAA';
      expect(auth.verifyApiKey(tampered)).toBeNull();
    });

    it('rejects garbage as an API key', () => {
      expect(auth.verifyApiKey('not-a-key')).toBeNull();
    });
  });

  describe('JWT', () => {
    it('signs and verifies a JWT with context', () => {
      const context = makeContext();
      const token = auth.signJWT(context);
      const verified = auth.verifyJWT(token);
      expect(verified?.userId).toBe(1);
      expect(verified?.venture).toBe('SCHOOL');
      expect(verified?.requestId).toBeTruthy();
    });

    it('rejects tampered JWTs', () => {
      const token = auth.signJWT(makeContext());
      const tampered = token.slice(0, -4) + 'ZZZZ';
      expect(auth.verifyJWT(tampered)).toBeNull();
    });

    it('rejects non-JWT strings', () => {
      expect(auth.verifyJWT('abc.def.ghi')).toBeNull();
    });
  });

  describe('HMAC', () => {
    it('verifies a correct HMAC signature', () => {
      const body = JSON.stringify({ hello: 'world' });
      const signature = (auth as any).signHMAC('SCHOOL', body);
      expect(auth.verifyHMACRequest('SCHOOL', body, signature)).toBe(true);
    });

    it('rejects an incorrect HMAC signature', () => {
      const signature = (auth as any).signHMAC('SCHOOL', 'other-body');
      expect(auth.verifyHMACRequest('SCHOOL', JSON.stringify({ hello: 'world' }), signature)).toBe(false);
    });
  });

  describe('helpers', () => {
    it('extracts bearer tokens', () => {
      expect(extractBearerToken('Bearer abc123')).toBe('abc123');
      expect(extractBearerToken('Basic abc123')).toBeNull();
      expect(extractBearerToken()).toBeNull();
    });

    it('extracts API keys', () => {
      expect(extractApiKey({ 'x-api-key': 'key123' })).toBe('key123');
      expect(extractApiKey({})).toBeNull();
    });

    it('enforces required scopes', () => {
      const context = makeContext();
      expect(verifyRequiredScopes(context.scopes, ['school:read'])).toBe(true);
      expect(verifyRequiredScopes(context.scopes, ['aura:infer'])).toBe(false);
    });
  });
});

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 60000, max: 3, scope: 'user' });
  });

  it('allows requests under the limit', () => {
    const context = makeContext();
    for (let i = 0; i < 3; i++) {
      const result = limiter.check(context);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2 - i);
    }
  });

  it('blocks requests over the limit', () => {
    const context = makeContext();
    for (let i = 0; i < 3; i++) limiter.check(context);
    const result = limiter.check(context);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('is scoped per user', () => {
    const userA = makeContext({ userId: 1 });
    const userB = makeContext({ userId: 2 });
    for (let i = 0; i < 3; i++) limiter.check(userA);
    expect(limiter.check(userB).allowed).toBe(true);
  });

  it('resets after the window', async () => {
    const shortLimiter = new RateLimiter({ windowMs: 5, max: 3, scope: 'user' });
    const context = makeContext();
    for (let i = 0; i < 3; i++) shortLimiter.check(context);
    expect(shortLimiter.check(context).allowed).toBe(false);
    await new Promise(r => setTimeout(r, 10));
    shortLimiter.cleanup();
    expect(shortLimiter.check(context).allowed).toBe(true);
  });
});

describe('ResponseCache', () => {
  it('stores and retrieves cached responses', () => {
    const cache = new ResponseCache();
    cache.set('a:key', { answer: 42 }, 60);
    expect(cache.get('a:key')).toEqual({ body: { answer: 42 }, timestamp: expect.any(Number) });
  });

  it('expires entries after TTL', () => {
    const cache = new ResponseCache();
    cache.set('a:key', { answer: 42 }, 0);
    expect(cache.get('a:key')).toBeNull();
  });

  it('evicts the oldest entry when full', () => {
    const cache = new ResponseCache(2);
    cache.set('one', { n: 1 }, 60);
    cache.set('two', { n: 2 }, 60);
    cache.set('three', { n: 3 }, 60);
    expect(cache.get('one')).toBeNull();
    expect(cache.get('two')).not.toBeNull();
    expect(cache.get('three')).not.toBeNull();
  });

  it('builds deterministic cache keys from query params', () => {
    const cache = new ResponseCache();
    const a = cache.buildKey('SCHOOL', '/x', { b: '1', a: '2' });
    const b = cache.buildKey('SCHOOL', '/x', { a: '2', b: '1' });
    expect(a).toBe(b);
  });
});

describe('Credit rules', () => {
  it('defines positive earnings', () => {
    expect(CREDIT_RULES.QUESTION_ACCEPTED.amount).toBe(20);
    expect(CREDIT_RULES.DAILY_QUIZ_COMPLETE.amount).toBe(10);
    expect(CREDIT_RULES.REFERRAL_SIGNUP.amount).toBe(500);
  });

  it('defines spend sources as negative', () => {
    expect(CREDIT_RULES.WORKSHOP_FEE.amount).toBe(-2000);
    expect(CREDIT_RULES.DATA_BUNDLE_PURCHASE.amount).toBe(-50);
  });

  it('classifies sources correctly', () => {
    expect(isEarnSource('QUESTION_ACCEPTED')).toBe(true);
    expect(isEarnSource('WORKSHOP_FEE')).toBe(false);
    expect(isSpendSource('WORKSHOP_FEE')).toBe(true);
    expect(isSpendSource('QUESTION_ACCEPTED')).toBe(false);
  });

  it('maps display names', () => {
    expect(getVentureDisplayName('AURA')).toBe('AURA AI Laboratories');
    expect(getVentureDisplayName('SPHERE')).toBe('Cryptic SPHERE');
    expect(getSourceDisplayName('QUESTION_ACCEPTED')).toBe('Answer Accepted');
    expect(getSourceDisplayName('TOURNAMENT_WIN')).toBe('Tournament Winner');
  });
});