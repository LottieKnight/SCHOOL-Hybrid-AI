# SCHOOL MVP Operations Runbook

Last updated: 2026-02-27

## 1) MVP loop walkthrough

Primary loop:
`Learn -> Past Papers -> Marking/Feedback -> Progress -> Wallet Spend (credits)`

Current flow in this repository:

1. Learn
   - Learner enters lesson routes under `/learn/*`.
   - Lite mode toggle is available and persisted (`apps/web/lib/liteMode.ts`).
2. Past papers
   - Learner attempts papers from `/classes/[classId]/past-papers/*`.
   - Attempt review path is rendered in web app, with ownership checks and entitlement-aware shaping.
3. Marking/feedback
   - Free summary is returned by default.
   - Detailed report fields remain hidden until entitlement is present.
4. Progress
   - Attempt analytics and unlock markers are stored in past-paper attempt analytics JSON (web SQLite domain).
5. Wallet spend
   - Unlock action posts to `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`.
   - That route debits API wallet credits through `POST /wallet/debit` using deterministic idempotency key:
     - `past-paper:detailed-report:{userId}:{attemptId}`
   - On successful debit, web stores an entitlement marker for that attempt.

## 2) Wallet pricing and micro-billing rationale

Source of truth:
- Pricing config: `apps/api/src/lib/pricing-config.ts`
- Wallet helpers: `apps/api/src/lib/wallet-pricing.ts`
- Env backing: `WALLET_CREDITS_PER_ZAR`, `WALLET_DETAILED_REPORT_CREDITS`

Current pricing parameters:
- `currency`: `ZAR`
- `creditsPerZar`: env-driven (default `100`)
- `minTopupZar`: `0.10`
- `maxTopupZar`: `2000.00`
- `detailedReportCredits`: env-driven (default `15`)

Why this supports micro-billing:
- `100 credits = R1.00` means:
  - R0.10 maps to 10 credits
  - R2.00 maps to 200 credits
- This allows low-friction pricing for small unlock actions while keeping integer ledger math.

Wallet API ownership:
- `GET /wallet/balance`
- `POST /wallet/debit` (auth + idempotency key required)
- `POST /wallet/credit` (admin only)
- `POST /wallet/topup/create`
- `POST /wallet/webhooks/:provider` (idempotent by stored webhook event id)

## 3) Inclusion and lite-mode behavior

Lite mode is first-class:
- State utilities: `apps/web/lib/liteMode.ts`
- UI toggle: `apps/web/components/LiteModeToggle.tsx`
- Global style reductions: `apps/web/app/globals.css` under `.lite-mode` selectors

Route-level inclusion behaviors currently wired:
- `/learn` surfaces consume lite mode in learner components (resource/video behavior).
- `/messages` now:
  - uses server route shell + split client modules
  - lazy-loads heavy attachments/moderation panels
  - starts SSE only after active thread selection
  - keeps one active SSE stream per client view and uses bounded reconnect backoff
  - suppresses attachment quota panel in lite mode
  - uses low-bandwidth attachment rendering path in lite mode

Performance guardrails for MVP contributions:
- Keep `/learn` and `/classes/*/past-papers/*` server-first; avoid new client-only heavy dependencies.
- Keep `/messages` heavy tools lazy-loaded; do not re-monolith route code.
- Keep streaming/offline/network-heavy behavior opt-in per thread/user action.

## 4) Equipment quote-only operations

Equipment commerce is quote-only for MVP:
- Quote API: `POST /api/equipment/quote`
- Store path: `apps/web/lib/equipmentStoreServer.ts`
- Validation/abuse controls: `apps/web/lib/equipmentQuoteGuard.ts`
- Admin quote ops UI: `/admin/equipment/quotes`
- Admin quote APIs:
  - `GET /api/admin/equipment/quotes`
  - `PATCH /api/admin/equipment/quotes/:quoteId`
  - `GET /api/admin/equipment/quotes/export` (CSV)
  - `POST /api/admin/equipment/quotes/cleanup`

