# Production Deploy Runbook — SCHOOL Academic Platform

> **Status: deploy-ready.** This is a complete, tested, deploy-ready changeset.
> The repository contains **no git** and **no cloud credentials** are available in
> this environment, so "shipping to production" = this reviewed changeset + this
> runbook + a credentialed operator running the final `git push` / Railway /
> Vercel steps.

## 0. What this release contains

A set of fixes and route-wiring that take the platform from a red baseline to a
green one, plus CI that now actually gates the shipping apps.

| Area | Change | Files |
|------|--------|-------|
| Migrations | Fixed 070 (missing `slug`) and 088 (unguarded backfill against a non-existent `notifications` table). Chain 001–089 now applies cleanly. | `apps/api/migrations/070_*.sql`, `088_*.sql` |
| Auth | Restored `AUTH_EMAIL_NOT_FOUND` / `AUTH_WRONG_PASSWORD` 401 codes; added `POST /auth/reset-password`; re-exported `inferInstitutionShortName`. | `apps/api/src/routes/auth/{session,tokens,tokens}.ts` (+`auth.ts`) |
| Analytics API | Wired `GET /analytics/dashboard-summary` (cached, role-aware) + write endpoints (`lesson-engagement`, `quiz-attempt`, `lesson-checkpoints`, `spaced-reviews`) with cache invalidation; auth-gated 501 stubs for adaptive endpoints. | `apps/api/src/routes/analytics.ts` |
| Admin API | Added `GET /admin/monetisation`, `GET /admin/impact/inclusion`, `GET/POST /admin/monetisation/experiments`, plus 501 stubs for `learning-analytics` / `funnels/*`. Snake_case JSON contract. | `apps/api/src/routes/admin.ts` |
| Web build | Fixed two missing-module errors (`ExamCountdownWidget`, `GradeCalculator` imported `.ts` via a `.js` specifier that webpack couldn't resolve) + a client-component that pulled node built-ins (`pg` → `fs/dns/net/tls`) into the browser bundle via the `@saedu/shared` db barrel; resolved by adding an `@saedu/shared/sm2` subpath export (matches the existing `./curriculum` pattern). | `apps/web/components/{ExamCountdownWidget,GradeCalculator,FlashcardDeck}.tsx`, `packages/shared/package.json` |
| CI | Removed duplicate shadowed `apps/web-ui` build jobs that masked the real pipeline; made `lint` a hard gate (was `continue-on-error`); `lint`/`typecheck`/`test`/`build` now run at the repo root, covering `apps/web` + `apps/api`. | `.github/workflows/ci.yml` |
| Community | Added `POST /community/posts/:id/accept` — the post author accepts a comment as the answer and the answer author is awarded **20 Scholar Credits** via the idempotent `creditWallet` ledger (idempotency key `community:accepted_answer:<commentId>`); the resulting ledger entry doubles as the replay-safe proof-of-progress event. No migration needed (`posts.accepted_answer_id` already exists in `055_community.sql` with its FK to `comments.id`). | `apps/api/src/db/community.ts`, `apps/api/src/routes/community.ts` |

## 1. Architecture reminder

- **`apps/api`** — Fastify (~600 routes), Node 20, deployed on **Railway**. Owns: auth/session/CSRF, messaging, tutors, university, bursary, credits, community, wallet, analytics, press. Postgres (main DB) + Redis.
- **`apps/web`** — Next.js 16 App Router (`--webpack`), deployed on **Vercel**. Past papers use a separate Prisma **SQLite** DB (`apps/web/prisma/schema.prisma`, `PAST_PAPERS_DATABASE_URL`); everything else proxies to the API via `apps/web/lib/server/backendApi.ts`.
- **`packages/shared`** — shared content/curriculum/SM2/RAG types; built with `tsc`.

## 2. Pre-deploy checklist

1. **Green baseline** (verified locally, see §8): `npm run lint` (0 errors), `npm run typecheck` (exit 0), `npm run test` (47 shared + 152 api = 199 pass), `npm run build` (shared + api + web all succeed).
2. **Migrations**: `cd apps/api && npm run migrate` (or `npm run db:migrate`) applies 001–089 with `ROLLBACK` on failure; applied files are recorded in `schema_migrations(id, run_at)`. Run against a **staging** Postgres first.
3. **Smoke the new routes** against staging (unauthenticated → expect 401; authenticated → contract check per `test/run-all.test.ts`).

## 3. Environment keys to provision

### API (Railway) — required
| Key | Source | Notes |
|-----|--------|-------|
| `DATABASE_URL` | Postgres pooler | **Port 5432**, role `saedu` (superuser). See §6 — `.env.example` says 5433; the running container binds **5432**. |
| `REDIS_URL` | Redis | `redis://...:6379` |
| `JWT_SECRET` | — | ≥32 chars, random |
| `COOKIE_SECRET` | — | ≥32 chars, random |
| `MESSAGE_ENCRYPTION_KEY` | Secret manager | **Required for messaging**; 32 random bytes encoded as 64-character hex or base64. Never commit or reuse across environments. |
| `ADMIN_EMAILS` | — | comma-separated admin principals |
| `OPENAI_API_KEY` | OpenAI | RAG + lesson generation |
| `RESEND_API_KEY` | Resend | transactional email |
| `SENTRY_DSN` | Sentry | error tracking |
| `ALLOW_DEMO_AUTH` | — | `false` in prod |
| `ALLOW_FAKE_PHONE_VERIFY` | — | `false` in prod |
| `WALLET_CREDITS_PER_ZAR` | — | `100` (100 credits = R1) |
| `WALLET_DETAILED_REPORT_CREDITS` | — | `15` |

### API — payment (ZAR)
PayFast is the ZAR processor (`apps/api/src/lib/payfast.ts`, `apps/api/src/routes/wallet.ts`):
`PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX` (= `false`), `PAYFAST_IPS` (webhook allow-list).
Stripe is present for card fallback: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Either rail satisfies `POST /wallet/topup/create`.

### Web (Vercel) — required
| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_API_BASE_URL` | API origin (e.g. `https://<railway>.up.railway.app`) |
| `NEXT_PUBLIC_SITE_URL` | `https://school.ditshego-ventures.co.za` |
| `PAST_PAPERS_DATABASE_URL` | `file:./past-papers.db` (SQLite, per-route Prisma) |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT` | past-paper PDF/object storage |
| `NEXT_PRIVATE_API_BASE_URL` | fallback for server-side `backendApi.ts` |

> The web build needs the Prisma client generated (`npm run db:past-papers:generate` =
> `node tools/prisma-generate-safe.mjs`). Vercel's build step should run
> `npm run db:past-papers:generate` (or rely on the workspace `predev`/`build` hook).

## 4. Deploy sequence

### Step 1 — API (Railway)
The `apps/api/Dockerfile` is a multi-stage `node:20-alpine` build whose `CMD` is
`node apps/api/dist/index.js` **without** running migrations. The repo ships a
migration entrypoint specifically for this: `apps/api/migrate-and-start.sh`, which
runs `apps/api/run-migrations.ts` (idempotent, tracks `schema_migrations`) and then
execs the server.

**Railway "Start Command"** → `sh ./apps/api/migrate-and-start.sh`
(or run `npx tsx apps/api/run-migrations.ts` as a **release phase** before the normal start).

Migration runner semantics (`src/db/migrate.ts` + `run-migrations.ts`):
- Creates `schema_migrations` if absent.
- Applies every `*.sql` in `apps/api/migrations/` not yet recorded, inside a `BEGIN/COMMIT`;
  **ROLLBACKs on failure** so failed migrations are never recorded and can be edited+re-run.
- Safe to re-run (idempotent `ON CONFLICT`/`DO NOTHING` seeds).

### Step 2 — Web (Vercel)
- Project root: repo root (or `apps/web` if a subdirectory deploy).
- Build command: `npm run build -w apps/web` (which runs `ensure-next-lock.mjs` after `next build --webpack`).
- Pre-generate the past-papers Prisma client.
- Output: `.next` (standalone). `next.config.mjs` already sets `outputFileTracingRoot` to the monorepo root and excludes `.next/cache`, `*.pack`, mobile, and api dirs from the trace so Vercel deployments stay under limits.

### Step 3 — Verify & cut over
After both deploy: health probe, auth flow, one authenticated `GET /analytics/dashboard-summary` (expect `x-dashboard-cache`/`cache-control: private`), and `GET /admin/monetisation` as an admin (snake_case shape).

## 5. Rollback matrix

| Layer | Rollback action |
|-------|-----------------|
| API code | Railway "redeploy previous deployment" (the image tag from the prior build). |
| DB schema/data | `schema_migrations` records each applied file; revert by redeploying the prior code image. **Schema migrations are NOT auto-reverted** — data migrations within them require a manual reverse SQL file in `apps/api/migrations/revert/...` (none in this release). For 070/088 the changes are idempotent seeds/guards, so rollback is a no-op data-wise. |
| Web | Vercel "rollback to previous production deployment". |
| Env/config | Restore secrets to the previous versions; no code change needed (env-injected at boot). |
| Payments | `WALLET_CREDITS_PER_ZAR` / `WALLET_DETAILED_REPORT_CREDITS` are read at runtime; rolling back code while keeping env is safe. |

## 6. Gotchas

- **Postgres port**: `.env.example` documents `POSTGRES_PORT=5433`, but the running
  container in this environment binds `5432:5432`. The API never reads `POSTGRES_PORT` —
  it uses `DATABASE_URL` directly. Use port **5432**.
- **`saedu` Postgres role** is a `SUPERUSER` (created with `LOGIN SUPERUSER`); used for
  migrations and test setup. Do not create a separate superuser unless required.
- **`@saedu/shared` barrel** re-exports `gen/db.js` (→ `pg` → node built-ins). Do **not**
  import the `.` entry into a **client** `"use client"` component; use a subpath export
  (`./curriculum`, `./sm2`) for pure client-side functions. Server components/API routes
  may use the full barrel.
- **`ALLOW_DEMO_AUTH` / `ALLOW_FAKE_PHONE_VERIFY` must be `false`** in production.
- **Node**: target `20.19.5` (`.nvmrc`); engines `>=18 <25`. CI pins 20.19.5.
- **CI**: the quality gate now reports a single `ci-gate` status check (depends on
  `changes, static, test, build, migrate`, `if: always()`). Branch protection should
  require the `CI` check.

## 7. Post-deploy verification

```bash
API=https://<railway>.up.railway.app
# Unauthenticated → 401 (route exists + auth-guarded)
curl -s -o /dev/null -w "%{http_code}\n" $API/analytics/dashboard-summary          # 401
# Authenticated → 200 + cache headers
TOK=...  # valid JWT for a learner
curl -s -o /dev/null -w "cache:%{header_json}\n" \
  -H "Authorization: Bearer $TOK" $API/analytics/dashboard-summary        # x-dashboard-cache: miss
curl -si $API/analytics/dashboard-summary -H "Authorization: Bearer $TOK" \
  | grep -iE 'cache-control|x-dashboard-cache'                           # private / miss
curl -s -o /dev/null -w "%{http_code}\n" $API/analytics/dashboard-summary   # 200, x-dashboard-cache: hit
# Admin monetisation (snake_case)
curl -s $API/admin/monetisation -H "Authorization: Bearer $ADMIN_TOK"; echo
# Health + migrations
curl -s $API/health
```

## 8. Verified green baseline (this environment)

| Step | Command | Result |
|------|---------|--------|
| Lint | `npm run lint` (root: web + api) | **0 errors** (19 web + 9 api warnings, advisory) |
| Typecheck | `npm run typecheck` (lesson-boundary + web + api) | **exit 0** |
| Tests | `npm run test` (shared + api) | **199 pass / 0 fail** (47 shared + 152 api) |
| Migrations | `npx tsx src/db/migrate.ts` | **exit 0**, 97 recorded on `saedu` + `test` DBs |
| Build | `npm run build -w apps/web` | `✓ Compiled successfully` |
| CI | `.github/workflows/ci.yml` YAML parse | **valid**; single `on:`/`jobs:`; lint gating |

**Operator action:** review this diff, run `git add -A && git commit -m "chore: green build + analytics/admin wiring + CI fix" && git push origin main`, then trigger the Railway deploy (start command `sh ./apps/api/migrate-and-start.sh`) and the Vercel production deploy.
