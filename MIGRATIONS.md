# Database Migrations Guide

This document explains how to run and manage database migrations for the SCHOOL Academic Platform.

## Overview

The API uses PostgreSQL with raw SQL migrations (not ORMs). All migration files are in `apps/api/migrations/` and are numbered sequentially (001, 002, etc.).

Migration history is tracked in the `schema_migrations` table, which records which migrations have been applied.

## Critical Tables

These tables are required for the application to function:

- `users` - User accounts (migration 001)
- `conversations` - Messaging system (migration 006)
- `conversation_participants` - Messaging participants (migration 006)
- `conversation_user_settings` - User messaging settings (migration 006)
- `research_consents` - Research study consent tracking (migration 082)
- `research_sessions` - Research study sessions (migration 082)
- `assignment_reminder_deliveries` - Assignment reminder system (migration 021)

**Missing these tables causes 500 errors and background job failures.**

## Automatic Migrations (Recommended)

Railway deployments should run migrations automatically before starting the server.

### Update Railway Start Command

Go to your Railway dashboard:
1. Select the `@saedu/api` service
2. Go to **Settings** → **Deploy**
3. Update the **Start Command** to:
   ```bash
   bash ./apps/api/migrate-and-start.sh
   ```
4. Click **Save**
5. Trigger a redeploy

The script will:
1. Run any pending migrations
2. Log migration progress
3. Start the API server only if migrations succeed

## Manual Migrations

If you need to run migrations manually (e.g., for debugging):

### Local Development

```bash
# Ensure DATABASE_URL is set to your local PostgreSQL
export DATABASE_URL="postgresql://user:password@localhost:5432/school_db"

# Run migrations
npx tsx apps/api/run-migrations.ts
```

### Railway Environment

Use Railway's shell or connect via a database client:

```bash
# Via Railway CLI
railway run npx tsx apps/api/run-migrations.ts

# Or connect directly with psql (get credentials from Railway dashboard)
psql postgresql://user:password@host:port/database < apps/api/migrations/001_init.sql
```

## Checking Migration Status

To see which migrations have been applied:

```sql
SELECT id, run_at FROM schema_migrations ORDER BY id;
```

## How Migrations Work

1. **Initialization**: If `schema_migrations` table doesn't exist, it's created
2. **Discovery**: All `.sql` files in `apps/api/migrations/` are found and sorted
3. **Tracking**: The script checks which migrations are already in `schema_migrations`
4. **Execution**: Pending migrations are run in order within a transaction
5. **Recording**: Each successful migration is recorded in `schema_migrations`

### Transaction Safety

Each migration runs in a transaction. If an error occurs:
- The transaction is rolled back
- The migration is NOT recorded
- The error is logged
- The process exits with code 1

## Troubleshooting

### "relation does not exist" errors

This means a required table hasn't been created. Check:

1. Is the migration file present?
   ```bash
   ls -la apps/api/migrations/
   ```

2. Has it been applied?
   ```sql
   SELECT id FROM schema_migrations WHERE id LIKE '%messaging%';
   ```

3. If not applied, check the migration file for errors:
   ```bash
   cat apps/api/migrations/006_messaging.sql
   ```

### Migration fails with connection error

1. Check `DATABASE_URL` is set correctly
2. Verify PostgreSQL is running and accessible
3. Check credentials and host/port
4. Ensure your IP is allowed (on Railway, this is automatic)

### Need to rollback?

The current system doesn't support rollbacks. If a migration fails:
1. Fix the SQL error in the migration file
2. Manually undo the partial changes via `psql`
3. Increment the migration version in `schema_migrations` to skip it

## Adding New Migrations

1. Create a new file: `apps/api/migrations/NNN_description.sql` (next sequential number)
2. Write your SQL statements
3. Test locally: `npx tsx apps/api/run-migrations.ts`
4. Commit and push to trigger auto-migration on deploy

Example:

```sql
-- apps/api/migrations/083_new_feature.sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_new_table_created_at ON new_table(created_at);
```

## Current Status

As of this guide, the migrations are:
- ✅ Schema initialized (001-005)
- ✅ Messaging system (006-024)
- ✅ Research system (082+)

All required tables should be created by the migration system on first deploy.

## Scholar Credits (migration 086) — Apply + Verify