Rules:
- No equipment payment capture.
- No paid order persistence for equipment.
- Quote records remain quote records (minimal PII posture).
- Quote request payload accepts only minimal follow-up fields (`organizationName`, `province`, `contactEmail`) with clear purpose.
- Endpoint uses validation + honeypot + rate limit controls.
- Quote retention is bounded by `EQUIPMENT_QUOTE_RETENTION_DAYS` (default 30) with cleanup available at:
  - `POST /api/admin/equipment/quotes/cleanup?olderThanDays=30` (admin-only)

## 5) Security invariants (must stay true)

1. Plan entitlement grants only via:
   - verified billing webhook path, or
   - admin-only upgrade action with audit event.
2. Fake phone verification path is unreachable in production unless explicit non-prod override is enabled.
3. Demo auth fallbacks are unreachable in production unless explicit non-prod override is enabled.
4. Cookie-auth write endpoints require CSRF header/token match.
5. Wallet debit and webhook processing are idempotent and persisted by unique keys.

## 6) Local run + env + webhook testing notes

## 7) Impact scorecard v1 metric definitions

Admin endpoint:
- `GET /admin/impact/summary?range=7d|30d`

Definitions in current implementation:
- `DAU`: distinct active users in the last 24h from activity union (`quiz_attempts_v2`, `lesson_engagements`, `messages`, `product_events`) inside the selected range.
- `WAU`: distinct active users in the last 7 days from the same activity union.
- `attemptsSubmittedPerDay`: daily count from `quiz_attempts_v2.created_at`.
- `avgScoreImprovementAttempt1To2`: average `(attempt2 - attempt1)` score delta per learner+lesson pair in selected range.
- `unlockConversionRatePercent`: `past_paper_detailed_report` wallet debits divided by total quiz attempts in range.
- `liteModeUsagePercent`: percent of active users in range where `user_profiles.lite_mode = true`.
- `medianTtiProxyMs`: median of `product_events.event_name = perf_page_load` `metadata.ttiMs` samples in range.
- `creditsSpentPerImprovementUnit`: total wallet debited credits divided by total positive score improvement points in paired attempts.

Operational notes:
- A client telemetry beacon posts `perf_page_load` samples to `/analytics/perf-sample` (auth + CSRF).
- If a metric has no source rows in range, scorecard returns `0` to keep shape stable for dashboards.

### Local run
1. `npm install`
2. `docker compose up -d postgres redis`
3. `npm run db:migrate` (from repo root)
4. `npm run dev`

### Load test harness
Use the repo-level harness to validate launch traffic before and after a deploy.

Staging:
```bash
npm run load:test -- --base-url=https://staging.school.example --users=20 --concurrency=50 --duration-seconds=60
```

Production smoke:
```bash
npm run load:test -- --base-url=https://school.ditshego-ventures.co.za --users=10 --concurrency=20 --duration-seconds=45
```

Optional AI-heavy check:
```bash
npm run load:test -- --base-url=https://school.ditshego-ventures.co.za --include-ai --ai-sample-rate=0.05
```

Notes:
- Keep the staging run broader and longer than the production smoke.
- Use the production smoke only after a successful deploy and only when you want a controlled, short verification.
- Add `--max-error-rate` and `--max-p95-ms` overrides if you need stricter or looser gates for a particular test window.

### Critical env flags
- `ALLOW_FAKE_PHONE_VERIFY=false`
- `ALLOW_DEMO_AUTH=false`
- `WALLET_CREDITS_PER_ZAR=100`
- `WALLET_DETAILED_REPORT_CREDITS=15`
- `PAST_PAPERS_DETAILED_REPORT_CREDITS=15` (fallback only; primary price source is API wallet pricing)
- Stripe (optional):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `BOOKSTORE_PAYMENT_PROVIDER=stripe` (if Stripe checkout is enabled)

### Webhook testing

Wallet topup (stub provider, non-production only):
1. Create topup: `POST /wallet/topup/create`
2. Simulate payment:
   - `POST /wallet/webhooks/stub`
   - body includes `eventId`, `topupId`, and `paid=true`
3. Re-send same `eventId` to confirm duplicate idempotency behavior.

Billing entitlement (Stripe-style event):
1. Send signed webhook payload to `POST /billing/webhooks/stripe`.
2. Include metadata keys for `userId` and `planType` (`monthly` or `annual`).
3. Re-send same event id to confirm duplicate event is ignored.

