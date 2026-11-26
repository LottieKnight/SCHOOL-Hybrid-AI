# Infrastructure Recovery Checklist — 2026-09-20

Owner-gated actions required to restore production. Everything that could be
diagnosed/repaired via CLI has been done; these four items need dashboard /
billing / repo-config access that the agent does not have.

---

## 1. Railway — select a plan (billing)

**Status:** BLOCKED — trial expired. `railway redeploy` returns: *"Your trial has
expired. Please select a plan to continue using Railway."*

**Why it matters:** the `school-api` service has had zero successful deployments
since Aug 5–6 (all FAILED/REMOVED). The actual failure was diagnosed and is
already fixed in the repo (see §5); the only blocker to redeploying is billing.

**Action (owner, `privacy@ditshego-ventures.co.za`):**
1. Log in at https://railway.app and choose a plan for account
   `lottieknight`'s project **sunny-luck** (production environment).
2. After billing is active, run:
   ```sh
   railway service redeploy --service school-api --from-source --yes
   ```
   This builds the latest `main` (a577d26) — the lockfile fix is in it.

**Verify after:** deployment SUCCESS; container stays up (no restart loop);
`/health` returns 200 (see §6).

---

## 2. Supabase — resume the paused project (billing)

**Status:** BLOCKED — project paused since 2026-09-01; requires dashboard
resume + payment. No `supabase` CLI/access-token is available to the agent, and
resuming a paused project is a dashboard/billing owner action.

**Identity of the database:** the Railway `school-api` `DATABASE_URL` points at
the Supabase Pooler for project ref **`saedu_vercel_auth`**
(`aws-1-eu-central-1.pooler.supabase.com:6543`). This is the *same* DB used by
the Vercel-hosted Next app (`POSTGRES_URL`). Auth/session data, `user_xp_ledger`,
planner, wallet, analytics all live here.

**Action (owner):**
1. https://supabase.com/dashboard → project **`saedu_vercel_auth`**.
2. Resume the project (this re-enables billing on that project).
3. Confirm the Pooler endpoint is reachable again from:
   - the **Vercel** app env (`POSTGRES_URL`),
   - the **Railway** app env (`DATABASE_URL`).

**Verify after (agent will run when unblocked):**
- Postgres reachable via `railway connect postgres` (or a TCP probe).
- Supabase Auth reachable (`/auth/v1/health`).
- Existing users preserved (no `auth.users` wipe).
- Schema intact (`user_xp_ledger`, planner, wallet tables).
- RLS policies intact.
- Migrations consistent with `apps/api/migrations`.
- Required extensions available (e.g. `pgcrypto`/`uuid-ossp` if used).
- Application DB connection succeeds.

**Do NOT:** create a new project; migrate users; re-architect auth.

---

## 3. GitHub — repo variables + PAT scope (owner)

**Status:** PARTIAL.

### 3a. ECS deploy workflow — missing repo variables
Latest ECS run (2026-09-15, run 35023979921) fails at step "Configure AWS
credentials (OIDC)" with:
```
##[error]Input required and not supplied: aws-region
```
because `env.AWS_REGION` (`${{ vars.AWS_REGION }}`) is empty. Terraform default
is **`af-south-1`**.

**Action (owner):** GitHub → repo **SCHOOL-Academic-Platform** → Settings →
Secrets and variables → Actions → Variables. Add/create:
- `AWS_REGION` = `af-south-1`
- `ECS_CLUSTER` = (per `infra/aws/terraform`, cluster name for `school`)
- `ECR_REPOSITORY_API` and `ECR_REPOSITORY_WEB` = the ECR repo names created by
  terraform (`school-api`, `school-web` — confirm from terraform output).

(Verify with `gh variable list` after the PAT scope in 3b is granted.)

### 3b. GitHub PAT scope
The local `gh` token is a fine-grained PAT that lacks **`Actions: read`** (so
the agent can list workflows/runs but not read secrets/variables via API). The
agent does **not** modify credentials — owner-only.

**Action (owner):** grant the PAT (or add repo-level) the scopes it needs if it
is the one used by workflows that push: **`contents: write`** and
**`actions: read/write`** as appropriate. For the ECS/ingest workflows the
permissions come from OIDC + repo variables, not the PAT, so 3a is the real
blocker for those.

