import { PoolClient } from "pg";
import { pool } from "./pool.js";

export type WalletAccountRecord = {
  user_id: string;
  balance_credits: string | number;
  currency: string;
  created_at?: string;
};

export type WalletLedgerEntryRecord = {
  id: string;
  user_id: string;
  type: "CREDIT" | "DEBIT";
  amount_credits: string | number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  idempotency_key: string;
  created_at: string;
};

export type WalletTopupRecord = {
  id: string;
  user_id: string;
  provider: string;
  provider_ref: string | null;
  amount_zar: string | number;
  credits_granted: string | number;
  status: "pending" | "succeeded" | "failed" | "canceled";
  created_at: string;
};

export type WalletFreeUnlockUsageRecord = {
  id: string;
  user_id: string;
  feature_key: string;
  week_start: string;
  attempt_ref_id: string | null;
  idempotency_key: string;
  created_at: string;
};

type WalletAdminSummaryRow = {
  total_wallet_accounts: string | number;
  total_credits_issued: string | number;
  total_credits_debited: string | number;
};

type WalletReconcileTotalRow = {
  total_wallet_accounts: string | number;
  total_ledger_users: string | number;
  account_balance_total_credits: string | number;
  ledger_net_total_credits: string | number;
};

type WalletReconcileMismatchRow = {
  user_id: string | null;
  account_balance_credits: string | number | null;
  ledger_balance_credits: string | number | null;
};

export class WalletInsufficientFundsError extends Error {
  constructor(message = "Insufficient credits") {
    super(message);
    this.name = "WalletInsufficientFundsError";
  }
}

export class WalletIdempotencyConflictError extends Error {
  constructor(message = "Idempotency key already used for different wallet operation") {
    super(message);
    this.name = "WalletIdempotencyConflictError";
  }
}

type WalletMutationInput = {
  userId: string;
  type: "CREDIT" | "DEBIT";
  amountCredits: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
};

type Queryable = Pick<PoolClient, "query">;

