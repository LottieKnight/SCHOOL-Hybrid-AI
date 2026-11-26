# POPIA CLOSING TICKETS — Phone Encryption & Data-Retention Cron
**Owner:** DITSHEGO VENTURES (PTY) LTD t/a SCHOOL · **Date:** 2026-08-25
**Context:** These two items were flagged "Pending" in the master plan but are in fact
**already implemented in code**. This document records the *actual* remaining work:
provisioning/activation (not net-new development) plus one deployment-topology risk.
Evidence file paths are cited so the work can be handed directly to a dev (e.g. opencode).

---

## TICKET A — Activate phone-number encryption (POPIA Q18–Q23)

**Status of code:** DONE. Already present:
- `apps/api/src/lib/phoneEncryption.ts` — AES-256-GCM encrypt/decrypt + HMAC-SHA256 hash.
- `apps/api/migrations/076_phone_number_encryption.sql` — adds `phone_number_hash`,
  drops plaintext UNIQUE, adds partial unique index on the hash.
- `apps/api/src/db/users.ts` — `createUser()` encrypts + hashes when key is configured;
  `resolvePhone()` decrypts on read; `softDeleteUser()` nulls both columns.
- `apps/web/scripts/encrypt-existing-phone-numbers.ts` — one-time backfill (legal → encrypted).
- `apps/api/src/config.ts:58,125` — reads `PHONE_ENCRYPTION_KEY` (optional, default "").

**Why it is still "not satisfied in production":** `PHONE_ENCRYPTION_KEY` is **not** in
either `.env.example` (root or apps/api), so in any environment without it,
`config.phoneEncryptionKey` is `""`, `isKeyConfigured()` returns false, and `createUser()`
falls back to storing the phone in **plaintext** (`users.phone`). The migration 076 may
also not yet be applied on the live database.

### Steps (operational)
1. **Generate a 32-byte key** (run once, keep secret, store in secret manager / Vercel env):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # 64-char hex
   ```
2. **Add `PHONE_ENCRYPTION_KEY=<64-char-hex>`** to `apps/api/.env.example` (documented, not
   the secret itself) AND to the real prod/preview env (Vercel project settings / secret).
3. **Verify migration 076 applied** on the target DB:
   ```bash
   psql "$DATABASE_URL" -c "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone_number_hash';"
   ```
   If no row → run migrations: `cd apps/api && npx tsx run-migrations.ts` (or `npm run migrate`).
4. **Backfill existing rows** (legal requirement — old plaintext must be encrypted):
   ```bash
   DATABASE_URL=<prod> PHONE_ENCRYPTION_KEY=<key> npx tsx apps/web/scripts/encrypt-existing-phone-numbers.ts
   ```
   Re-run is safe (encrypted/hashed rows are skipped).
5. **Verify**: create a test user with a phone, confirm `users.phone=''` and
   `users.phone_number` matches `iv:tag:ct`, and `phone_number_hash` is set; confirm login
   read returns the decrypted number.

### Acceptance criteria
- [ ] `PHONE_ENCRYPTION_KEY` present in prod/preview env; absent → app still boots (graceful).
- [ ] Live DB has `phone_number` ciphertext + `phone_number_hash` for all rows.
- [ ] `users.phone` is empty for all post-activation registrations.
- [ ] Read path returns correct number; unique-phone signup still enforced via hash.
- [ ] Documented in runbook that rotating the key requires re-running the backfill script.

**Closes:** POPIA Q18, Q19, Q20, Q21, Q22 (security safeguard limb), Q23.

---

## TICKET B — Confirm data-retention cron actually runs (POPIA Q8)

**Status of code:** DONE. Already present:
- `apps/api/src/queue/index.ts` — `runDataRetention()` anonymises verified accounts with no
  activity for 3+ years and hard-deletes unverified accounts after 1 year; scheduled via
  BullMQ `repeat` pattern `"0 3 1 * *"` (monthly, 03:00 UTC), jobId `data-retention-singleton`.
- `apps/api/src/index.ts:3,11-12` — `startWorker()` + `scheduleDataRetention()` are called at
  boot, so the cron is registered when the API process starts.
- `apps/api/Dockerfile` — `CMD ["node", "apps/api/dist/index.js"]` (long-running container,
  so the worker persists).

**Why it can still fail in practice:** BullMQ requires **Redis** (`config.redisUrl`) and a
**persistent worker process**. The code is correct *only if* the API runs as a long-lived
container/process. If the API is deployed to **Vercel serverless functions** (ephemeral, no
guaranteed long-running worker), the scheduled job will **not** fire reliably. Confirm the
actual deployment target.

### Steps
1. **Confirm deployment model**: is `apps/api` running as the Docker container (Dockerfile
   CMD) on a persistent host, or as Vercel serverless functions?
   - If **container/Docker** → worker already runs; skip to step 3.
   - If **serverless** → the cron will not run. Fix by either:
     (a) deploying the API as a Vercel **Cron Job** / background container, or
     (b) moving `runDataRetention` to a scheduled external job (e.g. Vercel Cron hitting a
         protected `/internal/retention` endpoint, or a GitHub Action on a monthly schedule).
2. **Provision Redis** in the target environment and set `REDIS_URL` (already in
   `.env.example`). Confirm `config.redisUrl` resolves (queue/index.ts:40).
3. **Verify the job is scheduled**: on boot, check logs for the BullMQ repeat job creation;
   or inspect Redis: `redis-cli ZRANGE bull:saedu-tasks:repeat 0 -1`.
4. **Dry-run** `runDataRetention()` against a staging DB to confirm the SQL executes without
   error and affects the expected (zero, initially) rows.

### Acceptance criteria
- [ ] Deployment target confirmed to support a persistent worker (container) OR retention
      moved to an external scheduler.
- [ ] Redis provisioned; `scheduleDataRetention()` registered at boot (log evidence).
- [ ] Monthly job visible in BullMQ repeat keys (or external scheduler confirmed).
- [ ] Staging dry-run succeeds; retention policy documented (3-yr anonymise / 1-yr delete).

**Closes:** POPIA Q8 (personal information not kept longer than necessary).

---

## SUMMARY
| Item | Master-doc status (was) | Reality | Remaining work |
|---|---|---|---|
| Phone encryption | Pending | Coded; unprovisioned | Provision key + run migration 076 + backfill (Ticket A) |
| Retention cron | Pending | Coded; deploy-dependent | Confirm persistent worker / Redis; possibly externalise (Ticket B) |

After both tickets close, the entire POPIA self-assessment (46/46 "Yes") is backed by
implemented, activated controls — leaving only the operator DPAs (signed copies to drop into
`docs/legal/operator-agreements/`) as the sole outstanding evidence item.
