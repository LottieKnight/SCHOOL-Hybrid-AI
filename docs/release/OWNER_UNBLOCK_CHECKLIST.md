# OWNER UNBLOCK CHECKLIST — Production Release

Owner-only actions come first; agent then runs the deterministic verification
tools and produces the final release report. No item below may be skipped.

## A. Infrastructure (owner must resolve)

- [ ] **Railway billing/plan** — trial expired: `Your trial has expired. Please
      select a plan to continue using Railway.`. `school-api` is Failed and
      Redis is Offline. Select a paid plan and resume the API service + Redis.
- [ ] **Supabase** — paused. Resume the database instance and confirm the
      project DNS record so a Supabase reachability probe has a target.
- [ ] **GitHub Secrets / AWS vars** — confirm the `AWS_*` / deployment PAT vars
      are present so release workflows can run on push.
- [ ] **Canonical domain** — confirm which origin is canonical (repo default:
      `https://school.ditshego-ventures.co.za`; production env vars today:
      `saedu-api.vercel.app` on the same origin). Owner decides, the agent
      updates sitemap/robots/metadata/OG/JSON-LD only after confirmation.

## B. After owner resolves A (agent executes)

1. Run `npm run verify:typecheck` (heartbeat that tooling is intact).
2. Run `npm run verify:release` — HTTP runner from
   `scripts/release-verify/`. Release-gating verdicts:
   - API health suite → PASS (once `school-api`/Redis are back).
   - Hard-gate 1 live AI-limit checks → PASS (2/min + 5/day).
   - Auth matrix → PASS with the granted test identities.
   - Paid-content and unlocked-attempt checks → PASS.
3. Run `npm run verify:release:playwright` — journeys, axe (serious+ gate),
   perf budgets (LCP ≤ 2.5–3 s, CLS ≤ 0.1, INP ≤ 200 ms, TTFB ≤ 800 ms on
   the live origin), visual 18-viewport matrix.
4. Fix any FAIL; re-run until green. BLOCKED (not FAIL) items are listed in
   the report with the reason and the owner action needed.
5. Produce the final release report from `RELEASE_REPORT_TEMPLATE.md`,
   quoting the report files under `artifacts/release-verify/`, and record the
   canonical-domain decision explicitly.

## C. Definition of "unblocked"

- ALL owner items in A are resolved (billing, database, secrets, canonical).
- HTTP runner: 0 FAIL (BLOCKED items only where an owner decision is pending
  and cited).
- Playwright: journeys green; a11y serious+ gate green; perf budgets green on
  the live origin; visual matrix green.
- Rationale: with 196/196 web unit tests, strict `tsc --noEmit` and eslint
  clean, and the anonymous AI limiter already server-side, the only remaining
  black boxes are the live infrastructure and the production surfaces these
  tools verify.