`apps/api/migrations/086_scholar_credits.sql` adds the unified cross-venture credits
economy (Ludo Principle): one ledger shared by SCHOOL, AURA, SPHERE, NPC, ROCKIT,
SCENE, LOGISTICS, V4NTAG3 and Ditshego Ventures.

**What it creates**
- 8 columns on `users`: `credits_balance`, `lifetime_earned`, `lifetime_spent`,
  `current_streak`, `longest_streak`, `last_active_date`, `preferred_language`, `timezone`.
- Tables: `credit_wallets`, `credit_transactions`, `credit_streaks`,
  `credit_venture_profiles`, `credit_redemptions`, `credit_rate_limits`, `credit_audit_log`.
- Idempotency: unique partial index on `credit_transactions(idempotency_key)` so
  offline PWA replays can never double-earn/double-spend.
- Anti-farming: per (user, venture, source, day) rate-limit rows.
- POPIA: audit log stores only a salted IP hash + coarse browser family (pattern of 082).

### Apply

```bash
# Local dev (points DATABASE_URL at your PostgreSQL)
export DATABASE_URL="postgresql://user:password@localhost:5432/school_db"
npx tsx apps/api/run-migrations.ts

# Railway (runs pending migrations then starts the server)
railway run npx tsx apps/api/run-migrations.ts

# Or via the deploy hook — set the @saedu/api Start Command to:
bash ./apps/api/migrate-and-start.sh
```

`086` is additive and `IF NOT EXISTS`-guarded; applying it is safe on a live
database with no downtime.

### Verify

Run these after applying:

```sql
-- 1. Migration recorded
SELECT id FROM schema_migrations WHERE id LIKE '%086%';

-- 2. Tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'credit_%'
ORDER BY tablename;

-- 3. Users columns present (all 8 must be listed)
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN (
  'credits_balance','lifetime_earned','lifetime_spent',
  'current_streak','longest_streak','last_active_date',
  'preferred_language','timezone'
) ORDER BY column_name;

-- 4. Smoke test — grant a manual balance and read it back (use a real user id)
-- UPDATE users SET credits_balance = 10 WHERE id = '<uuid>' RETURNING id, credits_balance;

-- 5. Confirm idempotency guard is in place
SELECT indexname FROM pg_indexes
WHERE tablename = 'credit_transactions' AND indexname = 'uq_credit_transactions_idempotency';
```

### Rollback (manual — not supported by the runner)

086 is additive. If you must undo it, the data-safe path is to keep the tables
but stop writing to them (nothing writes until the credits API routes are
enabled). To fully drop:

```sql
DROP TABLE IF EXISTS credit_audit_log, credit_rate_limits, credit_redemptions,
  credit_venture_profiles, credit_streaks, credit_transactions, credit_wallets;
ALTER TABLE users
  DROP COLUMN IF EXISTS credits_balance, DROP COLUMN IF EXISTS lifetime_earned,
  DROP COLUMN IF EXISTS lifetime_spent, DROP COLUMN IF EXISTS current_streak,
  DROP COLUMN IF EXISTS longest_streak, DROP COLUMN IF EXISTS last_active_date,
  DROP COLUMN IF EXISTS preferred_language, DROP COLUMN IF EXISTS timezone;
DELETE FROM schema_migrations WHERE id LIKE '%086%';
```

Only run the rollback if no credits have been issued yet — it destroys the ledger.

### API surface (once the API routes ship)

- `GET  /api/credits/balance` — user balance, wallets, streak, recent transactions
- `GET  /api/credits/wallet/:venture`
- `GET  /api/credits/history?venture=&limit=&offset=`
- `GET  /api/credits/redemptions`
- `POST /api/credits/earn` — idempotent earn (rate-limited per source/day)
- `POST /api/credits/spend` — idempotent spend (402 on insufficient funds)
- `POST /api/credits/transfer` — cross-user transfer in one venture
- `POST /api/credits/redeem` — spend + record a redemption
- `POST /api/credits/sync` — offline PWA queue replay (batched, idempotent)
- `GET  /admin/credits/summary` — platform totals (admin)
- `GET  /admin/credits/reconcile` — wallet-vs-user balance drift check (admin)

All earn/spend sources are validated against `apps/api/src/lib/credit-rules.ts`
(the same table the PWA uses), so no source can be farmed past its daily cap.

## See Also

- Migration script: `apps/api/run-migrations.ts`
- Startup script: `apps/api/migrate-and-start.sh`
- Migration directory: `apps/api/migrations/`