### 3c. Play signing key (deadline Sep 30 2026)
Separate owner deadline from `docs/engineering/OPS_TRIAGE_20260914.md` — keep
on radar; not a code change.

---

## 4. Canonical domain — OWNER DECISION REQUIRED

**Status:** unresolved contradiction, deliberately not changed:

- Repo defaults (`apps/api/src/config.ts`, `docs/DEPLOY_RUNBOOK.md`, terraform
  `project_domain`): `https://school.ditshego-ventures.co.za`
- Railway `APP_URL` / `NEXT_PUBLIC_SITE_URL` on the backend: `https://saedu-api.vercel.app`
- Served sitemap on Vercel: `school.ac.za`

**Action (owner):** confirm one canonical origin for production (sitemap,
robots, canonical metadata, OpenGraph, redirects, email/`EMAIL_FROM` domain).
Agent will then align env + code (no SEO config has been touched).

---

## 5. Root-cause summary (diagnosis for the record)

| Component | Status | Root cause | Blocker to fix |
|---|---|---|---|
| `school-api` deploy | FAILED since 2026-08-05 | Docker `npm ci` error: lockfile `next@16.2.6` vs `apps/api` requires `16.2.11` → every build since Aug 4–5 failed | ALREADY FIXED in `main` (lockfile now resolves nested `16.2.11`; `npm ci --dry-run` + `npm run build -w apps/api` both pass locally). Needs a Railway redeploy → blocked only by §1 billing |
| Redis (env) | external target, TCP-reachable | not the offline Railway Redis (ca18b060) | none observed; re-verify `/health` after §1+§2 |
| Redis (Railway service `ca18b060`) | Offline | 218/500 MB volume intact; no deployment to restart | owner: restart from dashboard once billing active (§1) — app may not depend on it (see §6) |
| Supabase project | paused 2026-09-01 | billing | §2 |
| ECS deploy | failed since 2026-08-22 | missing `vars.AWS_REGION` (and maybe ECR/ECS vars) | §3a |
| Past Papers Ingest | failing every 4h | `curl --retry-status` unsupported on runner → `curl_exit=2` | FIXED in commit b6af59c (drop flag) — no longer on `main` until pushed; independent of PAT for execution once pushed |
| Auth (login/register/session) | 404/blocked | superset of above: backend down + DB paused | §1 + §2 + redeploy |

---

## 6. Expected post-recovery verification

Next steps executed by the agent once §1 and §2 are unblocked:

```sh
railway service redeploy --service school-api --from-source --yes   # §1
# then:
curl -s https://school-api-production-2ff7.up.railway.app/health    # expect 200 ok
# verify DATABASE_URL (Supabase) status and REDIS_URL status fields
# exercise /api/health proxy through Vercel web
# then full auth matrix (§9 of hand-back) when Supabase is up
```

Note: Redis is best-effort caching; authentication is DB-bound (Postgres), so
Redis availability must NOT be treated as equivalent to Supabase availability.

### What actually depends on Redis (apps/api, from source)

| Module | Depends on Redis? | Effect if Redis down |
|---|---|---|
| `src/cache.ts` | primary cache store | callers get per-command failures; must handle (see below) |
| `src/lib/login-lockout.ts` | yes — failed-login counter/hard lockout | lockout defence degrades to non-persistent (per-process) state |
| `src/lib/phone-otp.ts` | yes — OTP code + attempt counter | OTP issue/verify fails if cache calls throw unchecked |
| `src/lib/messageBus.ts` (queue/index, brandWorkers) | yes — pub/sub + queue | `redisEnabled` flips false; pub/sub-based jobs degraded |
| `src/lib/bookstore-licensing.ts`, `license_rules.ts` | cache lookups | cache miss → refetch from DB (still functional) |
| `config.ts` | reads `REDIS_URL` (required) | config parse requires the var to be SET, but only lazily connects |

Pool/lazy analysis (`pool.ts`, `cache.ts`): Redis is `lazyConnect:true` + error
swallower, Postgres pool is lazy — so boot succeeds with DB/Redis down; runtime
calls that hard-require Redis (OTP, lockout, messageBus) are the real
dependencies. Auth itself (register/login/session) is Postgres-bound and not
in the set above.