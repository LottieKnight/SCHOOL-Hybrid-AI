# Secondary Audit Notes — Phase 0.5 Release (2026-09-20)

Companion to `AUDIT_PHASE0.5.md`, `ROUTE_INVENTORY.md`, and `INFRA_RECOVERY_CHECKLIST_20260920.md`.
This file records the non-infrastructure secondary audits (A–I) completed on `release-week-0.5-p0`.
Audits that require a live deployment (visual regression, live a11y sampling, live performance) are
marked **BLOCKED ON INFRA** and restored once Railway + Supabase are recovered (see checklist).

## A. Dynamic / fabricated claims — PASS (one fix landed)

Scanned the whole marketing + dashboard surface for hardcoded counters, fake people, and "live"-style claims.
- **REMOVED (this commit):** `StudentSpotlight.tsx` fabricated the person "Tebogo M." with no data source.
  Component removed from render list in `DashboardHomeClient.tsx`; file + CSS module deleted.
  No loss of functionality — there was no backing query anywhere.
- `LiveSignalBar` shows a **"LIVE"** pulse but renders `null` when `/api/growth/summary` returns nothing —
  no fabricated number ever appears. Route is DB-backed (`growthDb.ts`: Redis counters + `queryPlannerDb`);
  falls back to honest zeros on outage.
- `LiveAnchor` posts a real "last paper added" date from `prisma.pastPaper.findFirst` and renders an
  **"Unavailable"** line when the query throws.
- No hardcoded "30,000+ papers"-style counters anywhere in UI-land (searched all `apps/web`).
- Financial/credits claims live on the server ledger (see D).

## B. AI Tutor UX — PASS in spirit; minor gaps noted

`/assistant` (client component) assessed against: context chips, guest guard, streaming/error/offline, input preservation.
- **Context chips: PASS.** Subject chips (auto-detect + 10 subjects), mode chips (mixed/explain/quiz),
  socratic + voice toggle chips, language-insight chips (intent/domain/code-switch), CAPS sources row,
  cached-vs-fresh cache chip, memory "new territory" chip.
- **Loading/error states: PASS.** Inline `thinking` indicator, `disabled` while pending, `assistant-error` block,
  per-action error strings; server 429 (rate/daily cap) is surfaced as-is.
- **Input preservation: PASS within session.** `material` state survives mode/subject toggles, Socratic flips,
  and failed retries. `?q=` prefill applies once (guard via `prefillApplied` ref). No cross-navigation persistence
  (acceptable for a tool page).
- **Guest guard: REMEDIATED (2026-09-20).** Guests previously had no server-side limit
  (`if (userId)` guards in `study-assistant/route.ts`); the lone `useGuestLimit` cap was localStorage-only
  and is NOT a security boundary. A server-side anonymous limiter now enforces a network-identity bucket
  (see **Hard Gate 1 — AI Guest Rate Limiting** below). `useGuestLimit` remains for UX messaging only.

## C. Command Palette — GAPS (fix scoped, deferred)

`CommandPalette.tsx` + `CommandPalette.module.css`.
- PASS: Cmd/Ctrl+K toggle, Escape closes, ArrowUp/Down + Enter list navigation, infix filtering, empty-state.
- GAP 1 — a11y: dialog is a plain `div`; no `role="dialog"` / `aria-modal="true"`, no focus trap, no focus restore
  to the opener, results are not a `listbox` (+ `aria-activedescendant`).
- GAP 2 — mobile: single centered dialog on every viewport (no bottom-sheet treatment; `max-height: 380px`) —
  results list can overflow on small phones.
- GAP 3 — no recents / contextual results (static command table only). Acceptable for now; noted as enhancement.

## D. Scholar Credits honesty — PASS

`/credits` (ScholarCreditsClient) + `apps/api/src/db/{wallet,credits}.ts`, `routes/credits.ts`.
- Balance, lifetime earned/spent, per-wallet balances all server-computed; offline shows `fromCache` + sync-state
  badges so a stale figure is explicitly labelled.
- Transactions render amount, venture badge, `description` (reason), `source`, and `createdAt` timestamp.
- Ledger stores `balance_before` / `balance_after` per entry → no client-computed arithmetic.
- Guest state shows a sign-in prompt instead of fabricated balance.

## E. Targeted idempotency — PASS (server-keyed by construction)

- `wallet.ts`: `SELECT … FOR UPDATE` row lock + `getLedgerEntryByIdempotencyKey` + `ON CONFLICT DO NOTHING`
  (free unlocks). Ledger dedupe on `idempotency_key`.
- `quiz/submit/route.ts`: keys `daily-quiz:${userId}:${quizDate}` and `daily-quiz-streak:${userId}:${quizDate}` —
  deterministic per user+day, **cannot double-earn** even on client retries.
