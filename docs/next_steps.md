# SA Education Platform — Next Steps

**Derived from:** `RESTRUCTURE_PLAN.md`, `MVP_OPERATIONS.md`, `system_report.md`  
**Note:** *school_analysis_1.jsx* was not found in the workspace; recommendations below are from the existing docs and current codebase.

---

## Summary of recommended implementation steps

The restructure plan defines this **rollout sequence**:

| Phase | Focus |
|-------|--------|
| **0** | Baseline docs, changelog, verify scripts/checks |
| **1** | Security hotfixes (P0/P1) |
| **2** | Wallet ledger + webhook idempotency |
| **3** | Past papers monetized unlock flow |
| **4** | Equipment quote-only rework |
| **5** | Messaging performance split/lazy refactor |
| **6** | SEO baseline (robots, sitemap, opengraph) |
| **7** | Final docs/cleanup and residual TODO capture |

**Current state (from MVP_OPERATIONS):**

- MVP loop (Learn → Past Papers → Marking → Progress → Wallet) is **implemented**: wallet debit for detailed report, idempotency key, entitlement marker in web SQLite.
- Equipment is **quote-only**; messaging has **lazy-loaded** client modules and deferred SSE.
- Phases 0–4 are largely reflected in code; remaining high-value work is **Phase 1 (security)**, **Phase 5 (messaging polish)**, and **Phase 6 (SEO)** plus ongoing **verification and docs**.

---

## Prioritized task list for immediate implementation

Focus: **smallest high-leverage next move** first.

### 1. **Fix README migration command** (≈5 min) — smallest move

- **What:** In `README.md`, change “Run migrations: `npm run migrate -w apps/api`” to “Run migrations: `npm run db:migrate`” (root script).
- **Why:** Reduces setup confusion and matches root `package.json` scripts.
- **Where:** `README.md` (Local Dev / Run migrations step).

### 2. **Run full verification and fix regressions** (≈30–90 min) — highest leverage ✅ (in progress)

- **What:** From repo root, run in order:
  - `npm run lint` (can be slow on first run)
  - `npm run typecheck` (includes `check:lesson-boundary`) ✅
  - `npm run test` ✅
  - `npm run build` (Next.js build may take several minutes)
- **Why:** Establishes a green baseline for all later phases; required by RESTRUCTURE_PLAN verification strategy.
- **Fix applied:** Web `typecheck` was failing with "Cannot find module '@saedu/shared'". Added path mappings in `apps/web/tsconfig.json`: `"@saedu/shared": ["../../packages/shared/src"]` and `"@saedu/shared/*": ["../../packages/shared/src/*"]` so `tsc --noEmit` resolves the workspace package. Typecheck and test now pass.
- **If failures:** Fix within scope of Phase 0 (no new features). Record outcome in `CHANGELOG_RESTRUCTURE.md`.

### 3. **Clean web build cache (if needed)** (≈2 min)

- **What:** If you see “The system cannot find the path specified” under `apps/web/.next/`, run:
  - `Remove-Item -Recurse -Force apps/web/.next` (PowerShell) or `rm -rf apps/web/.next`, then `npm run build -w apps/web` or `npm run build`.
- **Why:** Resolves stale/broken symlinks in `.next` on Windows.

### 4. **Confirm Phase 1 security invariants** (≈15–30 min)

- **What:** Ensure production safeguards are documented and enforced:
  - `ALLOW_FAKE_PHONE_VERIFY=false` and `ALLOW_DEMO_AUTH=false` in production.
  - Cookie-auth write endpoints require CSRF; webhooks and debit APIs are idempotent.
- **Why:** P0/P1 security before further feature work.
- **How:** Review `.env.example` and any deployment checklists; add a short “Security checklist” to `docs/MVP_OPERATIONS.md` or `SECURITY.md` if missing.

### 5. **Phase 6: SEO baseline** (≈30–60 min)

- **What:** Add or verify App Router metadata:
  - `app/robots.ts`
  - `app/sitemap.ts`
  - `app/opengraph-image.tsx`
  - Update branding metadata to SCHOOL for key route surfaces.
- **Why:** Low-effort, high-impact for discovery and sharing.

### 6. **Phase 5: Messaging performance** (as needed)

- **What:** Confirm `/messages` is already:
  - Server shell + lazy-loaded client modules (list, thread, composer, heavy tools).
  - SSE deferred until thread interaction; one active SSE per client; bounded reconnect.
- **Why:** MVP_OPERATIONS states this is done; only revisit if regressions or performance issues appear.

### 7. **Phase 7: Docs and TODOs**

- **What:** Update `CHANGELOG_RESTRUCTURE.md` with phase checkpoints; capture any residual TODOs in `docs/next_steps.md` or the changelog.
- **Why:** Keeps the restructure auditable and next steps explicit.

---

## Smallest high-leverage next move (recommended)

**Do this first:** **Task 1 (README migration command)** then **Task 2 (full verify: lint → typecheck → test → build)**.

- One is a trivial doc fix that reduces friction for every new dev.
- The other is the single highest-leverage action: a green baseline unlocks confident work on security (Phase 1), SEO (Phase 6), and any later refactors.

After that, proceed in order: Task 3 if build cache is broken, Task 4 for security, Task 5 for SEO, then 6–7 as needed.