function toInt(value: string | number | null | undefined) {
  if (typeof value === "number") return Math.trunc(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function normalizeNullableText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function isSameWalletMutation(existing: WalletLedgerEntryRecord, input: WalletMutationInput) {
  return (
    existing.user_id === input.userId &&
    existing.type === input.type &&
    toInt(existing.amount_credits) === Math.trunc(input.amountCredits) &&
    normalizeNullableText(existing.reason) === normalizeNullableText(input.reason) &&
    normalizeNullableText(existing.ref_type) === normalizeNullableText(input.refType) &&
    normalizeNullableText(existing.ref_id) === normalizeNullableText(input.refId)
  );
}

function normalizeAccount(row: WalletAccountRecord) {
  return {
    userId: row.user_id,
    balanceCredits: toInt(row.balance_credits),
    currency: row.currency,
    createdAt: row.created_at ?? null,
  };
}

function normalizeLedger(row: WalletLedgerEntryRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amountCredits: toInt(row.amount_credits),
    reason: row.reason,
    refType: row.ref_type,
    refId: row.ref_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

function normalizeTopup(row: WalletTopupRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerRef: row.provider_ref,
    amountZar: Number(row.amount_zar),
    creditsGranted: toInt(row.credits_granted),
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalizeFreeUnlockUsage(row: WalletFreeUnlockUsageRecord) {
  return {
    id: row.id,
    userId: row.user_id,
    featureKey: row.feature_key,
    weekStart: row.week_start,
    attemptRefId: row.attempt_ref_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}

export type WalletDetailedReportUnlockResult = {
  mode: "free_weekly" | "paid";
  chargedCredits: number;
  account: ReturnType<typeof normalizeAccount>;
  entry: ReturnType<typeof normalizeLedger> | null;
  freeUnlock: ReturnType<typeof normalizeFreeUnlockUsage> | null;
  alreadyProcessed: boolean;
};

async function ensureWalletAccount(client: Queryable, userId: string) {
  await client.query(
    `INSERT INTO wallet_accounts (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  const result = await client.query<WalletAccountRecord>(
    `SELECT user_id, balance_credits, currency, created_at
     FROM wallet_accounts
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to load wallet account");
  }
  return row;
}

async function getWalletByUserIdForUpdate(client: Queryable, userId: string) {
  const result = await client.query<WalletAccountRecord>(
    `SELECT user_id, balance_credits, currency, created_at
     FROM wallet_accounts
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Wallet account not found");
  }
  return row;
}

async function getLedgerEntryByIdempotencyKey(client: Queryable, idempotencyKey: string) {
  const result = await client.query<WalletLedgerEntryRecord>(
    `SELECT id, user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key, created_at
     FROM wallet_ledger_entries
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey]
  );
  return result.rows[0] ?? null;
}

async function getFreeUnlockByIdempotencyKey(client: Queryable, idempotencyKey: string) {
  const result = await client.query<WalletFreeUnlockUsageRecord>(
    `SELECT id, user_id, feature_key, week_start::text, attempt_ref_id, idempotency_key, created_at
     FROM wallet_free_unlock_usage
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey]
  );
  return result.rows[0] ?? null;
}

async function reserveWeeklyFreeUnlock(input: {
  client: Queryable;
  userId: string;
  featureKey: string;
  attemptRefId: string;
  idempotencyKey: string;
}) {
  const inserted = await input.client.query<WalletFreeUnlockUsageRecord>(
    `INSERT INTO wallet_free_unlock_usage (
       user_id, feature_key, week_start, attempt_ref_id, idempotency_key
     ) VALUES (
       $1,
       $2,
       date_trunc('week', NOW())::date,
       $3,
       $4
     )
     ON CONFLICT DO NOTHING
     RETURNING id, user_id, feature_key, week_start::text, attempt_ref_id, idempotency_key, created_at`,
    [input.userId, input.featureKey, input.attemptRefId, input.idempotencyKey]
  );
  if (inserted.rows[0]) {
    return {
      row: inserted.rows[0],
      alreadyProcessed: false,
    };
  }

  const existingByIdempotency = await getFreeUnlockByIdempotencyKey(
    input.client,
    input.idempotencyKey
  );
  if (existingByIdempotency) {
    return {
      row: existingByIdempotency,
      alreadyProcessed: true,
    };
  }

  return {
    row: null,
    alreadyProcessed: false,
  };
}

export async function getWalletBalance(userId: string) {
  await ensureWalletAccount(pool, userId);
  const result = await pool.query<WalletAccountRecord>(
    `SELECT user_id, balance_credits, currency, created_at
     FROM wallet_accounts
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Wallet account not found");
  }
  return normalizeAccount(row);
}

export async function listWalletLedgerEntries(userId: string, limit = 20) {
  await ensureWalletAccount(pool, userId);
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const result = await pool.query<WalletLedgerEntryRecord>(
    `SELECT id, user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key, created_at
     FROM wallet_ledger_entries
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );
  return result.rows.map((row) => normalizeLedger(row));
}

async function applyWalletMutation(input: WalletMutationInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureWalletAccount(client, input.userId);
    const current = await getWalletByUserIdForUpdate(client, input.userId);

    const existing = await getLedgerEntryByIdempotencyKey(client, input.idempotencyKey);
    if (existing) {
      if (!isSameWalletMutation(existing, input)) {
        throw new WalletIdempotencyConflictError();
      }
      await client.query("COMMIT");
      return {
        account: normalizeAccount(current),
        entry: normalizeLedger(existing),
        alreadyProcessed: true,
      };
    }

    const currentBalance = toInt(current.balance_credits);
    const amount = Math.trunc(input.amountCredits);
    if (amount <= 0) {
      throw new Error("amountCredits must be greater than zero");
    }

    const nextBalance =
      input.type === "DEBIT" ? currentBalance - amount : currentBalance + amount;
    if (input.type === "DEBIT" && nextBalance < 0) {
      throw new WalletInsufficientFundsError();
    }

    const updatedAccountResult = await client.query<WalletAccountRecord>(
      `UPDATE wallet_accounts
       SET balance_credits = $2
       WHERE user_id = $1
       RETURNING user_id, balance_credits, currency, created_at`,
      [input.userId, nextBalance]
    );
    const updatedAccount = updatedAccountResult.rows[0];
    if (!updatedAccount) {
      throw new Error("Failed to update wallet balance");
    }

    const entryResult = await client.query<WalletLedgerEntryRecord>(
      `INSERT INTO wallet_ledger_entries (
         user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key, created_at`,
      [
        input.userId,
        input.type,
        amount,
        input.reason.trim(),
        normalizeNullableText(input.refType),
        normalizeNullableText(input.refId),
        input.idempotencyKey,
      ]
    );
    const entry = entryResult.rows[0];
    if (!entry) {
      throw new Error("Failed to record wallet ledger entry");
    }

    await client.query("COMMIT");
    return {
      account: normalizeAccount(updatedAccount),
      entry: normalizeLedger(entry),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      const existing = await getLedgerEntryByIdempotencyKey(pool, input.idempotencyKey);
      if (!existing) {
        throw new WalletIdempotencyConflictError();
      }
      if (!isSameWalletMutation(existing, input)) {
        throw new WalletIdempotencyConflictError();
      }
      const account = await getWalletBalance(input.userId);
      return {
        account,
        entry: normalizeLedger(existing),
        alreadyProcessed: true,
      };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function debitWallet(input: {
  userId: string;
  amountCredits: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
}) {
  return applyWalletMutation({
    ...input,
    type: "DEBIT",
  });
}

export async function creditWallet(input: {
  userId: string;
  amountCredits: number;
  reason: string;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
}) {
  return applyWalletMutation({
    ...input,
    type: "CREDIT",
  });
}

export async function unlockDetailedReportWithWeeklyFree(input: {
  userId: string;
  attemptId: string;
  amountCredits: number;
  reason: string;
  idempotencyKey: string;
  featureKey?: string;
}): Promise<WalletDetailedReportUnlockResult> {
  const featureKey =
    normalizeNullableText(input.featureKey) ?? "past_paper_detailed_report";
  const mutationInput: WalletMutationInput = {
    userId: input.userId,
    type: "DEBIT",
    amountCredits: input.amountCredits,
    reason: input.reason,
    refType: featureKey,
    refId: input.attemptId,
    idempotencyKey: input.idempotencyKey,
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureWalletAccount(client, input.userId);
    const current = await getWalletByUserIdForUpdate(client, input.userId);

    const existingFree = await getFreeUnlockByIdempotencyKey(client, input.idempotencyKey);
    if (existingFree) {
      await client.query("COMMIT");
      return {
        mode: "free_weekly",
        chargedCredits: 0,
        account: normalizeAccount(current),
        entry: null,
        freeUnlock: normalizeFreeUnlockUsage(existingFree),
        alreadyProcessed: true,
      };
    }

    const existingLedger = await getLedgerEntryByIdempotencyKey(client, input.idempotencyKey);
    if (existingLedger) {
      if (!isSameWalletMutation(existingLedger, mutationInput)) {
        throw new WalletIdempotencyConflictError();
      }
      await client.query("COMMIT");
      return {
        mode: "paid",
        chargedCredits: toInt(existingLedger.amount_credits),
        account: normalizeAccount(current),
        entry: normalizeLedger(existingLedger),
        freeUnlock: null,
        alreadyProcessed: true,
      };
    }

    const freeReservation = await reserveWeeklyFreeUnlock({
      client,
      userId: input.userId,
      featureKey,
      attemptRefId: input.attemptId,
      idempotencyKey: input.idempotencyKey,
    });
    if (freeReservation.row) {
      await client.query("COMMIT");
      return {
        mode: "free_weekly",
        chargedCredits: 0,
        account: normalizeAccount(current),
        entry: null,
        freeUnlock: normalizeFreeUnlockUsage(freeReservation.row),
        alreadyProcessed: freeReservation.alreadyProcessed,
      };
    }

    const currentBalance = toInt(current.balance_credits);
    const amount = Math.trunc(input.amountCredits);
    if (amount <= 0) {
      throw new Error("amountCredits must be greater than zero");
    }
    const nextBalance = currentBalance - amount;
    if (nextBalance < 0) {
      throw new WalletInsufficientFundsError();
    }

    const updatedAccountResult = await client.query<WalletAccountRecord>(
      `UPDATE wallet_accounts
       SET balance_credits = $2
       WHERE user_id = $1
       RETURNING user_id, balance_credits, currency, created_at`,
      [input.userId, nextBalance]
    );
    const updatedAccount = updatedAccountResult.rows[0];
    if (!updatedAccount) {
      throw new Error("Failed to update wallet balance");
    }

    const entryResult = await client.query<WalletLedgerEntryRecord>(
      `INSERT INTO wallet_ledger_entries (
         user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key, created_at`,
      [
        mutationInput.userId,
        mutationInput.type,
        amount,
        mutationInput.reason.trim(),
        normalizeNullableText(mutationInput.refType),
        normalizeNullableText(mutationInput.refId),
        mutationInput.idempotencyKey,
      ]
    );
    const entry = entryResult.rows[0];
    if (!entry) {
      throw new Error("Failed to record wallet ledger entry");
    }

    await client.query("COMMIT");
    return {
      mode: "paid",
      chargedCredits: amount,
      account: normalizeAccount(updatedAccount),
      entry: normalizeLedger(entry),
      freeUnlock: null,
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      const existingFree = await getFreeUnlockByIdempotencyKey(pool, input.idempotencyKey);
      if (existingFree) {
        const account = await getWalletBalance(input.userId);
        return {
          mode: "free_weekly",
          chargedCredits: 0,
          account,
          entry: null,
          freeUnlock: normalizeFreeUnlockUsage(existingFree),
          alreadyProcessed: true,
        };
      }

      const existingLedger = await getLedgerEntryByIdempotencyKey(pool, input.idempotencyKey);
      if (existingLedger) {
        if (!isSameWalletMutation(existingLedger, mutationInput)) {
          throw new WalletIdempotencyConflictError();
        }
        const account = await getWalletBalance(input.userId);
        return {
          mode: "paid",
          chargedCredits: toInt(existingLedger.amount_credits),
          account,
          entry: normalizeLedger(existingLedger),
          freeUnlock: null,
          alreadyProcessed: true,
        };
      }

      throw new WalletIdempotencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function createWalletTopup(input: {
  userId: string;
  provider: string;
  amountZar: number;
  creditsGranted: number;
  providerRef?: string | null;
  status?: "pending" | "succeeded" | "failed" | "canceled";
}) {
  const result = await pool.query<WalletTopupRecord>(
    `INSERT INTO wallet_topups (
       user_id, provider, provider_ref, amount_zar, credits_granted, status
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, provider, provider_ref, amount_zar, credits_granted, status, created_at`,
    [
      input.userId,
      input.provider,
      input.providerRef ?? null,
      input.amountZar,
      Math.trunc(input.creditsGranted),
      input.status ?? "pending",
    ]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create wallet topup");
  }
  return normalizeTopup(row);
}

export async function getWalletTopupById(topupId: string) {
  const result = await pool.query<WalletTopupRecord>(
    `SELECT id, user_id, provider, provider_ref, amount_zar, credits_granted, status, created_at
     FROM wallet_topups
     WHERE id = $1
     LIMIT 1`,
    [topupId]
  );
  const row = result.rows[0];
  return row ? normalizeTopup(row) : null;
}

export async function updateWalletTopupStatus(input: {
  topupId: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  providerRef?: string | null;
}) {
  const result = await pool.query<WalletTopupRecord>(
    `UPDATE wallet_topups
     SET status = $2,
         provider_ref = COALESCE($3, provider_ref)
     WHERE id = $1
     RETURNING id, user_id, provider, provider_ref, amount_zar, credits_granted, status, created_at`,
    [input.topupId, input.status, input.providerRef ?? null]
  );
  const row = result.rows[0];
  return row ? normalizeTopup(row) : null;
}

export async function markWebhookEventProcessed(provider: string, eventId: string) {
  const result = await pool.query<{ provider: string; event_id: string }>(
    `INSERT INTO processed_webhook_events (provider, event_id)
     VALUES ($1, $2)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING provider, event_id`,
    [provider, eventId]
  );
  return Boolean(result.rows[0]);
}

export async function getAdminWalletSummary() {
  const result = await pool.query<WalletAdminSummaryRow>(
    `SELECT
       (SELECT COUNT(*)::bigint FROM wallet_accounts) AS total_wallet_accounts,
       (SELECT COALESCE(SUM(amount_credits), 0)::bigint
        FROM wallet_ledger_entries
        WHERE type = 'CREDIT') AS total_credits_issued,
       (SELECT COALESCE(SUM(amount_credits), 0)::bigint
        FROM wallet_ledger_entries
        WHERE type = 'DEBIT') AS total_credits_debited`
  );

  const row = result.rows[0] ?? {
    total_wallet_accounts: 0,
    total_credits_issued: 0,
    total_credits_debited: 0,
  };
  const totalCreditsIssued = toInt(row.total_credits_issued);
  const totalCreditsDebited = toInt(row.total_credits_debited);

  return {
    totalWalletAccounts: toInt(row.total_wallet_accounts),
    totalCreditsIssued,
    totalCreditsDebited,
    netOutstandingCredits: totalCreditsIssued - totalCreditsDebited,
  };
}

export async function reconcileWalletBalances() {
  const totalsResult = await pool.query<WalletReconcileTotalRow>(
    `WITH ledger AS (
       SELECT
         user_id,
         COALESCE(
           SUM(
             CASE
               WHEN type = 'CREDIT' THEN amount_credits
               WHEN type = 'DEBIT' THEN -amount_credits
               ELSE 0
             END
           ),
           0
         )::bigint AS ledger_balance_credits
       FROM wallet_ledger_entries
       GROUP BY user_id
     )
     SELECT
       (SELECT COUNT(*)::bigint FROM wallet_accounts) AS total_wallet_accounts,
       (SELECT COUNT(*)::bigint FROM ledger) AS total_ledger_users,
       (SELECT COALESCE(SUM(balance_credits), 0)::bigint FROM wallet_accounts) AS account_balance_total_credits,
       (SELECT COALESCE(SUM(ledger_balance_credits), 0)::bigint FROM ledger) AS ledger_net_total_credits`
  );

  const mismatchResult = await pool.query<WalletReconcileMismatchRow>(
    `WITH ledger AS (
       SELECT
         user_id,
         COALESCE(
           SUM(
             CASE
               WHEN type = 'CREDIT' THEN amount_credits
               WHEN type = 'DEBIT' THEN -amount_credits
               ELSE 0
             END
           ),
           0
         )::bigint AS ledger_balance_credits
       FROM wallet_ledger_entries
       GROUP BY user_id
     )
     SELECT
       COALESCE(accounts.user_id, ledger.user_id)::text AS user_id,
       accounts.balance_credits AS account_balance_credits,
       ledger.ledger_balance_credits AS ledger_balance_credits
     FROM wallet_accounts AS accounts
     FULL OUTER JOIN ledger ON ledger.user_id = accounts.user_id
     WHERE COALESCE(accounts.balance_credits, 0) <> COALESCE(ledger.ledger_balance_credits, 0)
     ORDER BY COALESCE(accounts.user_id, ledger.user_id)::text ASC`
  );

  const totals = totalsResult.rows[0] ?? {
    total_wallet_accounts: 0,
    total_ledger_users: 0,
    account_balance_total_credits: 0,
    ledger_net_total_credits: 0,
  };

  const mismatches = mismatchResult.rows.map((row) => {
    const accountBalanceCredits = row.account_balance_credits == null ? null : toInt(row.account_balance_credits);
    const ledgerComputedBalanceCredits = row.ledger_balance_credits == null ? null : toInt(row.ledger_balance_credits);
    const differenceCredits =
      (accountBalanceCredits ?? 0) - (ledgerComputedBalanceCredits ?? 0);

    return {
      userId: row.user_id ?? "unknown",
      accountBalanceCredits,
      ledgerComputedBalanceCredits,
      differenceCredits,
      hasAccount: row.account_balance_credits != null,
      hasLedger: row.ledger_balance_credits != null,
    };
  });

  return {
    checkedWalletAccounts: toInt(totals.total_wallet_accounts),
    checkedLedgerUsers: toInt(totals.total_ledger_users),
    accountBalanceTotalCredits: toInt(totals.account_balance_total_credits),
    ledgerNetTotalCredits: toInt(totals.ledger_net_total_credits),
    mismatchCount: mismatches.length,
    mismatches,
  };
}