## 8) Launch gate checklist

Use this checklist for the current launch window. The target is **1,500 concurrent users doing normal learner activity**. If any item in the first bucket is not checked, do not treat the platform as launch-ready.

### Must pass before launch

- [ ] Production uses the pooled Postgres connection, not the direct connection.
- [ ] [`apps/web/lib/server/plannerDb.ts`](../apps/web/lib/server/plannerDb.ts) resolves `POSTGRES_URL` before any direct Postgres URL.
- [ ] [`apps/web/lib/server/plannerDb.ts`](../apps/web/lib/server/plannerDb.ts) pool sizing is intentional for launch traffic and does not revert to a single-digit cap.
- [ ] Redis is enabled in production and reachable from both web and API.
- [ ] Session lookup caching is active in [`apps/web/lib/server/authDb.ts`](../apps/web/lib/server/authDb.ts).
- [ ] AI routes return `429` with `Retry-After` when per-user limits are exceeded.
- [ ] The current global API rate limit is confirmed in [`apps/api/src/server.ts`](../apps/api/src/server.ts).
- [ ] The hot database indexes are live in production:
  - `user_quests(user_id, expires_at)`
  - `user_notifications(user_id, created_at DESC)`
- [ ] Health checks pass in production:
  - API `GET /health`
  - web shell routes load
- [ ] Sentry is receiving events from both web and API.
- [ ] A real load test passes for the expected launch mix:
  - login/session resolution
  - dashboard load
  - learn pages
  - messages
  - growth/admin reads
- [ ] The load test shows no sustained pool exhaustion, no 5xx spike, and no timeout cascade.
- [ ] The first-run journey works on:
  - low-end Android width
  - iPhone-class width
  - tablet width
- [ ] The most visible landing and learning flows have no broken links or empty critical states.

### Should pass this week

- [ ] Verify the real client-IP behavior behind the proxy so rate limiting is not unfairly applied to shared NAT or proxy traffic.
- [ ] Confirm Redis request volume is within plan limits for expected launch traffic.
- [ ] Confirm the AI provider quota is comfortably above expected peak usage.
- [ ] Confirm leaderboard and growth endpoints are cached and not hammering the database.
- [ ] Verify alert thresholds for:
  - 5xx rate
  - DB pool wait time
  - Redis failures
  - AI 429 rate
  - response latency p95
- [ ] Review the admin growth dashboard for correctness and usefulness.
- [ ] Verify the public-facing live-signal numbers are privacy-safe and not misleading.
- [ ] Verify the launch-day homepage and sidebar branding render cleanly on desktop and mobile.
- [ ] Review the heaviest community and message queries for slow paths.
- [ ] Confirm there are no stale or duplicated routes that could confuse new users.
- [ ] Run one more production-like smoke test after a real deploy.
- [ ] Document the rollback path for:
  - DB connection issues
  - Redis failure
  - AI provider failure
  - web deploy regression

### Monitor after launch

- [ ] Watch DB pool saturation and query wait times in the first 24 hours.
- [ ] Watch Redis hit rate, failure rate, and request volume.
- [ ] Watch AI request volume and `429` counts per user.
- [ ] Watch API `5xx` rate and p95 latency.
- [ ] Watch web route p95 on:
  - `/learn`
  - `/messages`
  - `/admin/growth`
  - AI-assisted study routes
- [ ] Watch signups, session starts, and completion rates.
- [ ] Watch drop-off at onboarding and first-login.
- [ ] Watch Sentry for repeated exceptions on hot paths.
- [ ] Watch whether the growth dashboard numbers match actual platform behavior.
- [ ] Watch for any content or routing issues that first-time users report.
- [ ] Watch for unusual load caused by one school, one class, or one device type.
- [ ] If Redis or the AI provider starts degrading, reduce the launch surface before users experience failures.

Launch decision rule:
- If every item in **Must pass before launch** is checked, launch is acceptable.
- If any item in **Must pass before launch** is not checked, do not launch at full scale.
- If items in **Should pass this week** are incomplete, launch can still proceed only if the missing items are non-blocking and monitored closely.
