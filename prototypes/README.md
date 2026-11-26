# Ditshego Ventures — Cross-Venture Prototypes

Three production-ready prototypes demonstrating the **Ludo Principle** in action across the Ditshego Ventures ecosystem.

## What's here

### 1. Offline-First PWA (`offline-pwa/`)
Makes SCHOOL truly data-light for South African connections.

- **Service worker** (`sw.js`) — cache-first for static assets, network-first for APIs, offline queue for mutations
- **IndexedDB wrapper** (`offline-db.ts`) — sync queue, cached content, user data, credits ledger with `synced` flags
- **React hooks** (`useOffline.ts`) — `useOfflineStatus`, `useOfflineMutation`, `useOfflineCredits`, `useCachedData`
- **PWA manifest** (`manifest.json`) — installable, 11-language-ready, 8 icon sizes, shortcuts to AI tutor / past papers / quiz / planner
- **Offline page** (`OfflinePage.tsx`) — shows cached modules, pending sync count, retry with connection detection
- **PWAProvider** (`PWAProvider.tsx`) — online/offline banner, update-available toast, auto-reload on new version

### 2. Unified Scholar Credits (`scholar-credits/`)
One economy across SCHOOL, AURA, SPHERE, NPC, ROCKIT, SCENE, LOGISTICS, V4NTAG3.

- **Schema** (`schema.prisma`) — 10 models: users, credit wallets, transactions, streaks, venture profiles, redemptions, rate limits, audit log
- **Types** (`types.ts`) — 9 ventures, 8 transaction types, 40+ earning sources with per-source rules (amount, daily caps, cooldowns)
- **Service** (`credits-service.ts`) — Prisma transactions, idempotency keys, rate limiting, streak tracking, audit logging, balance checks
- **API routes** (`api/credits/routes.ts`) — Fastify routes for balance, earn, spend, transfer, redeem, history, redemptions, offline sync

### 3. Venture API Gateway (`api-gateway/`)
The connective tissue — every venture talks to every other through one authenticated gateway.

- **Types** (`types.ts`) — service registry, routes, rate limits, caching, transforms, inter-venture contracts (SCHOOL→AURA tutor, NPC→SCHOOL talent, SCHOOL→SPHERE paper trade, V4NTAG3 credits, SCENE content, ROCKIT lessons, LOGISTICS quotes)
- **Auth** (`auth.ts`) — HMAC-signed API keys, JWT session tokens, timing-safe signature verification, scope enforcement
- **Rate limiter + cache** (`rate-limiter.ts`) — sliding-window rate limits per user/venture/global, TTL cache with eviction
- **Service registry** (`service-registry.ts`) — 8 ventures, 15+ routes, all contracts defined
- **Gateway server** (`gateway.ts`) — HTTP server, route matching, auth pipeline, caching, audit logging, health endpoint
- **Client SDK** (`client.ts`) — typed helpers for every contract: `earnCredits`, `askTutor`, `paperTrade`, `searchTalent`, `awardTournamentCredits`, `generateContent`, etc.

## How they fit the Ludo Principle

```
                    ┌─────────────────────┐
                    │   Ditshego Gateway   │
                    │   (API Gateway)      │
                    └──┬───────┬──────────┘
         auth/rate     │       │     cache/transform
                 ┌─────▼──┐  ┌▼──────┐
                 │ SCHOOL │  │ AURA  │──► AI tutor answers
                 │ credits│  │ SPHERE│──► paper trading
                 └────┬───┘  └───────┘
                      │  unified Scholar Credits ledger
              ┌───────┼──────────┬───────────────┐
              ▼       ▼          ▼               ▼
            NPC    V4NTAG3     SCENE          ROCKIT/LOGISTICS
```

- A student earns credits in SCHOOL (quiz, games, past papers) → those credits are spendable at NPC workshops, V4NTAG3 tournaments, or data bundles
- SCHOOL community data feeds AURA training; AURA tutor answers earn credits in SCHOOL
- NPC finds incubator talent through SCHOOL profiles; those founders become SPHERE traders
- **Offline PWA** keeps credits minting even on zero-data commutes, syncing when back online

## Quick start

### Prisma schema
```bash
cd prototypes/scholar-credits
npx prisma db push  # or migrate dev
```

### API server (credits)
```bash
npx tsx api/credits/routes.ts
```

### Gateway
```bash
npx tsx api-gateway/gateway.ts
```

### PWA
Copy `offline-pwa/sw.js`, `manifest.json` to your public dir, register:
```ts
import { registerServiceWorker } from './prototypes/offline-pwa/offline-db';
registerServiceWorker();
```

## Example: cross-venture credit flow
```ts
import { createGatewayClient } from './api-gateway/client';

const client = createGatewayClient({ baseUrl: 'http://localhost:8080', apiKey: process.env.SCHOOL_API_KEY });

// Student completes a quiz in SCHOOL offline
await client.earnCredits({ venture: 'SCHOOL', source: 'DAILY_QUIZ_COMPLETE', description: 'Daily quiz', idempotencyKey: 'quiz-2026-08-05' });

// Spend credits on an NPC incubator workshop
await client.spendCredits({ venture: 'NPC', source: 'WORKSHOP_FEE', amount: 2000, description: 'Entrepreneurship workshop', idempotencyKey: 'ws-2026-08-05' });

// V4NTAG3 awards tournament winnings as credits
await client.awardTournamentCredits({ tournamentId: 'BRAZIL-02', result: 'win', userIds: [42], idempotencyKey: 't-2026-08-05' });
```

## Security notes
- All secrets are placeholders (`dev-*`); swap for env vars in production
- API keys are HMAC-signed, expiring, and scope-bound
- Idempotency keys prevent double-spend on retries (auto-generated by the SDK for all mutations)
- Credit transactions run in Prisma transactions with balance audit
- Cross-venture access is explicit: a venture can only call another venture's routes through a declared **grant** (`grants` in `service-registry.ts`), never implicitly

## Verification

```bash
# 1. Generate the local Prisma client (safe — isolated from the repo's client)
npx prisma generate --schema prototypes/scholar-credits/schema.prisma

# 2. Typecheck
npx tsc -p prototypes/tsconfig.json

# 3. Unit + integration tests (36 tests)
npx vitest run --root prototypes

# 4. Live end-to-end demo (26 checks: auth, grants, caching, contracts)
npx tsx prototypes/demo.ts
```
