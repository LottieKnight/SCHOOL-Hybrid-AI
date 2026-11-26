import { createGateway } from './api-gateway/gateway';
import { createGatewayClient } from './api-gateway/client';
import { CREDIT_RULES, getVentureDisplayName, getSourceDisplayName } from './scholar-credits/types';
import { AuthService } from './api-gateway/auth';
import { GatewayConfig } from './api-gateway/types';

const TEST_PORT = 8123;

function generateApiKey(auth: AuthService): string {
  return auth.generateApiKey('SCHOOL');
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   DITSHEGO VENTURES — LUDO PRINCIPLE LIVE DEMO            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const config: GatewayConfig = {
    port: TEST_PORT,
    environment: 'development',
    ventures: (await import('./api-gateway/service-registry')).buildServiceRegistry(),
    jwtSecret: 'demo-jwt-secret',
    apiKeySecret: 'demo-api-key-secret',
    defaultRateLimit: { windowMs: 60000, max: 100, scope: 'user' },
    logLevel: 'error',
  };

  const gateway = createGateway(config);
  gateway.start();

  await new Promise(r => setTimeout(r, 300));

  const auth = new AuthService('demo-jwt-secret', 'demo-api-key-secret');
  const apiKey = generateApiKey(auth);

  const client = createGatewayClient({
    baseUrl: `http://localhost:${TEST_PORT}`,
    apiKey,
    logLevel: 'none',
    retries: 0,
  });

  let pass = 0;
  let fail = 0;

  function check(name: string, condition: boolean, detail?: string) {
    if (condition) {
      pass++;
      console.log(`  ✓ ${name}`);
    } else {
      fail++;
      console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    }
  }

  console.log('─[ 1. Health check ]────────────────────────────────────────');
  const health = await client.request<{ status: string; ventures: Record<string, { status: string; routes: number }> }>({ path: '/health' });
  check('Gateway responds /health', health.body.status === 'ok');
  check('All 8 ventures registered', Object.keys(health.body.ventures).length === 8, `got ${Object.keys(health.body.ventures).length}`);
  check('SCHOOL registered with routes', (health.body.ventures.SCHOOL?.routes ?? 0) >= 4);
  check('V4NTAG3 registered', !!health.body.ventures.V4NTAG3);

  console.log('\n─[ 2. Credits balance (SCHOOL→scholar-credits) ]──────────');
  const balance = await client.getCreditsBalance();
  check('Balance endpoint returns 200', balance.status === 200);
  check('Balance is a number', typeof balance.body.balance === 'number' && balance.body.balance > 0, `got ${balance.body.balance}`);

  console.log('\n─[ 3. Earn credits (idempotent) ]──────────────────────────');
  const earn1 = await client.earnCredits({
    venture: 'SCHOOL',
    source: 'DAILY_QUIZ_COMPLETE',
    description: 'Daily quiz',
    idempotencyKey: 'quiz-2026-08-05-001',
  });
  check('Earn returns success', earn1.body.success === true);

  console.log('\n─[ 4. AI tutor (SCHOOL→AURA contract) ]───────────────────');
  const tutor = await client.askTutor({
    module: 'CMPG311',
    institution: 'NWU',
    question: 'Explain the CAP theorem',
  });
  check('Tutor returns an answer', typeof tutor.body.answer === 'string' && tutor.body.answer.length > 20);
  check('Tutor returns confidence', tutor.body.confidence >= 0 && tutor.body.confidence <= 1, `got ${tutor.body.confidence}`);
  check('Tutor returns a language', typeof tutor.body.language === 'string');

  console.log('\n─[ 5. Paper trading (SCHOOL→SPHERE contract) ]─────────────');
  const trade = await client.paperTrade({
    strategyId: 'NY-SESSION-01',
    symbol: 'STX40',
    action: 'BUY',
    quantity: 10,
  });
  check('Trade fills', trade.body.filled === true);
  check('Trade returns orderId', typeof trade.body.orderId === 'string');

  console.log('\n─[ 6. Talent search (NPC→SCHOOL contract) ]───────────────');
  const talent = await client.searchTalent({
    criteria: { institution: 'NWU', degree: 'BSc', year: 2, minimumCredits: 3000 },
    limit: 3,
  });
  check('Talent search returns candidates', talent.body.total >= 1, `got ${talent.body.total}`);
  check('Candidates have scholarCredits', talent.body.candidates.every((c: any) => typeof c.scholarCredits === 'number'));

  console.log('\n─[ 7. Tournament credits (V4NTAG3→credits) ]──────────────');
  const tournament = await client.awardTournamentCredits({
    tournamentId: 'BRAZIL-02',
    result: 'win',
    userIds: [42, 43],
  });
  check('Tournament credits awarded', tournament.body.awarded === true);

  console.log('\n─[ 8. Content generation (SCENE contract) ]───────────────');
  const content = await client.generateContent({
    contentType: 'newsletter',
    topic: 'SCHOOL module rooms launch',
    audience: 'students',
  });
  check('Content generated', typeof content.body.contentId === 'string');

  console.log('\n─[ 9. Credit rules sanity ]────────────────────────────────');
  check('QUESTION_ACCEPTED awards 20', CREDIT_RULES.QUESTION_ACCEPTED.amount === 20);
  check('REFERRAL_SIGNUP awards 500', CREDIT_RULES.REFERRAL_SIGNUP.amount === 500);
  check('INCUBATOR_ACCEPTANCE awards 2000', CREDIT_RULES.INCUBATOR_ACCEPTANCE.amount === 2000);
  check('TOURNAMENT_WIN awards 2000', CREDIT_RULES.TOURNAMENT_WIN.amount === 2000);
  check('DATA_BUNDLE_PURCHASE is a spend', CREDIT_RULES.DATA_BUNDLE_PURCHASE.amount < 0);
  check('Source display names map', getSourceDisplayName('QUESTION_ACCEPTED') === 'Answer Accepted');
  check('Venture display names map', getVentureDisplayName('AURA') === 'AURA AI Laboratories');

  console.log('\n─[ 10. Auth & error handling ]─────────────────────────────');
  const badClient = createGatewayClient({ baseUrl: `http://localhost:${TEST_PORT}`, logLevel: 'none', retries: 0 });
  try {
    await badClient.getCreditsBalance();
    check('Unauthenticated request rejected', false);
  } catch (e: any) {
    check('Unauthenticated request rejected', e.status === 401, `got ${e.status}`);
  }

  try {
    await client.request({ path: '/nonexistent-route' });
    check('Unknown route rejected', false);
  } catch (e: any) {
    check('Unknown route rejected', e.status === 404, `got ${e.status}`);
  }

  console.log('\n─[ 11. Cache (GET should be cached) ]──────────────────────');
  const firstRead = await client.getCommunityPosts();
  const secondRead = await client.getCommunityPosts();
  check('Second read served from cache', secondRead.fromCache === true, `cache=${secondRead.fromCache}`);

  gateway.stop();

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log(`║   RESULT: ${pass} passed, ${fail} failed                            ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Demo failed:', e);
  process.exit(1);
});