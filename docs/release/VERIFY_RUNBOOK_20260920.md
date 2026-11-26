# Post-Unblock Release Verification — Runbook

Purpose: deterministic, env-driven, secret-safe verification of the production
web platform after the owner completes the infra fixes in
`OWNER_UNBLOCK_CHECKLIST.md`. Every check reports PASS / FAIL / BLOCKED /
NOT-APPLICABLE with route, test, expected, actual, timestamp and evidence —
never "looks good".

Directory that uses its own loader rooted at the repo: `scripts/release-verify/`
(HTTP runner) and `apps/web/e2e/prod/` (Playwright runner). No repository code
is modified by these tools; they only observe the deployed origin.

## 1. Prerequisites

- `BASE_URL` set (the canonical production origin; see §10). Optional
  `API_BASE_URL` for a same-origin-proxy-sensitive backend probe.
- Test identities as environment or `.env.verify` (never committed). See
  `scripts/release-verify/.env.verify.example`.
- Playwright chromium installed once: `npx playwright install chromium`.

## 2. Configuration contract

| Var | Required | Notes |
|---|---|---|
| `BASE_URL` | yes | live origin, e.g. `https://school.ditshego-ventures.co.za` |
| `API_BASE_URL` | no | only if backend is reachable off-origin; default: same-origin proxy |
| `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` | for auth suites | never printed |
| `ADMIN_TEST_USER_EMAIL` / `ADMIN_TEST_USER_PASSWORD` | for admin/matrix | never printed |
| `PAID_TEST_USER_EMAIL` / `PAID_TEST_USER_PASSWORD` | paid suite | never printed |
| `PAST_PAPER_ID` / `PAST_PAPER_ATTEMPT_ID` | paid/attempt suites | known content key |
| `PAST_PAPER_OWNER_EMAIL` / `PAST_PAPER_OWNER_PASSWORD` | unlocked-attempt check | never printed |
| `VERIFY_AI_ANON_DAILY` | no | `1` enables the ~65s daily-cap probe (uses anon budget) |
| `VERIFY_AUTH_AI_LIMITS` | no | `1` checks authenticated limits (uses test-user quota) |
| `REDIS_VERIFY_URL` | no | probes Redis directly; value never printed |
| `METRICS_TOKEN` | no | only if a metrics endpoint is confirmed to exist |
| `VERIFY_OUTPUT_DIR` | no | default `artifacts/release-verify` |
| `ALLOW_INSECURE` | no | `1` + `ALLOW_INSECURE=1` to allow self-signed (staging only) |
| `ENABLE_REGISTER_TEST` / `REGISTER_DISPOSABLE_EMAIL` | no | creates a disposable account when set |
| `PW_*` | no | Playwright knobs: `PW_HEADED`, `PW_SLOW_MO`, `PW_TIMEOUT_MS`, `PW_CONCURRENT`, `PW_OUTPUT_DIR`, `PW_A11Y_GATE` (critical|serious|moderate|off) |

## 3. HTTP runner (`npm run verify:release`)

- `env`: base URL resolvable, origins alive, mandatory identities presence.
- `health`: `GET /health` (`https://school.ditshego-ventures.co.za/health` is
  a Next surface; `https://saedu-api.vercel.app/health` the API) — classifies
  API vs database vs Redis separately; **release-gating**: API unhealthy →
  BLOCKED/FAIL, DB latency/Redis offline → recorded status (not the only gate).
- `guest`: public routes (home, learn, past-papers, community), protected-route
  redirect (`/dashboard` → auth gate), guest AI-limit light probe.
- `auth`: matrix of login/registration edge cases (missing/weak/format fields,
  duplicate, POPIA under-13, rate-limit, invalid login).
- `ai-limits`: anonymous 2/min + 5/day response contract; verified identity
  isolation; authenticated path unaffected; `429` + `Retry-After`.
- `paid-content`: paid:true flag, lockage for non-owners, unlock for owner.
- `checklist-14`: the executable 14-point production checklist.
- `dynamic-claims`: dynamic content presence without fabricated mock data.
- `canonical`: canonical/robots/sitemap/OG/JSON-LD consistency across origins.

## 4. Playwright runner (`npm run verify:release:playwright`, or split:
`journeys`, `a11y`, `perf`, `visual`)

- `journeys`: guest surfaces, guest dashboard (must NOT fire-and-crash authed
  calls), login via the real UI form, authed dashboard, logout → session 401.
- `a11y`: axe-core (CSP-safe via runner injection) with a default serious+
  gate plus landmark / single-h1 / heading-order / 44px / alt checks.
- `perf`: LCP / INP / CLS / TTFB via PerformanceObservers plus a resource
  payload breakdown (JS / image / font / CSS / total), desktop and (with
  `PW_CONCURRENT=1`) throttled mobile via CDP.
- `visual`: 18-viewport matrix (320×568 → 3440×1440, portrait+landscape) with
  overflow, off-screen stacks, clipped fixed/sticky, touch-target and
  screen-ratio-bucket audit; screenshots only under the gitignored artifacts dir.

## 5. Rerun policy

Re-run the full HTTP runner after any infra/service change and after a deploy.
Re-run Playwright at least once per release window or after any UI/CSS change.
Reports stay under `artifacts/release-verify/` (gitignored). To keep in-repo
evidence, copy a redacted report into `docs/release/` with owner-written context.

## 6. Honest classification rules

- PASS requires the successful outcome; anything unasserted is BLOCKED, not PASS.
- A check that cannot be executed (missing creds, infra off, no route) is
  BLOCKED with the reason — the runbook keeps the release blocked until it flips.
- No check prints credentials, tokens, Set-Cookie values or generated cookies.

## 7. Repository hygiene

`artifacts/`, `.env.verify` and Playwright outputs are gitignored. Never commit
a run with real credentials or generated screenshots unless the release
artifact policy explicitly calls for them.