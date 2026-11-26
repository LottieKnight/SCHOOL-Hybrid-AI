# SCHOOL MVP Restructure Plan

## Scope
This document defines the implementation target for the restructure requested in Feb 2026:

- MVP loop: `Learn -> Past Papers -> Marking/Feedback -> Progress -> Wallet Spend`
- Wallet/credits ledger is API-owned (`apps/api`, Postgres)
- Equipment marketplace becomes quote-only (no payments / no order semantics)
- Messaging remains in MVP but is performance-safe for low-end devices
- P0/P1 security issues are removed first

## Current Boundaries

- Web app (`apps/web`) owns:
  - App Router UI
  - Past papers runtime and local SQLite model (Prisma)
  - Some local API wrappers/proxies
- API (`apps/api`) owns:
  - Auth/session/CSRF policy
  - Messaging/tutors/analytics/admin
  - Bookstore commerce tables and payment adapters

## Target Architecture

### Monetization Source of Truth (API)
- Add wallet domain to API/Postgres:
  - `wallet_accounts`
  - `wallet_ledger_entries`
  - `wallet_topups`
  - `processed_webhook_events`
- Credits and entitlement-like unlock checks are performed through API routes.
- Plan/entitlement upgrades are only granted by:
  - verified provider webhook event, or
  - admin action with explicit audit metadata.

### Past Papers (Web + API integration)
- Keep past papers attempt/marking flow in web for MVP.
- Introduce paid unlock in past papers (detailed marking report) using API wallet debit.
- Debit must be idempotent and tied to deterministic key:
  - `pastpaper:{userId}:{attemptId}:detailed-report:v1`
- Unlock marker is persisted in web SQLite for route-level access checks.

### Equipment Quote-Only
- Replace checkout/order semantics with quote semantics.
- No paid order creation in web local JSON.
- Quote persistence keeps minimal PII and abuse controls.
- Unauthenticated quote path uses:
  - strict validation
  - rate limits
  - anti-bot guardrails

### Messaging Performance
- Convert `/messages` route into:
  - lightweight server shell
  - lazily loaded client modules (list, thread, composer, heavy tools)
- Heavy features (attachments/moderation) are dynamically imported.
- SSE stream initialization should be deferred until thread interaction when feasible.

### SEO Baseline
- Add App Router metadata files:
  - `app/robots.ts`
  - `app/sitemap.ts`
  - `app/opengraph-image.tsx`
- Update branding metadata to SCHOOL for key route surfaces.

## Security Rules

1. No user-triggered direct plan upgrades without verified payment.
2. Fake phone verification code is disallowed in production unless explicit non-prod override is enabled.
3. Demo auth fallback paths are disabled in production unless explicit non-prod override is enabled.
4. Cookie-authenticated state-changing API endpoints require CSRF validation.
5. Webhooks and debit APIs are idempotent by unique keys/events stored in DB.

## Rollout Sequence

1. Phase 0: baseline docs, changelog, verify scripts/checks
2. Phase 1: security hotfixes (P0/P1)
3. Phase 2: wallet ledger + webhook idempotency
4. Phase 3: past papers monetized unlock flow
5. Phase 4: equipment quote-only rework
6. Phase 5: messaging performance split/lazy refactor
7. Phase 6: SEO baseline
8. Phase 7: final docs/cleanup and residual TODO capture

## Verification Strategy

For each phase:
- Run: lint, typecheck, test, build
- Fix regressions within phase scope
- Record outcome in `CHANGELOG_RESTRUCTURE.md`

Because git is unavailable in this workspace, `CHANGELOG_RESTRUCTURE.md` is the phase commit ledger.

## Operational Companion

Implemented operational notes, wallet pricing, inclusion/lite-mode behavior, and webhook testing steps are documented in:
- `docs/MVP_OPERATIONS.md`
