# Production Audit — school.ditshego-ventures.co.za

**Audited:** 2026-09-20 · **Method:** live HTTP probes + real Chromium sessions (Playwright) at 390×844 / 834×1194 / 1440×900 + Railway CLI status + source cross-check.

> **Headline: the deployed platform's backend infrastructure is down.** Row 1–3 are P0 and block every authenticated flow.

---

## 1. Infrastructure status (Railway CLI + direct probes)

| Resource | Status | Evidence |
|---|---|---|
| **`school-api` (Fastify backend, Railway)** | **● FAILED** | `railway status` → `status: Failed`; direct probes to `https://school-api-production-2ff7.up.railway.app`: `/health` 404, `/` 404, `/auth/session` 404, `/analytics/dashboard-summary` 404, `/community/feed` 404, `/credits/balance` 404, `/curriculum/outline` 404 — **every** route 404 = service not serving |
| **Redis (Railway)** | **○ OFFLINE** | `railway status` → `Databases: Redis: ○ Offline` |
| **Supabase Postgres** | **PAUSED since 2026-09-01** | `docs/engineering/OPS_TRIAGE_20260914.md` (#2 — owner restore required). Web-serverless routes read `POSTGRES_URL` (Supabase) for `user_xp_ledger`, planner, etc. |
| **`saedu-api-server` (ECS alternative backend)** | **5 failed prod deploys** | `docs/engineering/OPS_TRIAGE_20260914.md` (#5 — blocked by GHA PAT scope) |
| Vercel web app | Running | SSR/static renders OK; routes hit dead backend below |

## 2. Authentication — BROKEN (P0)

| Probe | Result | Meaning |
|---|---|---|
| `POST /api/auth/login` (dummy creds) | **404** | Login route resolves to dead backend |
| `POST /api/auth/register` (dummy) | **404** | Registration broken |
| `GET /api/auth/session` | **404** | Session detection broken |
| Direct `GET /auth/session` on backend | **404** | Backend has no serving routes |

Every page logs a console 404 for the `session` resource (the client `SessionProvider` fetch). A user cannot log in, register, or be recognised as signed in through the primary web app.

## 3. Broken routes found live

| Route | Live status | Root cause |
|---|---|---|
| `/planner` | **500** (SSR), client then bounces to `/onboarding/university` which also **500** | Server component hits DB/backend |
| `/onboarding/university` | **500** | Server component hits DB/backend |
| `/community/leaderboard` | **500** | `getCommunityLeaderboard()` throws during SSR (DB down); page uses inline `style={}` (see CSP) |
| `/dashboard` (guest) | 200 w/ error boundary: hydration error #418, `TypeError: Cannot read properties of undefined (reading 'length')` (chunk `app/dashboard/page-*.js`), 401s on `briefing/mentor-match/daily/me/quests`, 500s from leaderboard API | Guest path fires authed calls and crashes in a child component |
| `/api/leaderboard/weekly`, `/api/leaderboard/institutions` | **500** | `user_xp_ledger` in paused Supabase; Redis offline |
| `/classes` | **404** | Legacy root with no page (only `/classes/[classId]/*` redirects) |
| `/api/health` and all proxied `/api/*` (community/feed, credits/balance, wallet/balance, curriculum/outline, bursaries/facets, tutors/config, library/resources, messages) | **404** | Proxy → dead backend |

## 4. Cross-cutting web defects

1. **CSP breaks inline styles (P1).** `style-src 'self' 'nonce-…' 'unsafe-inline'` — with a nonce present, `'unsafe-inline'` is ignored per spec, so every runtime `style` attribute is blocked. Console error on **every** page. Sources include Framever-style motion style mutations and literal inline `style={}` props (e.g. the leaderboard `main`/`h1`). Fix: add `style-src-attr 'unsafe-inline'` (keeps nonce for `<style>` elements) or refactor inline styles.
2. **sitemap.xml / canonical drift (P1).** Every `<loc>` is `https://school.ac.za/…` — a different domain than the product (`school.ditshego-ventures.co.za`). Site map is incorrect/misleading.
3. Guest handling in `DashboardHomeClient` fires authenticated endpoints (`briefing`, `mentor-match`, `daily`, `me`, `quests`) and throws `TypeError … 'length'` (P1 — see §3).
4. `docs/engineering/OPS_TRIAGE_20260914.md` documents Supabase paused and the PAT-blocked deploys — infra runway is owner-gated (money/GHA PAT).

## 5. What is healthy (do not churn)

- Security headers: strong CSP, HSTS (2y), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, sensible `permissions-policy`/`referrer-policy`. ✅
- SSG/ISR shell loads; `/`, `/learn`, `/past-papers`, `/community`, `/assistant`, `/marketplace`, legal pages all 200.
- Guest protection for `/university/learning` → `/auth?next=…` redirect works. ✅
- Past-papers (SQLite Prisma on Vercel) independent of dead backend. ✅
- Mobile shell: single-column at ≤640px, safe-area insets, 44px touch targets, bottom nav (verified in earlier de-sign audit). ✅

## 6. Priority outcome

1. **P0-infra (owner-gated):** restore Supabase, redeploy `school-api` on Railway, restore Redis → auth + proxied APIs come back.
2. **P0-code (safe to do now):** dashboard guest crash + leaderboard/planner graceful error states (no raw 500s), `/classes` 404 cleanup.
3. **P1-code:** CSP inline-style fix, sitemap domain fix, guest-401 silencing, hydration error cleanup.
4. **P2:** design-system token migration once core loop is healthy.

Full route-by-route inventory: `docs/release/ROUTE_INVENTORY_20260920.md`.