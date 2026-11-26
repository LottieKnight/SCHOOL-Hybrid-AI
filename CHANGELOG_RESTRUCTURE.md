# Restructure Changelog (No-Git Mode)

This repository is currently not inside a git work tree in this workspace, so phase commits are tracked here.

## Phase 0 - Baseline + Safety Net

### Added
- `docs/RESTRUCTURE_PLAN.md`
- `CHANGELOG_RESTRUCTURE.md` (this file)

### Notes
- Baseline scripts already exist at root and in workspace packages:
  - root: `lint`, `typecheck`, `test`, `build`
  - `apps/web`: `lint`, `typecheck`, `test`, `build`
  - `apps/api`: `lint`, `typecheck`, `test`, `build`

### Checks
- `npm run lint` ✅ (warnings only, no errors)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-0: add restructure plan + no-git phase changelog + baseline verification`

### 2026-03-06 verification pass
- **Fix:** Web `typecheck` was failing (Cannot find module `@saedu/shared`). Added path mappings in `apps/web/tsconfig.json`: `@saedu/shared` → `../../packages/shared/src` and `@saedu/shared/*` → `../../packages/shared/src/*` so `tsc --noEmit` resolves the workspace package.
- **Result:** `npm run typecheck` ✅, `npm run test` ✅. Lint and build run (build can take 5+ min for Next.js).

## Phase 1 - Security Hotfixes

### Added
- `apps/web/lib/equipmentQuoteGuard.ts`
- `apps/web/app/api/equipment/quote/route.ts`

### Changed
- `apps/api/src/routes/billing.ts`
  - `/billing/upgrade` is now `requireAdmin` only and requires explicit target `userId` + `reason`.
  - Added audit event creation for admin-granted plan upgrades.
- `apps/api/src/db/product-events.ts`
  - Added event names for billing/webhook and wallet activity audit coverage.
- `apps/api/src/config.ts`
  - Added `ALLOW_FAKE_PHONE_VERIFY` and wallet pricing env parsing (`WALLET_CREDITS_PER_ZAR`).
- `apps/api/src/routes/auth.ts`
  - Phone verification stub is unavailable unless non-production + `ALLOW_FAKE_PHONE_VERIFY=true`.
- `apps/web/lib/pastPapers/auth.ts`
  - Demo auth fallbacks are disabled unless non-production + `ALLOW_DEMO_AUTH=true`.
- `apps/web/lib/equipmentStoreServer.ts`
  - Equipment flow now stores quote records (`equipment_quotes.json`) and no longer persists paid-equivalent equipment orders.
- `apps/web/app/api/equipment/checkout/route.ts`
  - Checkout compatibility endpoint now routes through quote guard + quote capture behavior.
- `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`
  - Added explicit secure defaults for fake phone verify / demo auth / wallet credits.

### Checks
- `npm run lint` ✅ (warnings only, no errors)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-1: lock billing upgrade path, gate demo/phone stubs, enforce quote guards`

## Phase 2 - Wallet Ledger (API + Postgres)

### Added
- `apps/api/migrations/044_wallet_ledger.sql`
- `apps/api/src/db/wallet.ts`
- `apps/api/src/lib/wallet-pricing.ts`
- `apps/api/src/routes/wallet.ts`
- `apps/api/src/lib/billing-webhook.ts`
- `apps/api/test/wallet-ledger-idempotency.test.ts`

### Changed
- `apps/api/src/server.ts`
  - Registered wallet routes (`/wallet/*`).
- `apps/api/src/routes/billing.ts`
  - Added `/billing/webhooks/:provider` (Stripe) path using verified/idempotent processing.
- `apps/api/src/db/product-events.ts`
  - Added `wallet_credit_topup` event type for topup audit trail.

### Implemented
- Wallet/account ledger tables with unique idempotency keys and webhook event dedupe table.
- API endpoints:
  - `GET /wallet/balance`
  - `POST /wallet/debit` (idempotency required)
  - `POST /wallet/credit` (admin only)
  - `POST /wallet/topup/create` (Stripe session when configured, else secure stub)
  - `POST /wallet/webhooks/:provider` (idempotent; Stripe signature verification when secret configured)
- Central pricing map in config-backed code (`wallet-pricing.ts`).
- Billing entitlement webhook processor with dedupe + audit event emission.

### Tests Added
- Wallet debit idempotency test (debit only once for repeated idempotency key).
- Billing webhook entitlement grant test (verified webhook processor path + duplicate event behavior).

### Checks
- `npm run lint` ✅ (warnings only in existing web files; no new errors)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-2: add wallet ledger routes/migration, webhook idempotency, and entitlement webhook processor`

## Phase 3 - Past Papers Monetization (MVP Loop)

### Added
- `apps/web/lib/pastPapers/entitlements.ts`
- `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`
- `apps/web/test/pastPapersAccess.test.ts`

### Changed
- `apps/web/app/classes/[classId]/past-papers/[province]/[grade]/[subject]/[year]/[session]/[paperId]/live/page.tsx`
  - Added ownership checks and entitlement-aware payload shaping.
  - Locked detailed report fields unless entitlement is present.
- `apps/web/components/PastPapersLiveClient.tsx`
  - Added detailed report paywall UX + unlock action via wallet debit.
- `apps/web/app/api/past-papers/attempts/review/route.ts`
  - Enforced entitlement for detailed-review write path.
- `.env.example`, `apps/web/.env.example`
  - Added `PAST_PAPERS_DETAILED_REPORT_CREDITS`.

### Implemented
- Paid unlock point: detailed marking report/explanations after submit.
- Wallet debit call uses idempotency key based on user/attempt/action.
- Unlock marker persisted to local past-paper attempt analytics.
- Free summary remains available when detailed report is locked.

### Tests Added
- Unlock access guard test coverage (owner isolation + lock/unlock behavior).

### Checks
- `npm run lint` ✅ (warnings only, no errors)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-3: add wallet-gated detailed report unlock for past paper attempts`

## Phase 4 - Equipment Quote-Only Rework

### Added
- `apps/web/components/equipment/EquipmentQuoteSection.tsx`

### Removed
- `apps/web/app/api/equipment/checkout/route.ts`
- `apps/web/components/equipment/EquipmentCheckoutSection.tsx`

### Changed
- `apps/web/lib/equipment.ts`
  - Replaced equipment checkout client API with quote API (`/api/equipment/quote`).
  - Replaced checkout receipt model/storage with quote receipt model/storage.
  - Added legacy receipt read compatibility mapping (`order` -> `quote`) for session data.
- `apps/web/lib/equipmentStoreServer.ts`
  - Removed checkout-order compatibility creator.
  - Kept quote persistence as the only equipment transaction path.
- `apps/web/lib/equipmentQuoteGuard.ts`
  - Tightened quote payload validation.
  - Added basic anti-PII guard for notes (rejects contact details in quote notes).
- `apps/web/app/api/equipment/quote/route.ts`
  - Updated source tagging and error copy for quote-only flow.
- `apps/web/app/checkout/page.tsx`
  - Swapped in `EquipmentQuoteSection`.
- `apps/web/components/equipment/EquipmentCatalogClient.tsx`
  - Updated user copy to quote basket wording.
- `apps/web/components/equipment/EquipmentProductClient.tsx`
  - Updated user copy to quote request wording.
- `apps/web/components/equipment/EquipmentCartSection.tsx`
  - Updated user copy to quote basket wording.
- `apps/web/app/api/equipment/cart/validate/route.ts`
  - Updated error copy to quote basket wording.

### Implemented
- Equipment flow is quote-only, with no equipment checkout endpoint and no paid-order semantics.
- Frontend user language now explicitly reflects quote requests, delivery estimates, and supplier follow-up.
- Quote route remains guarded with rate limiting + honeypot + validation.

### Checks
- `npm run lint` ✅ (warnings only, no errors)
- `npm run typecheck` ✅
  - Note: required `npx next typegen` once to refresh generated route validator types after removing `/api/equipment/checkout`.
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-4: remove equipment checkout path and ship quote-only equipment UX/api`

## Phase 5 - Messaging MVP Performance Refactor

### Added
- `apps/web/components/messages/ConversationListPanel.tsx`
- `apps/web/components/messages/ThreadViewPanel.tsx`
- `apps/web/components/messages/ComposerPanel.tsx`
- `apps/web/components/messages/MessageAttachmentList.tsx`
- `apps/web/components/messages/ModerationFeedPanel.tsx`
- `apps/web/test/messagesPerformanceStructure.test.ts`
- `apps/web/app/messages/page.tsx` (server shell entry)

### Changed
- `apps/web/app/messages/MessagesClientPage.tsx` (moved from `app/messages/page.tsx`)
  - Converted route to server-shell + client runtime split.
  - Added lazy dynamic imports for attachment rendering and moderation tools.
  - Gated moderation data loading behind explicit tool visibility.
  - Updated SSE stream setup to start only when an active conversation is selected.
  - Added lite-mode behavior for message attachments (low-bandwidth attachment rendering) and quota panel suppression in lite mode.
  - Wrapped conversation list, thread view, and composer into dedicated client components.

### Removed
- `apps/web/app/messages/page.tsx` old monolithic client implementation (replaced by server shell + `MessagesClientPage.tsx`)

### Implemented
- `/messages` is no longer a monolithic app-route client file.
- Heavy features are now lazy-loaded chunks (`MessageAttachmentList`, `ModerationFeedPanel`).
- Moderation fetch work no longer runs by default unless moderation tools are opened.
- SSE lifecycle is tied to active conversation selection to reduce unnecessary background streaming.

### Tests Added
- Structural perf test validates:
  - `/messages` route shell is server component.
  - dynamic lazy imports exist for heavy message tools.
  - SSE guard requires active conversation before opening stream.

### Checks
- `npm run lint` ✅ (warnings only, no errors)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `phase-5: split messages route into server shell + lazy client tools with active-thread SSE gating`

## Phase 6 - SEO Baseline (Next App Router)

### Added
- `apps/web/app/robots.ts`
- `apps/web/app/sitemap.ts`
- `apps/web/app/opengraph-image.tsx`

### Changed
- `apps/web/app/layout.tsx`
  - Updated metadata baseline to `SCHOOL` brand naming.
  - Added default OpenGraph + Twitter card metadata and `metadataBase` handling.
- `apps/web/app/learn/page.tsx`
  - Added route metadata + OpenGraph fields.
- `apps/web/app/bookstore/page.tsx`
  - Added route metadata + OpenGraph fields.

### Implemented
- App Router metadata baseline for robots + sitemap + OpenGraph image.
- Key share surfaces now include explicit metadata for `/learn` and `/bookstore`.
- Global brand metadata standardized to `SCHOOL`.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: fixed initial build failure by replacing unsupported `display: inline-flex` in `opengraph-image.tsx`.

### Emulated Commit
- `phase-6: add app-router seo baseline (robots, sitemap, og image) and SCHOOL metadata`

## Launch + Growth Sprint

### Phase 1 - Golden Path UX (Next Best Action)

### Added
- `apps/web/components/NextBestActionCard.tsx`
- `apps/web/lib/nextBestAction.ts`
- `apps/web/lib/nextBestActionServer.ts`
- `apps/web/test/nextBestAction.test.ts`

### Changed
- `apps/web/app/learn/[phase]/[grade]/[subject]/term/[term]/week/[week]/page.tsx`
  - Added a reusable Next Best Action card to move users from Learn into a mapped Past Papers route.
  - Added server-side route resolution against existing past-papers catalog data with safe fallback to class past-papers root.
- `apps/web/components/PastPapersLiveClient.tsx`
  - Added Next Best Action cards on marked-attempt states:
    - locked detailed report -> unlock CTA + wallet entry point
    - unlocked detailed report -> dashboard next-action CTA + targeted re-attempt path
- `apps/web/app/dashboard/progress/page.tsx`
  - Added learner Next Best Action card that maps recommendation `lessonKey` into `/learn/.../term/.../week/...` routes.
  - Added fallback CTA behavior when a recommendation route cannot be resolved.

### Acceptance Criteria Notes
- Learn week page now surfaces an explicit CTA to continue into Past Papers.
- Past paper marked state now shows explicit unlock and post-unlock progression CTAs.
- Dashboard learner view now provides a weak-area continuation CTA with deterministic mapping and fallback.
- Unknown route mappings no longer dead-end; they fallback to safe, existing routes.

### Checks
- `npm run lint` ✅ (warnings only in pre-existing files)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `launch-growth-phase-1: add reusable next-best-action golden-path CTAs across learn, past papers, and dashboard`

### Phase 2 - Wallet Product Surface (/wallet)

### Added
- `apps/web/app/wallet/page.tsx`
- `apps/web/components/WalletPageClient.tsx`

### Changed
- `apps/api/src/db/wallet.ts`
  - Added `listWalletLedgerEntries(userId, limit)` query helper for recent wallet activity.
- `apps/api/src/routes/wallet.ts`
  - Added `GET /wallet/ledger?limit=20` (auth protected, bounded limit parsing).
- `apps/web/app/layout.tsx`
  - Added Wallet navigation entry to expose wallet as a first-class surface.

### Implemented
- New `/wallet` route with:
  - current credit balance
  - last 20 ledger entries
  - top-up actions for `R10`, `R25`, `R50`
  - pricing anchors, including detailed report unlock credit cost approximation in ZAR
- Wallet top-up action sends CSRF header and:
  - redirects to provider checkout URL when available
  - shows secure stub note when checkout URL is absent
- Lite mode behavior:
  - wallet history list is reduced (`8` most recent entries) to lower rendering/data usage.

### Checks
- `npm run lint` ✅ (warnings only in pre-existing files)
- `npm run typecheck` ✅
- `npm run test` ✅
- `npm run build` ✅

### Emulated Commit
- `launch-growth-phase-2: add wallet page, wallet ledger endpoint, and top-up/pricing surface`

### Phase 3 - Impact Scorecard v1 (Admin)

### Added
- `apps/api/src/db/impact.ts`
- `apps/web/app/admin/impact/page.tsx`
- `apps/web/components/PerformanceSampleBeacon.tsx`

### Changed
- `apps/api/src/routes/analytics.ts`
  - Added `GET /admin/impact/summary?range=7d|30d` (admin-only impact aggregation endpoint).
  - Added `POST /analytics/perf-sample` for lightweight page-load telemetry sampling.
- `apps/api/src/db/product-events.ts`
  - Added `perf_page_load` event type support for TTI-proxy sampling.
- `apps/web/app/learn/[phase]/[grade]/[subject]/term/[term]/week/[week]/page.tsx`
  - Added performance beacon emission for learn-route page-load samples.
- `apps/web/app/dashboard/progress/page.tsx`
  - Added performance beacon emission for dashboard-route page-load samples.
- `apps/web/components/AdminQuickLinks.tsx`
  - Added impact scorecard link.
- `apps/web/components/AdminSidebarSection.tsx`
  - Added impact scorecard link.
- `docs/MVP_OPERATIONS.md`
  - Added metric definitions and formulas for impact scorecard indicators.

### Implemented
- Admin impact scorecard with selectable `7d` / `30d` ranges.
- Summary metrics include DAU/WAU, attempts/day, unlock conversion, lite-mode usage, score-improvement delta, median TTI proxy, and credits spent per improvement unit.
- Zero-data behavior returns structured numeric payloads (safe for empty datasets).

### Checks
- `npm run lint` [pass] (warnings only in pre-existing files)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]

### Emulated Commit
- `launch-growth-phase-3: add admin impact scorecard endpoint/page with sdg-aligned metrics and perf sampling`

### Phase 4 - Messaging MVP Safety

### Added
- `apps/web/app/admin/messages/page.tsx`
- `apps/api/test/messages-user-report-route.test.ts`

### Changed
- `apps/api/src/routes/messages.ts`
  - Added route-level throttling for messaging abuse-sensitive endpoints:
    - `POST /messages/conversations/:id/upload-sessions/:uploadId/complete`
    - `POST /messages/conversations/:id/messages`
    - `POST /messages/conversations/:id/messages/attachments`
    - `POST /messages/conversations/:id/typing`
    - `POST /messages/messages/:id/report`
    - `POST /messages/messages/:id/forward`
  - Added `POST /messages/users/:id/report` with input validation and context checks.
  - Added direct-peer messaging guard helper that enforces blocked and direct-message preference checks for send/typing paths.
  - Strengthened message report metadata to capture reporter/target/source context.
- `apps/web/app/messages/MessagesClientPage.tsx`
  - Added message-level report action (`Report`) for non-self messages.
  - Added direct-conversation user report action (`Report user`).
- `apps/web/components/AdminQuickLinks.tsx`
  - Added admin moderation queue link.
- `apps/web/components/AdminSidebarSection.tsx`
  - Added admin moderation queue link.
- `apps/api/test/messaging-learning-profile-auth.test.ts`
  - Added auth coverage entry for `POST /messages/users/:id/report`.

### Implemented
- Minimal abuse controls:
  - Per-route rate limits for high-risk messaging writes.
  - New user-report endpoint with server-side validation and moderation-event persistence.
  - UI report actions for both message-level and user-level reporting.
- Admin placeholder moderation surface at `/admin/messages` for report triage.
- Block/direct-message preference enforcement applied to direct messaging interactions where relevant.
- Messaging lazy-load architecture remains intact (`MessageAttachmentList`, `ModerationFeedPanel` are still dynamic imports).

### Acceptance Criteria Notes
- Report action now exists in user-facing messaging UI and stores records via trust-event persistence.
- Spam bursts are throttled by explicit route-level limits on send/report endpoints.

### Checks
- `npm run lint` [pass] (warnings only in pre-existing files)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `launch-growth-phase-4: add messaging abuse controls (rate limits, report user/message actions, admin moderation queue)`

### Phase 5 - Equipment Quote Ops + POPIA

### Added
- `apps/web/app/admin/equipment/quotes/page.tsx`
- `apps/web/components/equipment/AdminEquipmentQuotesClient.tsx`
- `apps/web/app/api/admin/equipment/quotes/route.ts`
- `apps/web/app/api/admin/equipment/quotes/[quoteId]/route.ts`
- `apps/web/app/api/admin/equipment/quotes/export/route.ts`

### Changed
- `apps/web/lib/equipmentStoreServer.ts`
  - Extended quote record model with lifecycle fields (`updatedAt`, `statusUpdatedAt`, `statusUpdatedBy`) and status states (`received|answered|closed`).
  - Added normalized requester block for minimal POPIA-friendly contact capture (`organizationName`, `province`, `contactEmail`, purpose tag).
  - Added admin quote operations:
    - `listEquipmentQuotes` (status/date filtering + bounded list)
    - `updateEquipmentQuoteStatus` (answered/closed actions)
  - Kept retention enforcement active on create/list/update paths.
- `apps/web/lib/equipmentQuoteGuard.ts`
  - Added strict requester validation with required `contactEmail`.
  - Kept notes anti-PII restrictions and honeypot/rate-limit checks.
- `apps/web/app/api/equipment/quote/route.ts`
  - Wired validated requester block into quote capture.
- `apps/web/lib/equipment.ts`
  - Added admin quote types and helper APIs:
    - `fetchAdminEquipmentQuotes`
    - `updateAdminEquipmentQuoteStatus`
    - `cleanupAdminEquipmentQuotes`
  - Updated quote request contract to include requester fields.
- `apps/web/components/equipment/EquipmentQuoteSection.tsx`
  - Added minimal quote follow-up capture fields and purpose text.
  - Added client-side contact email requirement before submission.
- `apps/web/components/equipment/AdminEquipmentClient.tsx`
  - Added quick link to quote operations UI.
- `apps/web/components/AdminQuickLinks.tsx`
- `apps/web/components/AdminSidebarSection.tsx`
  - Added `/admin/equipment/quotes` navigation entry.
- `docs/MVP_OPERATIONS.md`
  - Documented admin quote ops endpoints, CSV export path, and POPIA minimal-field posture.

### Implemented
- Admin quote list page with status/date filters.
- Status transitions for quote ops (`received -> answered -> closed`).
- CSV export for quote operations.
- Retention cleanup trigger in admin UI (no manual JSON editing required).
- Quote request payload narrowed to minimal follow-up information with clear purpose messaging.

### Acceptance Criteria Notes
- Admin can now manage quotes from `/admin/equipment/quotes` with filtering, lifecycle updates, export, and cleanup actions.
- Quote retention remains enforced and is actionable via admin API + UI.
- Quote requests keep quote-only semantics and avoid paid-order workflows.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `launch-growth-phase-5: ship equipment quote ops admin surface with popia-minimal requester data, status workflow, csv export, and retention actions`

### Phase 6 - SEO Curation

### Changed
- `apps/web/app/sitemap.ts`
  - Curated sitemap routes to explicit public MVP surfaces only:
    - `/`
    - `/learn`
    - `/bookstore`
    - `/store/equipment`
- `apps/web/app/robots.ts`
  - Added explicit disallow rules for admin/legacy/dev or private surfaces:
    - `/admin/`, `/api/`, `/phase/`, `/dashboard/`, `/messages/`, `/orders/`, `/settings/`, `/wallet/`, `/checkout`, `/cart`
  - Kept sitemap reference aligned to curated sitemap output.

### Acceptance Criteria Notes
- Sitemap no longer includes admin, legacy phase routes, or authenticated surfaces.
- Robots policy now aligns with curated index scope and blocks non-public areas.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `launch-growth-phase-6: curate sitemap to public mvp routes and align robots exclusions for admin/legacy/private surfaces`

### Launch + Growth Sprint - Final Summary

### New Pages and Routes
- `/wallet` (Phase 2)
- `/admin/impact` (Phase 3)
- `/admin/messages` (Phase 4)
- `/admin/equipment/quotes` (Phase 5)
- `/api/admin/equipment/quotes` (list/filter)
- `/api/admin/equipment/quotes/[quoteId]` (status updates)
- `/api/admin/equipment/quotes/export` (CSV export)

### Acceptance Results
- Golden path CTAs are now wired across learn, past-papers result states, and dashboard progress.
- Wallet is first-class with balance, ledger, top-up anchors, and pricing guidance.
- Impact scorecard v1 provides 7d/30d operational and inclusion metrics.
- Messaging MVP includes report actions + throttling without regressing lazy-load split architecture.
- Equipment flow remains quote-only and now includes POPIA-friendly admin operations.
- SEO indexing is curated to public MVP surfaces only.

### Known Limitations / Post-launch TODOs
- Equipment quote admin endpoints currently rely on same-origin admin auth checks; follow-up hardening should enforce explicit CSRF token verification server-side for every state-changing admin route.
- CSV export currently uses a bounded limit; if ops demand larger exports, add paginated/background export jobs.
- Existing non-blocking lint warnings remain in unrelated files (`react-hooks/exhaustive-deps`, `ResponseJsonSafetyPatch` compiler warning).

### Emulated Commit
- `launch-growth-sprint: complete phases 1-6 with golden-path ux, wallet surface, impact scorecard, messaging safety, quote ops tooling, and curated seo index`

## Phase 7 - Final Cleanup + Documentation

### Added
- `docs/MVP_OPERATIONS.md`

### Changed
- `README.md`
  - Added MVP restructure document references.
  - Updated equipment section to quote-only semantics and API surface.
- `docs/RESTRUCTURE_PLAN.md`
  - Linked to operational companion documentation.

### Implemented
- Documented MVP loop walkthrough:
  - Learn -> Past Papers -> Marking/Feedback -> Progress -> Wallet Spend
- Documented wallet pricing model and micro-billing rationale.
- Documented inclusion/lite-mode behavior and messaging performance guardrails.
- Documented local operational runbook, env flags, and webhook testing flow.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `phase-7: finalize mvp operations docs, quote-only readme updates, and runbook links`

## Launch Hardening Sprint - Correctness + Abuse Resistance

### Added
- `apps/web/app/api/admin/equipment/quotes/cleanup/route.ts`

### Changed
- `apps/api/src/db/wallet.ts`
  - Reordered debit/credit mutation flow to lock wallet row before idempotency lookup.
  - Added stronger idempotency shape matching (user/type/amount/reason/ref fields).
  - Added unique-constraint race handling that resolves to deterministic idempotency outcomes.
- `apps/api/src/routes/wallet.ts`
  - Added production fail-closed guard for Stripe wallet webhook when `STRIPE_WEBHOOK_SECRET` is missing.
  - Added explicit error logging + `503` response for fail-closed condition.
- `apps/api/src/routes/billing.ts`
  - Added production fail-closed guard for billing Stripe webhook when `STRIPE_WEBHOOK_SECRET` is missing.
  - Added explicit error logging + `503` response for fail-closed condition.
- `apps/api/test/wallet-ledger-idempotency.test.ts`
  - Added 50-concurrent debit stress test.
  - Added wallet webhook duplicate event dedupe test (single credit on repeated event id).
  - Added fail-closed helper tests for production webhook secret enforcement.
- `apps/web/lib/pastPapers/entitlements.ts`
  - Added explicit unlock authorization helper (`canUnlockDetailedReport`).
  - Introduced explicit feature key constant for detailed report idempotency key derivation.
- `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`
  - Updated unlock path to use shared server-side unlock authorization guard.
- `apps/web/test/pastPapersAccess.test.ts`
  - Added owner-only unlock test coverage.
  - Added deterministic idempotency key derivation coverage.
- `apps/web/lib/equipmentStoreServer.ts`
  - Added quote retention cleanup logic and bounded retention by days.
  - Added `cleanupEquipmentQuotes` utility for admin-triggered purge.
  - Added automatic retention cleanup before persisting new quote requests.
- `apps/web/app/messages/MessagesClientPage.tsx`
  - Added explicit single-stream SSE guard using refs.
  - Added bounded reconnect backoff with jitter and timer dedupe.
  - Added explicit stream lifecycle cleanup to prevent concurrent stream overlap.
- `apps/web/test/messagesPerformanceStructure.test.ts`
  - Added structural test coverage for guarded SSE reconnect logic.
- `docs/MVP_OPERATIONS.md`
  - Added SSE stability/performance note (single stream + bounded backoff).
  - Added quote retention/admin cleanup operational note.
- `.env.example`, `apps/web/.env.example`
  - Added `EQUIPMENT_QUOTE_RETENTION_DAYS`.

### Implemented
- Wallet debit correctness under contention with row-level transaction safety.
- Webhook processing now fails closed in production when Stripe webhook secret is absent.
- Past paper detailed unlock remains owner-only with deterministic idempotency key derivation.
- Equipment quote flow now includes retention cleanup controls in addition to rate-limit/honeypot/PII validation.
- Messaging SSE now enforces one stream at a time and reconnects with bounded backoff.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run test -w apps/web` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `launch-hardening: race-proof wallet debit, fail-closed webhooks, owner-only unlock guards, quote retention cleanup, and stable SSE reconnect`

## Visibility + Calibration Sprint

### Phase 1 - Wallet Health

### Added
- `apps/api/test/wallet-admin-health.test.ts`
- `apps/web/app/admin/wallet-health/page.tsx`

### Changed
- `apps/api/src/db/wallet.ts`
  - Added `getAdminWalletSummary()` to return wallet account count, issued credits, debited credits, and outstanding net credits.
  - Added `reconcileWalletBalances()` to recompute ledger balances per user and detect account-vs-ledger mismatches (read-only; no auto-fix).
- `apps/api/src/routes/wallet.ts`
  - Added `GET /admin/wallet/summary` (admin-only).
  - Added `GET /admin/wallet/reconcile` (admin-only).
- `apps/api/test/health-and-analytics-auth.test.ts`
  - Added unauthorized access assertions for `/admin/wallet/summary` and `/admin/wallet/reconcile`.
- `apps/web/components/AdminQuickLinks.tsx`
  - Added `/admin/wallet-health` quick link.
- `apps/web/components/AdminSidebarSection.tsx`
  - Added `/admin/wallet-health` sidebar link.
- `apps/web/app/admin/page.tsx`
  - Added wallet health card shortcut in admin home.

### Implemented
- Admin wallet health API tooling for:
  - credits issuance/debit summary
  - reconciliation mismatch detection without mutation
- Admin wallet health UI (`/admin/wallet-health`) showing:
  - summary totals
  - reconcile totals
  - mismatch records and differences

### Acceptance Criteria Notes
- Summary endpoint now returns:
  - `total_wallet_accounts`
  - `total_credits_issued`
  - `total_credits_debited`
  - `net_outstanding_credits`
- Reconcile endpoint now recomputes balances from ledger and returns mismatch list only (no writes).
- Tests cover:
  - aligned ledger/account totals
  - detection of synthetic mismatch fixture.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `visibility-calibration-phase-1: add admin wallet summary, reconciliation endpoint, wallet health page, and mismatch detection tests`

### Phase 2 - Funnel Dashboards

### Added
- `apps/web/app/admin/metrics/page.tsx`

### Changed
- `apps/api/src/db/funnels.ts`
  - Added unlock funnel aggregation from attempts and detailed-report debit events.
  - Added quote funnel aggregation from quote status data with safe JSON fallback behavior.
- `apps/api/src/routes/analytics.ts`
  - Added `GET /admin/funnels/unlock` (admin-only).
  - Added `GET /admin/funnels/quotes` (admin-only).
- `apps/api/test/health-and-analytics-auth.test.ts`
  - Added unauthorized access assertions for:
    - `/admin/funnels/unlock`
    - `/admin/funnels/quotes`
- `apps/web/components/AdminQuickLinks.tsx`
  - Added `/admin/metrics` quick link.
- `apps/web/components/AdminSidebarSection.tsx`
  - Added `/admin/metrics` sidebar link.
- `apps/web/app/admin/page.tsx`
  - Added admin home card shortcut for `/admin/metrics`.

### Implemented
- New admin dashboard page `/admin/metrics` that aggregates:
  - unlock conversion funnel
  - equipment quote funnel
  - wallet summary totals
- Funnel metrics now have dedicated admin API endpoints and consistent response shapes.

### Acceptance Criteria Notes
- Unlock funnel endpoint returns:
  - `total_attempts`
  - `total_unlocks`
  - `unlock_conversion_rate`
- Quote funnel endpoint returns:
  - `total_quotes`
  - `answered_rate`
  - `closed_rate`
- Admin metrics page loads funnel + wallet blocks from real endpoints and handles empty/error states gracefully.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `visibility-calibration-phase-2: add admin funnel endpoints and /admin/metrics dashboard aggregating unlock, quote, and wallet summaries`

### Phase 3 - Inclusion Metrics

### Added
- `apps/api/test/impact-inclusion.test.ts`

### Changed
- `apps/api/src/db/product-events.ts`
  - Added inclusion/monetization event names:
    - `lite_mode_session`
    - `past_paper_unlock`
- `apps/api/src/routes/analytics.ts`
  - Extended `POST /analytics/perf-sample` payload to accept `payloadBytes`.
  - Added lite-mode session event emission when `liteMode=true`.
  - Added `GET /admin/impact/inclusion?range=7d|30d` (admin-only).
- `apps/api/src/db/impact.ts`
  - Added `getImpactInclusionSummary(range)` returning:
    - `liteModeUsagePercent`
    - `medianUnlockPayloadSize`
    - `medianLearnPayloadSizeProxy`
    - plus sample counts for operational context.
- `apps/api/src/routes/wallet.ts`
  - Added `past_paper_unlock` product-event emission on successful detailed-report debit (first-process only).
  - Captures unlock payload-size proxy for inclusion analytics.
- `apps/api/src/routes/profile.ts`
  - Emits `lite_mode_session` event when a user explicitly enables lite mode in profile updates.
- `apps/web/components/PerformanceSampleBeacon.tsx`
  - Added navigation payload-size proxy capture (`transferSize`/`encodedBodySize`) and sends it via perf telemetry.
- `apps/api/test/health-and-analytics-auth.test.ts`
  - Added unauthorized access assertion for `/admin/impact/inclusion`.

### Implemented
- Inclusion telemetry now tracks:
  - lite-mode enabled sessions
  - past-paper unlock events
  - learn route load timing + payload-size proxy
- New inclusion admin endpoint exposes stable SDG/inclusion-friendly metrics with safe zero defaults.
- Added test coverage for:
  - inclusion metric shape
  - empty-dataset no-crash behavior

### Acceptance Criteria Notes
- Endpoint `GET /admin/impact/inclusion` returns required fields:
  - `lite_mode_usage_percent` (mapped from summary field)
  - `median_unlock_payload_size`
  - `median_learn_payload_size_proxy`
- Metric computations return `0` defaults when source events are absent.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `visibility-calibration-phase-3: add inclusion telemetry events, /admin/impact/inclusion endpoint, and empty-safe metric tests`

### Phase 4 - Pricing Calibration Infrastructure

### Added
- `apps/api/src/lib/pricing-config.ts`

### Changed
- `apps/api/src/config.ts`
  - Added `WALLET_DETAILED_REPORT_CREDITS` env support (default `15`).
- `apps/api/src/lib/wallet-pricing.ts`
  - Switched to centralized pricing source (`pricing-config`).
  - Added `detailedReportCredits` to wallet pricing payload.
- `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`
  - Unlock debit amount now resolves from API wallet pricing (`GET /wallet/balance`) with fallback.
  - Removed hardcoded debit amount dependency for unlock charging path.
- `apps/web/lib/pastPapers/entitlements.ts`
  - Added `resolveDetailedReportCreditCost()` helper for deterministic dynamic price resolution.
- `apps/web/components/WalletPageClient.tsx`
  - Uses dynamic wallet pricing for detailed-report pricing anchors when available.
  - Keeps fallback anchor via existing prop for resilience.
- `apps/api/src/db/funnels.ts`
  - Improved quote file discovery to include `apps/web/data/equipment_quotes.json` path candidates.
- `apps/web/test/pastPapersAccess.test.ts`
  - Added deterministic dynamic pricing calibration test.
- `.env.example`, `apps/api/.env.example`, `apps/web/.env.example`
  - Added `WALLET_DETAILED_REPORT_CREDITS=15`.
- `docs/MVP_OPERATIONS.md`
  - Updated pricing source-of-truth docs and env guidance for wallet-owned detailed-report pricing.

### Implemented
- Credit pricing now has a single API-owned configuration source.
- Detailed-report price is overrideable via environment config (`WALLET_DETAILED_REPORT_CREDITS`).
- Past-paper unlock debit amount now follows dynamic API pricing (fallback-safe) instead of hardcoded value.

### Acceptance Criteria Notes
- Dynamic pricing calibration is wired without changing current defaults (still `15` credits unless overridden).
- Unlock pricing uses API wallet pricing payload as source of truth when available.
- Added deterministic test proving price changes produce deterministic debit amount selection.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run test -w apps/web` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `visibility-calibration-phase-4: centralize pricing config, add dynamic detailed-report price override, and wire unlock debit amount to api pricing`

### Visibility + Calibration Sprint - Verification Patch

### Changed
- `apps/api/test/impact-inclusion.test.ts`
  - Fixed admin route-level inclusion test DB mocking so non-inclusion queries (`user_suspensions`) are handled in-test.
  - Added strict query matching for inclusion aggregation SQL to avoid accidental real DB calls.
  - Kept endpoint shape assertions for:
    - `lite_mode_usage_percent`
    - `median_unlock_payload_size`
    - `median_learn_payload_size_proxy`

### Checks (rerun after patch)
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `visibility-calibration-verification: fix inclusion route test mocking and rerun full validation suite`

## Monetisation Optimization Sprint

### Phase 1 - Configurable Pricing (Verified)

### Confirmed Existing
- `apps/api/src/lib/pricing-config.ts`
  - Detailed report unlock price is centralized under `pricingConfig.features.detailedReportCredits`.
- `apps/api/src/config.ts`
  - Env-backed pricing override exists via `WALLET_DETAILED_REPORT_CREDITS`.
- `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`
  - Unlock flow resolves dynamic detailed-report price from API wallet pricing (`GET /wallet/balance`) before debit.
- `apps/web/test/pastPapersAccess.test.ts`
  - Deterministic dynamic pricing test verifies changed price produces changed debit amount selection.

### Acceptance Criteria Notes
- Detailed report price remains centralized and configurable without architecture changes.
- Unlock route consumes dynamic price from API pricing payload.
- Deterministic pricing behavior is covered by automated test.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `monetisation-phase-1: verify centralized dynamic detailed-report pricing and deterministic test coverage`

### Phase 2 - Credit Bundles

### Added
- `apps/api/test/wallet-pricing-bundles.test.ts`

### Changed
- `apps/api/src/lib/pricing-config.ts`
  - Added centralized wallet bundle definitions: `starter`, `growth`, `mastery`.
  - Added bundle bonus metadata and computed credit totals based on `WALLET_CREDITS_PER_ZAR`.
  - Added `findWalletCreditBundle(...)` helper for bundle resolution.
- `apps/api/src/lib/wallet-pricing.ts`
  - Extended wallet pricing payload with:
    - `featurePrices.detailedReportCredits`
    - `bundles[]` (bundle comparison data)
  - Added `resolveWalletTopupSelection(...)` to normalize amount/bundle top-up credit grants.
- `apps/api/src/routes/wallet.ts`
  - Extended `POST /wallet/topup/create` to accept `bundleId` or `amountZar`.
  - Added bonus-aware credit resolution via `resolveWalletTopupSelection`.
  - Response now includes resolved selection details (`baseCredits`, `bonusCredits`, `totalCredits`, bundle meta).
- `apps/web/components/WalletPageClient.tsx`
  - Reworked top-up UI to a bundle comparison table surface.
  - Added bundle-based top-up action (posts `bundleId` with fallback amount).
  - Displayed bundle value columns: price, base credits, bonus credits, total credits.
- `apps/api/test/wallet-ledger-idempotency.test.ts`
  - Updated webhook dedupe test to use bundle-derived credit amount and assert credited total includes bonus.

### Implemented
- Structured credit bundles with tiered bonus incentives.
- Wallet top-up flow now resolves bundle-based bonus grants centrally in API pricing code.
- Webhook credit grants remain aligned with `wallet_topups.credits_granted`, including bonus credits.
- Wallet UI exposes explicit bundle value comparison for conversion lift.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `monetisation-phase-2: add starter/growth/mastery bundles, bonus-aware topups, wallet bundle table, and bonus credit tests`

### Phase 3 - Weekly Free Unlock

### Added
- `apps/api/migrations/045_wallet_weekly_free_unlocks.sql`
- `apps/api/test/wallet-weekly-free-unlock.test.ts`

### Changed
- `apps/api/src/db/wallet.ts`
  - Added DB-backed weekly free unlock tracking integration (`wallet_free_unlock_usage`).
  - Added `unlockDetailedReportWithWeeklyFree(...)` with idempotent outcomes:
    - first unlock per week: `free_weekly`
    - subsequent unlocks in week: paid debit
  - Preserved wallet row-lock + balance integrity semantics for paid path.
- `apps/api/src/routes/wallet.ts`
  - Added `POST /wallet/unlocks/detailed-report` (auth + idempotency-key required).
  - Emits `past_paper_unlock` for both free and paid unlock paths with mode metadata.
  - Emits `wallet_debit` event when unlock is paid.
- `apps/web/app/api/past-papers/attempts/unlock-detailed/route.ts`
  - Switched unlock call from `/wallet/debit` to `/wallet/unlocks/detailed-report`.
  - Stores charged credits from API response (supports free unlock with `0` charge).

### Implemented
- One free detailed report unlock per user per week, tracked in Postgres.
- Idempotency remains deterministic across free and paid unlock retries.
- Paid unlock charging continues through wallet ledger debit path.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `monetisation-phase-3: add idempotent weekly free detailed-report unlock tracking and wallet unlock endpoint integration`

### Phase 4 - Detailed Report Value Expansion

### Added
- `apps/web/lib/pastPapers/reportValue.ts`
- `apps/web/test/pastPapersReportValue.test.ts`

### Changed
- `apps/web/app/api/past-papers/attempts/submit/route.ts`
  - Computes and stores detailed-report value signals using current + previous attempt data only:
    - attempt comparison
    - improvement delta
    - weakest domain
    - readiness index
- `apps/web/lib/pastPapers/entitlements.ts`
  - Extended locked-response sanitization to hide `detailedReportValue` when entitlement is absent.
- `apps/web/components/PastPapersLiveClient.tsx`
  - Added unlocked detailed report surface blocks for:
    - readiness index
    - attempt delta/trend
    - weakest domain highlight
- `apps/web/test/pastPapersAccess.test.ts`
  - Added assertions that value-expanded detailed analytics remain hidden while report is locked.

### Implemented
- Detailed report perceived value increased without adding new paid feature types.
- No heavy compute introduced; output derives from existing attempt/analytics data.
- Locking rules remain server-enforced and analytics leakage is prevented for locked attempts.

### Acceptance Criteria Notes
- Expanded report value appears only after detailed report entitlement is active.
- Locked users continue seeing free summary only.
- Value signals are deterministic and test-covered.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run test -w apps/web` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `monetisation-phase-4: expand detailed-report value with attempt comparison, readiness index, and locked-state sanitization`

### Phase 5 - Monetisation Metrics

### Added
- `apps/api/src/db/monetisation.ts`
- `apps/api/test/monetisation-metrics.test.ts`
- `apps/web/app/admin/monetisation/page.tsx`

### Changed
- `apps/api/src/routes/analytics.ts`
  - Added `GET /admin/monetisation?range=7d|30d` (admin-only) returning:
    - `unlock_conversion_rate`
    - `average_credits_spent_per_learner`
    - `weekly_topup_count`
    - `arpu_proxy_zar`
  - Includes supporting totals for attempts, unlocks, spend, revenue, and active learners.
- `apps/api/src/routes/wallet.ts`
  - Added best-effort event emission for top-up initiation (`wallet_topup_created`) in `POST /wallet/topup/create`.
- `apps/api/src/db/product-events.ts`
  - Extended `ProductEventName` union with `wallet_topup_created`.
- `apps/api/test/health-and-analytics-auth.test.ts`
  - Added auth guard assertion for `/admin/monetisation`.
- `apps/web/components/AdminQuickLinks.tsx`
  - Added quick link to `/admin/monetisation`.
- `apps/web/components/AdminSidebarSection.tsx`
  - Added admin sidebar link to `/admin/monetisation`.
- `apps/web/app/admin/page.tsx`
  - Added monetisation card linking to new admin page.

### Implemented
- Dedicated monetisation dashboard route with required launch metrics.
- API-backed monetisation aggregation for 7d/30d windows using existing wallet/attempt datasets.
- Additional top-up instrumentation for funnel observability without changing wallet concurrency or webhook safety behavior.

### Acceptance Criteria Notes
- `/admin/monetisation` loads required metrics from real aggregated data.
- Metrics return safe zero defaults on empty datasets.
- Auth controls enforced for monetisation admin endpoint.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run test -w apps/web` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `monetisation-phase-5: add admin monetisation metrics endpoint/page, topup initiation instrumentation, and coverage tests`

## Continuation - Admin CSRF Hardening

### Changed
- `apps/web/lib/csrf.ts`
  - Added `isValidCsrfToken(request, cookieName?)`.
  - Supports `x-csrf-token` or `x-csrf` header token matching against CSRF cookie.
- `apps/web/lib/equipmentAdminAuth.ts`
  - Added non-safe method CSRF enforcement for all admin web routes using `requireAdminWebRoute`.
  - Requests with missing/mismatched CSRF token now return `403 Invalid CSRF token` before session proxying.

### Added
- `apps/web/test/csrf.test.ts`
  - Added unit coverage for:
    - same-origin allow/deny behavior
    - CSRF token valid/missing/mismatch behavior

### Implemented
- Closed the prior gap where state-changing admin quote/product routes in `apps/web` relied on same-origin + admin session checks without explicit CSRF token matching.
- Hardening applies consistently to all `requireAdminWebRoute` POST/PUT/PATCH/DELETE handlers:
  - `/api/admin/equipment/ingest`
  - `/api/admin/equipment/products`
  - `/api/admin/equipment/quotes/cleanup`
  - `/api/admin/equipment/quotes/[quoteId]`

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run test -w apps/web` [pass]
- `npm run build` [pass]
  - Note: build output includes existing past-papers env validation logs in this local environment, but build completed successfully.

### Emulated Commit
- `continuation-admin-csrf: enforce csrf token matching for state-changing admin equipment web routes with helper tests`

## Structured Pricing Experiment Tracking Sprint

### Phase 1 - Pricing Experiment Log

### Added
- `apps/api/migrations/046_pricing_experiments.sql`
- `apps/api/src/db/pricing-experiments.ts`
- `apps/api/test/pricing-experiments.test.ts`

### Changed
- `apps/api/src/routes/analytics.ts`
  - Added admin endpoint `GET /admin/monetisation/experiments`.
  - Added admin endpoint `POST /admin/monetisation/experiments`.
  - Wired experiment listing response with duration and range-scoped monetisation metrics.
  - Wired experiment creation to close previous active experiment and create next row sequentially.
- `apps/api/test/health-and-analytics-auth.test.ts`
  - Added auth coverage for monetisation experiments GET/POST routes.
- `apps/web/app/admin/monetisation/page.tsx`
  - Added pricing experiment log UI section.
  - Added admin action to create a new experiment from the dashboard.
  - Added active/recent experiment rendering with key metrics.

### Implemented
- Historical experiment table with active-window semantics:
  - one active experiment at a time (`end_date IS NULL` unique partial index).
- Safe sequential experiment creation:
  - closes any active experiment in a transaction before inserting the new active row.
- Admin listing endpoint that returns:
  - experiments with duration
  - associated monetisation aggregates per experiment date range.

### Acceptance Criteria
- Pricing experiment changes via admin flow now produce persisted experiment history.
- Previous active experiment is closed when new experiment starts.
- Admin can query experiment history with associated metrics.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: web build logs existing past-papers env validation warnings in local environment, but build completes successfully.

### Emulated Commit
- `structured-pricing-phase-1: add pricing_experiments log, sequential active-experiment rollover, admin experiments endpoints, and dashboard integration`

### Phase 2 - Metric Association

### Changed
- `apps/api/src/db/monetisation.ts`
  - Added experiment-aware summary mode with optional `experimentId` input.
  - Added experiment lookup by ID (`pricing_experiments`) and date-window scoped aggregation query.
  - Added scoped summary metadata fields:
    - `scope` (`range` | `experiment`)
    - `experimentId`
    - `experimentStartDate`
    - `experimentEndDate`
  - Added null-safe fallback behavior for empty scoped metric datasets.
- `apps/api/src/routes/analytics.ts`
  - Updated `GET /admin/monetisation` query contract to accept optional `experiment_id`.
  - When `experiment_id` is provided, endpoint now aggregates over that experiment window.
  - Returns `404` when provided experiment ID does not exist.
  - Response now includes scope metadata fields for consumer clarity.
- `apps/api/test/monetisation-metrics.test.ts`
  - Added DB-level test for experiment date filtering (asserts start/end window parameters).
  - Added DB-level test for empty experiment-scoped dataset stability (no crash + zero defaults).
  - Added endpoint test for `/admin/monetisation?experiment_id=...` scoped aggregation behavior.

### Implemented
- Monetisation summary endpoint now supports safe historical analysis for a specific pricing experiment period.
- Range-based behavior remains unchanged when `experiment_id` is omitted.
- Scoped metrics remain deterministic and resilient to empty-result conditions.

### Acceptance Criteria
- Experiment date filtering works when `experiment_id` is provided.
- Empty scoped datasets return valid zeroed metric payloads without crashing.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: web build logs existing past-papers env validation warnings in local environment, but build completes successfully.

### Emulated Commit
- `structured-pricing-phase-2: add experiment_id-scoped monetisation summary with date-window metrics and coverage tests`

### Phase 3 - Dashboard Extension

### Changed
- `apps/web/app/admin/monetisation/page.tsx`
  - Added summary scope selector to switch between:
    - rolling range (`7d` / `30d`)
    - specific `experiment_id` window
  - Wired dashboard summary fetch to pass optional `experiment_id` query param.
  - Added scope metadata display on summary panel (range vs experiment, experiment window bounds).
  - Split experiment display into:
    - current active experiment section
    - previous experiments section
  - Expanded per-experiment metric visibility in list (unlock conversion, revenue, top-up count).
  - Added overlap-safety UI guard:
    - detects unexpected multi-active state
    - disables "Start new pricing experiment" action while overlap exists
    - shows explicit warning badge in overlap state.

### Implemented
- Admin dashboard now surfaces active and historical experiment performance with date-scoped summary views.
- Experiment-level metrics are directly explorable from the monetisation dashboard without leaving page context.
- UI prevents new experiment creation when overlap is detected in fetched experiment state.

### Acceptance Criteria
- Current active experiment is displayed.
- Previous experiments are displayed separately.
- Key metrics per experiment are visible in dashboard list.
- UI includes explicit guard against overlapping active experiments.

### Checks
- `npm run lint` [pass] (warnings only, no errors)
- `npm run typecheck` [pass]
- `npm run test` [pass]
- `npm run build` [pass]
  - Note: web build logs existing past-papers env validation warnings in local environment, but build completes successfully.

### Emulated Commit
- `structured-pricing-phase-3: extend admin monetisation dashboard with experiment-scoped summaries, active/previous sections, and overlap safety guard`

## Production Hardening Sprint (2026-05-17)

### Fixed

- `apps/web/app/api/leaderboard/institutions/route.ts`
  - Removed non-existent `user_academic_context` bridge table join.
  - Migration 049 placed `institution_id` directly on `users`; query now joins `LEFT JOIN users u ON u.institution_id = i.id`.
  - Resolves 500 on `GET /api/leaderboard/institutions`.

### Added (502 route migrations — Fastify → Next.js App Router)

- `apps/web/app/api/profile/me/route.ts`
  - Replaces Fastify `GET /profile/me`.
  - Runs profile, follow counts, achievements, and school name in parallel. Includes `computeProfileCompletion` for dashboard nudges.
- `apps/web/app/api/referrals/my-code/route.ts`
  - Replaces Fastify `GET /referrals/my-code`.
  - Generates or retrieves referral code from `referral_codes`; returns shareable URL.
- `apps/web/app/api/referrals/stats/route.ts`
  - Replaces Fastify `GET /referrals/stats`.
  - Returns credited referral count and earned credits.
- `apps/web/app/api/analytics/dashboard-summary/route.ts`
  - Replaces Fastify `GET /analytics/dashboard-summary`.
  - Role-aware (learner/tutor/admin). In-process 20s cache via `globalThis.__dashboardCache`.

### Added (Sentry observability)

- `apps/web/sentry.server.config.ts` — Node.js runtime init with PII scrubbing (`beforeSend`).
- `apps/web/sentry.edge.config.ts` — Edge runtime init (lightweight, tracing off).
- `apps/web/instrumentation-client.ts` — Client init with Session Replay (errors only). Exports `onRouterTransitionStart` for navigation tracing.
- `apps/web/instrumentation.ts` — Updated to `NEXT_RUNTIME` conditional pattern (server vs edge).
- `apps/web/app/global-error.tsx` — Root error boundary capturing exceptions via `Sentry.captureException`.
- `apps/web/next.config.mjs` — Migrated `withSentryConfig` to modern 2-arg form; Turbopack-safe (no tree-shaking options).

### Production env vars set (Vercel)

- `ADMIN_INGEST_TOKEN` — secure random token for admin data ingest endpoint.
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — real Sentry DSN (was placeholder).
- `SENTRY_AUTH_TOKEN` — source map upload token.
- `SENTRY_ORG=ditshego-ventures`, `SENTRY_PROJECT=school-web`.

### Database migrations applied (production)

- `068_language_layer_events` — `language_search_events`, `language_rewrite_events`, `language_feedback_events` tables.
- `069_password_reset` — `password_reset_token`, `password_reset_expires` columns on `users`.

### Security verification

- `ALLOW_DEMO_AUTH=false` ✅ confirmed in Vercel production.
- `ALLOW_FAKE_PHONE_VERIFY=false` ✅ confirmed in Vercel production.

### Known remaining items

- `apps/api` Fastify server (SSE, Redis pub/sub, BullMQ workers) not yet deployed to persistent host — messaging/stream features inactive in production.
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` not set — wallet topups use stub provider only.

### Deployment

- Production deploy: `https://school.ditshego-ventures.co.za` — READY.
- Source maps uploaded to Sentry (`ditshego-ventures / school-web`).

### Emulated Commit
- `production-hardening: fix leaderboard 500, migrate 4 fastify routes to next.js, wire sentry observability, apply migrations 068-069, verify security flags`
