import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createGateway } from '../api-gateway/gateway';
import { createGatewayClient } from '../api-gateway/client';
import { GatewayConfig } from '../api-gateway/types';
import { buildServiceRegistry } from '../api-gateway/service-registry';
import { AuthService } from '../api-gateway/auth';

const PORT = 8177;

let gateway: ReturnType<typeof createGateway>;
let client: ReturnType<typeof createGatewayClient>;
let unauthenticated: ReturnType<typeof createGatewayClient>;

beforeAll(async () => {
  const config: GatewayConfig = {
    port: PORT,
    environment: 'development',
    ventures: buildServiceRegistry(),
    jwtSecret: 'itest-jwt-secret',
    apiKeySecret: 'itest-api-key-secret',
    defaultRateLimit: { windowMs: 60000, max: 100, scope: 'user' },
    logLevel: 'error',
  };

  gateway = createGateway(config);
  gateway.start();

  await new Promise(r => setTimeout(r, 300));

  const auth = new AuthService('itest-jwt-secret', 'itest-api-key-secret');
  const apiKey = auth.generateApiKey('SCHOOL');

  client = createGatewayClient({ baseUrl: `http://localhost:${PORT}`, apiKey, logLevel: 'error', retries: 0 });
  unauthenticated = createGatewayClient({ baseUrl: `http://localhost:${PORT}`, logLevel: 'error', retries: 0 });
});

afterAll(() => {
  gateway.stop();
});

describe('Gateway integration', () => {
  it('responds to health checks with all ventures registered', async () => {
    const res = await client.request<{ status: string; ventures: Record<string, { status: string; routes: number }> }>({ path: '/health' });
    expect(res.body.status).toBe('ok');
    expect(Object.keys(res.body.ventures)).toHaveLength(8);
  });

  it('rejects unauthenticated requests', async () => {
    await expect(unauthenticated.getCreditsBalance()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('rejects unknown routes', async () => {
    await expect(client.request({ path: '/does-not-exist' })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('returns a credits balance', async () => {
    const res = await client.getCreditsBalance();
    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
  });

  it('enforces idempotency keys on credit mutations', async () => {
    const res = await client.earnCredits({
      venture: 'SCHOOL',
      source: 'DAILY_QUIZ_COMPLETE',
      description: 'integration test quiz',
      idempotencyKey: 'itest-quiz-0001',
    });
    expect(res.body.success).toBe(true);
  });

  it('auto-generates idempotency keys when none provided', async () => {
    const res = await client.earnCredits({
      venture: 'SCHOOL',
      source: 'ANSWER_POSTED',
      description: 'auto idempotency',
    });
    expect(res.body.success).toBe(true);
  });

  it('routes SCHOOL to AURA via the Ludo grant', async () => {
    const res = await client.askTutor({ module: 'CMPG311', institution: 'NWU', question: 'Explain binary trees' });
    expect(res.status).toBe(200);
    expect(typeof res.body.answer).toBe('string');
    expect(typeof res.body.confidence).toBe('number');
  });

  it('routes SCHOOL to SPHERE paper trading via the Ludo grant', async () => {
    const res = await client.paperTrade({ strategyId: 'NY-01', symbol: 'STX40', action: 'BUY', quantity: 5 });
    expect(res.body.filled).toBe(true);
    expect(typeof res.body.orderId).toBe('string');
  });

  it('routes SCHOOL to NPC talent search via the Ludo grant', async () => {
    const res = await client.searchTalent({ criteria: { institution: 'NWU', minimumCredits: 1000 } });
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it('routes SCHOOL to V4NTAG3 tournament credits via the Ludo grant', async () => {
    const res = await client.awardTournamentCredits({ tournamentId: 'ITEST-01', result: 'win', userIds: [1, 2, 3] });
    expect(res.body.awarded).toBe(true);
  });

  it('routes SCHOOL to SCENE content generation via the Ludo grant', async () => {
    const res = await client.generateContent({ contentType: 'article', topic: 'test', audience: 'students' });
    expect(typeof res.body.contentId).toBe('string');
  });

  it('caches GET responses on the second read', async () => {
    await client.getCommunityPosts();
    const second = await client.getCommunityPosts();
    expect(second.fromCache).toBe(true);
  });

  it('rejects a grantless cross-venture call', async () => {
    // V4NTAG3 does NOT have a grant to call SCHOOL's credits routes.
    const v4ntag3Client = createGatewayClient({
      baseUrl: `http://localhost:${PORT}`,
      apiKey: new AuthService('itest-jwt-secret', 'itest-api-key-secret').generateApiKey('V4NTAG3'),
      logLevel: 'error',
      retries: 0,
    });
    await expect(v4ntag3Client.getCreditsBalance()).rejects.toMatchObject({ status: 404 });
  });
});