- `auth/registration.ts`, `wallet.ts`, `credits.ts`, `community.ts` (reactions/casual karma via creditWallet),
  `games/scores`, `language/feedback`, `past-papers/.../unlock-detailed`: all accept/derive idempotency keys.
- Planner saves are PUT-by-resource-id (naturally idempotent).
- Note: keys are derived server-side rather than client-supplied — safer (client can't forge/normalise to bypass),
  and retries reuse the same key automatically.

## F. Design tokens — two layers, ADDITIVE only

- `ditshego-design-system.css` (170 LOC): full `--dv-*` palette (value/olive/trust/success/warning/error/info,
  neutral gray ramp, backgrounds, text, plus `--radius-*`).
- `globals.css` (3579 LOC): `:root` + dark/low-vision variants define `--gold*`, `--space-1..5`, `--radius-sm/md`,
  `--danger`; `ditshego-design-system.css` also carries radius tokens.
- **Not yet present:** `--ink/paper/brass/teal/blue/coral` token family. Intro goes in as an **additive** layer once
  we can run visual regression (no one-shot rewrite). Fonts unchanged.

## G. Accessibility — static PASS so far; live checks BLOCKED ON INFRA

- All 21 `/api/admin/*` mutation routes internally guard `role === "admin"`.
- Command palette deficiencies above (C-GAP1) are the main static find; a11y sweep (contrast, landmarks,
  focus order, reduced-motion) is scheduled for Playwright once staging/prod is live.

## I. Static security sweep — PASS (deferred live checks)

- **No secret leakage**: no `console.*` of tokens/secrets in `apps/api` (only the not-set RESEND_API_KEY notice);
  credentials scan of repo + `docs/release` + `/tmp` clean (2026-09-20 pass).
- **Auth on all user-data/mutating web routes**, incl. everything under `/api/admin`, past-papers attempts
  (start/save/submit/review/unlock/bookmark), questions/add, profile/me. Verified guard on every admin file.
- **Two unauthenticated exceptions are benign**: `locale` + `lesson-language` (cookie preference only),
  `equipment/cart/validate` (read-only pricing check, no PII/mutation).
- **AI anonymous abuse REMEDIATED (2026-09-20)** — see Hard Gate 1 below. Previously unauthenticated AI usage
  bypassed per-user rate/daily limits in `apps/web/app/api/study-assistant/route.ts`.

---

## HARD GATE 1 — AI Guest Rate Limiting

**Status:** `FAIL — P1 / RELEASE BLOCKER PENDING REMEDIATION` → **REMEDIATED (code), live verification pending.**

**Current behaviour (pre-fix):** every anonymous POST to `/api/study-assistant` could reach an LLM provider
(Ollama/OpenAI/Anthropic), run embeddings via `embedQuery`, run RAG retrieval via `getRAGContext`, and write
Redis cache entries. No middleware/API-platform limiter protected the route. `aiRateLimit.ts` applied only when
`userId` existed (`if (userId)` / `if (userId && !paid)` guards in `route.ts`), so guests bypassed both the
per-minute and daily limits. `useGuestLimit` (localStorage, cap 1) is client-side and trivially resettable; it is
not a trust boundary.

**Cost exposure:** a guest request can trigger an LLM call + embedding + RAG retrieval + optional cache writes.
Material capped at 8000 chars; no attachment on this route.

**Trust boundary (post-fix):** server-derived network identity from proxy-set `x-forwarded-for` / `x-real-ip`
(reuses the `equipmentQuoteGuard.getClientIp` precedent). A client-supplied user ID is never used as the boundary.

**Protection implemented (2026-09-20) — `apps/web/lib/aiAnonymousLimit.ts`:**
- Rate window `60s`, max `2` requests per minute per identity.
- Daily window `86400s`, max `5` increments per identity per day.
- `429` + `Retry-After` on breach; body flags `anonymousLimitReached`.
- Hooks into `study-assistant/route.ts` POST before any authenticated rate check or LLM call.
- Authenticated per-user limits (10/min, 10/day free, paid unlimited) are UNCHANGED.

**Redis dependency / fail-open decision:** existing authenticated limiter (`aiRateLimit.ts`) fails OPEN when Redis
is unavailable/erroring (documented, unchanged). The new anonymous limiter uses **Redis primary → in-memory
fallback** (same per-instance pattern as `equipmentQuoteGuard.ts`), so it never fails silently open during a
Redis outage; it degrades to weaker per-instance enforcement. Multi-instance parity requires Redis. In-memory
buckets are process-local (no cross-instance coordination) — documented limitation.

**Semantics:** increment-before-check (blocked attempts still consume a window increment), matching
`aiRateLimit.ts`. `unknown` identity is a shared fallback bucket for requests with no usable address header.

**Tests:** `apps/web/test/aiAnonymousLimit.test.ts` (8 cases): identity extraction, first-request allow,
burst `429` with `Retry-After`, per-minute reset with daily retention, per-IP independence, header determinism.
Full suite `apps/web` 196/196 green; `tsc --noEmit` clean.

**Required live verification (post-infra, per directive):**
1. guest first request succeeds; 2. guest burst blocked; 3. `429` + `Retry-After` present; 4. clearing
localStorage does NOT reset the server limit; 5. changing client-supplied IDs cannot bypass; 6. same-IP
consistency; 7. authenticated per-minute limit intact; 8. free/trial daily limit intact; 9. paid-account
semantics intact; 10. Redis-down behaviour verified (authed fail-open; anonymous degrades to in-memory).

## HARD GATE 2 — Paid Answers / `paid:true`

**Status:** `PASS` (serializer trace complete).

**Origin of `paid:true`:** `apps/web/app/api/study-assistant/route.ts` GET — `if (!userId || paid) return
{ paid: true }`. It is a usage-meter flag ("caller does not consume the free daily meter"), NOT an
authorization field and NOT a payment-status field. No content is returned by this GET.

**Guest payload:** `{ paid: true }` (**metadata only**). The sole consumer (`StudyChat.tsx`) returns early for
guests and paid users before rendering; the guest UI instead reads `authState.isGuest` and shows an upgrade
prompt. No protected answer/report content is on this path.

**Protected content exposure:** NO.

**Detailed-report data trace (complete):**
1. `submit/route.ts` computes `detailedReportValue` and writes `analyticsJson` (owner-scoped).
2. `entitlements.ts` `sanitizeAnalyticsForClient` strips `perQuestion`, `memoSnippet`, `detailedReportValue`
   unless `detailedReport.unlocked === true`.
3. `attempt/page.tsx` + `classes/.../live/page.tsx` (server components): `getUserIdFromRequest()` → 
   `resolvePastPaperAttemptAccess` (requires `viewerUserId === attemptUserId`) → `404` when not owner →
   sanitizer runs BEFORE `analytics` prop reaches the client.
4. `unlock-detailed/route.ts`: auth 401, owner scope (`attempt.userId !== userContext.userId → 404`),
   `canUnlockDetailedReport` (FORBIDDEN for non-owners, NOT_MARKED, ALREADY_UNLOCKED), wallet debit via API with
   idempotency key; entitlement marker written only after a successful charge.
5. `review/route.ts`: owner-scoped + gated behind `isDetailedReportUnlocked` (402 when locked).

**IDOR/BOLA status:** PASS — a non-owner's attempt ID yields `404`/`FORBIDDEN` on every read+write path;
reports, answers, analytics, detailed results, and wallet data are all owner-scoped server-side. Frontend
hiding is not relied upon.

**Alternate access paths:** NONE found — the only two analytics readers are sanitizing server components; no
GET API serves report content; no report-ID route; cached responses are per-user; `save` writes only timeSpent.

**Required action:** none (code). Live auth-matrix + targeted BOLA tests scheduled for the post-infra stage.

## HARD GATE 3 — Student Spotlight

**Status:** `PASS` — fabricated Student Spotlight removed. `StudentSpotlight.tsx` + `.module.css` deleted and
unwired from `DashboardHomeClient.tsx` (commit 780dff8). Source-level search (excluding `.next`/`node_modules`/
audit docs) finds no remaining code references. The `Tebogo M.`/`StudentSpotlight` mentions above remain only as
deliberate audit evidence.

## HARD GATE 4 — Command Palette

**Status:** `DEFERRED (post-release unless a11y fails live).`
Keyboard interaction verified by code inspection: open `Ctrl/Cmd+K`, navigate `ArrowUp/Down` with selected
index, select `Enter`, dismiss `Escape`/click-away. Missing advanced semantics (dialog role/aria-modal, focus
trap/restore, mobile bottom sheet, recents) recorded in section C and deferred; no redesign while P0
infrastructure is unresolved. Live keyboard verification runs in the production Playwright/a11y stage.

## To do after infra recovery
- 14-point production verification + auth matrix (register/login/session/logout/authz/protected routes/deep links).
- Playwright run: a11y landmarks/focus/contrast, reduced-motion; live performance (LCP/INP/CLS, bundles, fonts,
  constrained mobile profile); visual regression across 18 viewports (320×568 → 3440×1440, port+land).
- Re-evaluate C (palette a11y + mobile sheet) and B-guest-guard with production data; then final RELEASE STATUS.