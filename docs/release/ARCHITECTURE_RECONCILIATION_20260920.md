# Release Architecture Reconciliation (Phase 0.5)

Decision document per the release-week directive. Every proposed change from the SCHOOL redesign
handoff is classified on evidence (repo audit + production probe):

- **A — MUST change before release** (correctness, security, usability, core UX)
- **B — SHOULD change before release** (high value, manageable risk)
- **C — POST-RELEASE architecture** (desirable, too risky for next week)
- **D — DO NOT change** (already sufficient)

Evidence base: `docs/release/PRODUCTION_AUDIT_20260920.md`, `docs/release/ROUTE_INVENTORY_20260920.md`, repo audits (routes/IA, API/entities, design system).

---

## 1. Infrastructure (the actual release blocker)

| Item | Class | Rationale |
|---|---|---|
| Restore Supabase Postgres | **A** | Paused since 09-01 (owner/money). Leaderboard, planner, wallet, analytics 500 without it. |
| Redeploy `school-api` (Railway Fastify) | **A** | Service **Failed**; all proxied `/api/*` and **auth** 404. Login/register/session dead. |
| Restore Redis | **A** | Offline. Leaderboard cache + rate limits degraded. |
| Patch GHA PAT (workflows scope) | **A** | `saedu-api-server` and ingest deploy blocked since Aug 25 / Sep 13. |

## 2. Handoff-proposed changes → classification

| Proposed change | Class | Evidence / decision |
|---|---|---|
| **AcademicContext** aggregate table + endpoint | **C** | Fragmented but working (institutions, academic_calendars, student_university_profiles). No correctness gap today; building an aggregate pre-backend-restore is waste. |
| **Module** entity + module catalog DB | **C** | Static `moduleContent.ts` serves now; no live bug. Backfill only after infra + core loop green. |
| **TutorConversation / TutorMessage** dedicated tables | **C** | Generic `conversations`/`messages` persist chat fine. New tables not justified by any live failure. |
| **Planner** web→Fastify move | **D** | Planner intentionally lives on Vercel serverless with its own `pg` pool. The 500 is a DB-down symptom, not an architecture defect. Fix the error handling (A/B) not the architecture. |
| **AI Tutor** "contextual workspace" redesign + context object | **B** | Existing `/assistant` + `/study` chat works; add explicit context chips + offline/error/history states + guard guest calls. No new backend. |
| Cursor pagination everywhere | **D** | Community keysets already; past-papers offset is reliable. Directive: no migration for theoretical consistency. |
| Idempotency everywhere | **B (targeted)** | Already enforced for wallet/credits. Add keys to posts, accepted answers, planner mutations, purchases; document semantics per op. Do not add a global middleware. |
| `capabilities` object from APIs | **B** | Currently absent. Cheap: expose per-route capabilities for feature flags (reuse `evaluateFeatureFlag`) so frontend can label live/coming-soon/experimental honestly. |
| Unified backend search endpoint | **C** | Search today is scoped (messages, library, semantic). A global normalized endpoint is post-release; command palette wants a modest web-scoped endpoint only. |
| Offline editing + "will sync" claims | **A (honesty fix)** | Only *cached/read-only* offline exists. Replace any "saved work will sync" copy with accurate wording; keep lightweight text/nav caching. |
| Design-system token migration (ink/paper/brass etc.) | **B** | Additive tokens + gradual component mapping per directive §7. NOT a 3,500-line rewrite. Fonts stay Playfair/Archivo/JetBrains Mono unless verified better (directive §8). Current motion + reduced-motion already compliant. |
| Five-destination navigation | **D** | `navManifest.ts` matches handoff; mobile bottom nav + safe-areas + 44px already done. AI Tutor stays prominent. |
| Command palette improvement | **B** | Improve existing static palette: focus trap, recent items, contextual results, modest web search, mobile full-screen sheet. Never fake search. |
| Community / Module Room redesign | **C** | Functionality exists and works; post-release polish after backend healthy. |
| Scholar Credits "ledger transparency" redesign | **B** | Backend is server-authoritative w/ idempotency already. UI only: show human-readable reason + timestamp; do NOT optimistic-finalise balances. |
| Authentication changes | **D** | Do not redesign auth. **A** applies to *restoring* it (see §1). Verify sessions/cookies after backend restore. |
| Home dashboard hierarchy | **B** | Apply Next Action > Continue Learning > Performance > Upcoming > Campus (already largely present in `DashboardHomeClient`); fix guest crash (P0 code). |

## 3. Code-level P0 found (safe to fix now — no infra dependency)

| Item | Where | Fix |
|---|---|---|
| Dashboard guest crash (`TypeError … 'length'`) | `apps/web/app/dashboard/page.tsx` / `DashboardHomeClient` | Guard guest branch: skip authed queries; fix `.length` on possibly-undefined; render empty/guest state, never error boundary |
| Leaderboard / planner / onboarding-university raw 500s | `community/leaderboard/page.tsx`, `planner/page.tsx`, `university` onboarding | Wrap server fetches; render "Unavailable — retry" state instead of 500 when DB/backend is unreachable |
| `/api/leaderboard/*` 500 → friendly state | `app/api/leaderboard/*` | Catch DB/Redis errors → `503 {source:"offline"}` + UI retry |
| `/classes` 404 | `app/classes` | Redirect root to `/past-papers` (or remove from robots if legacy) |
| sitemap.xml wrong domain | `app/sitemap.ts` | Emit `https://school.ditshego-ventures.co.za` |
| CSP block of inline styles | `middleware.ts` | Add `style-src-attr 'unsafe-inline'` (keeps nonce for style elements); optionally migrate inline styles |

## 4. Sequencing

1. **A (infra, owner):** Supabase → Redis → Railway `school-api` redeploy → PAT.
2. **A (code, parallel):** dashboard guest fix, error-state hardening, sitemap, CSP.
3. **B code:** targeted idempotency, capabilities labels, command palette, AI-context chips, credit-ledger UI honesty.
4. **B design:** incremental tokens only after step 1–3 land.
5. **C backlog:** Module entity, AcademicContext, unified search, community redesign, TutorConversation if ever justified.
6. **D, protected:** navigation, auth design, pagination style, existing motion/offline approach, Past Papers data layer.