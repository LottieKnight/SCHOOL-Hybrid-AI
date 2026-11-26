import { PoolClient } from "pg";
import { pool } from "./pool.js";
import {
  CreditSource,
  VentureType,
  getCreditRule,
  isEarnSource,
  isSelfClaimableSource,
} from "../lib/credit-rules.js";

// ---------------------------------------------------------------------------
// Types + record shapes
// ---------------------------------------------------------------------------

type UserCreditsRow = {
  credits_balance: string | number;
  lifetime_earned: string | number;
  lifetime_spent: string | number;
  current_streak: string | number;
  longest_streak: string | number;
};

type WalletRow = {
  id: string;
  user_id: string;
  venture: string;
  balance: string | number;
  locked: string | number;
  created_at: string;
  updated_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  wallet_id: string | null;
  venture: string;
  type: string;
  source: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  description: string;
  idempotency_key: string | null;
  reference_id: string | null;
  reference_type: string | null;
  processed_at: string;
  created_at: string;
};

type RedemptionRow = {
  id: string;
  user_id: string;
  venture: string;
  source: string;
  amount: string | number;
  item_id: string;
  item_type: string;
  item_name: string;
  status: string;
  processed_at: string | null;
  created_at: string;
};

type RateLimitRow = {
  count: string | number;
  max_count: string | number;
  window_end: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CreditsInsufficientFundsError extends Error {
  constructor(message = "Insufficient credits") {
    super(message);
    this.name = "CreditsInsufficientFundsError";
  }
}

export class CreditsIdempotencyConflictError extends Error {
  constructor(message = "Idempotency key already used for a different credits operation") {
    super(message);
    this.name = "CreditsIdempotencyConflictError";
  }
}

export class CreditsRateLimitError extends Error {
  remaining: number;
  resetAt: string;

  constructor(remaining: number, resetAt: string) {
    super("Rate limit exceeded for this credit source");
    this.name = "CreditsRateLimitError";
    this.remaining = remaining;
    this.resetAt = resetAt;
  }
}

export class CreditsInvalidAmountError extends Error {
  constructor(message = "Invalid credit amount") {
    super(message);
    this.name = "CreditsInvalidAmountError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Queryable = Pick<PoolClient, "query">;

function toInt(value: string | number | null | undefined) {
  if (typeof value === "number") return Math.trunc(value);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function isUniqueConstraintViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

const TRANSACTION_COLUMNS = `
  id, user_id, wallet_id, venture, type, source, amount,
  balance_before, balance_after, description, idempotency_key,
  reference_id, reference_type, processed_at, created_at
`;

function normalizeWallet(row: WalletRow) {
  return {
    id: row.id,
    userId: row.user_id,
    venture: row.venture,
    balance: toInt(row.balance),
    locked: toInt(row.locked),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTransaction(row: TransactionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    walletId: row.wallet_id,
    venture: row.venture,
    type: row.type,
    source: row.source,
    amount: toInt(row.amount),
    balanceBefore: toInt(row.balance_before),
    balanceAfter: toInt(row.balance_after),
    description: row.description,
    idempotencyKey: row.idempotency_key,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

function normalizeRedemption(row: RedemptionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    venture: row.venture,
    source: row.source,
    amount: toInt(row.amount),
    itemId: row.item_id,
    itemType: row.item_type,
    itemName: row.item_name,
    status: row.status,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  };
}

function windowStartExpr() {
  return `date_trunc('day', NOW())`;
}

function windowEndExpr() {
  return `date_trunc('day', NOW()) + interval '1 day' - interval '1 second'`;
}

async function ensureWalletRow(client: Queryable, userId: string, venture: string) {
  await client.query(
    `INSERT INTO credit_wallets (user_id, venture)
     VALUES ($1, $2)
     ON CONFLICT (user_id, venture) DO NOTHING`,
    [userId, venture]
  );
}

async function getWalletRow(client: Queryable, userId: string, venture: string) {
  const result = await client.query<WalletRow>(
    `SELECT id, user_id, venture, balance, locked, created_at, updated_at
     FROM credit_wallets
     WHERE user_id = $1 AND venture = $2
     LIMIT 1`,
    [userId, venture]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Credit wallet not found");
  }
  return row;
}

async function getWalletRowForUpdate(client: Queryable, userId: string, venture: string) {
  const result = await client.query<WalletRow>(
    `SELECT id, user_id, venture, balance, locked, created_at, updated_at
     FROM credit_wallets
     WHERE user_id = $1 AND venture = $2
     FOR UPDATE`,
    [userId, venture]
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("Credit wallet not found");
  }
  return row;
}

async function getTransactionByIdempotencyKey(client: Queryable, idempotencyKey: string) {
  const result = await client.query<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM credit_transactions
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey]
  );
  return result.rows[0] ?? null;
}

async function ensureRateLimitRow(
  client: Queryable,
  userId: string,
  venture: string,
  source: string,
  maxCount: number
) {
  await client.query(
    `INSERT INTO credit_rate_limits (
       user_id, venture, source, window_start, window_end, count, max_count
     ) VALUES ($1, $2, $3, ${windowStartExpr()}, ${windowEndExpr()}, 0, $4)
     ON CONFLICT (user_id, venture, source, window_start) DO NOTHING`,
    [userId, venture, source, maxCount]
  );
}

async function getRateLimitRowForUpdate(
  client: Queryable,
  userId: string,
  venture: string,
  source: string
) {
  const result = await client.query<RateLimitRow>(
    `SELECT count, max_count, window_end
     FROM credit_rate_limits
     WHERE user_id = $1 AND venture = $2 AND source = $3 AND window_start = ${windowStartExpr()}
     FOR UPDATE`,
    [userId, venture, source]
  );
  return result.rows[0] ?? null;
}

function checkRateLimitOrThrow(row: RateLimitRow | null, maxPerDay?: number) {
  if (!maxPerDay) return;
  if (!row) return;
  if (toInt(row.count) >= toInt(row.max_count)) {
    throw new CreditsRateLimitError(Math.max(0, toInt(row.max_count) - toInt(row.count)), row.window_end);
  }
}

async function incrementRateLimit(
  client: Queryable,
  userId: string,
  venture: string,
  source: string
) {
  await client.query(
    `UPDATE credit_rate_limits
     SET count = count + 1, updated_at = NOW()
     WHERE user_id = $1 AND venture = $2 AND source = $3 AND window_start = ${windowStartExpr()}`,
    [userId, venture, source]
  );
}

async function bumpStreak(client: Queryable, userId: string, venture: string) {
  const userResult = await client.query<UserCreditsRow & { last_active_date: string | null }>(
    `SELECT credits_balance, lifetime_earned, lifetime_spent, current_streak, longest_streak, last_active_date
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = user.last_active_date ? new Date(user.last_active_date) : null;
  let newStreak = toInt(user.current_streak);

  if (lastActive) {
    const lastActiveDay = new Date(lastActive);
    lastActiveDay.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastActiveDay.getTime()) / 86400000);
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1;
    }
  } else {
    newStreak = 1;
  }

  const longestStreak = Math.max(newStreak, toInt(user.longest_streak));

  await client.query(
    `UPDATE users
     SET current_streak = $2, longest_streak = $3, last_active_date = $4
     WHERE id = $1`,
    [userId, newStreak, longestStreak, today]
  );

  const existing = await client.query<{ id: string }>(
    `SELECT id
     FROM credit_streaks
     WHERE user_id = $1 AND venture = $2 AND streak_type = 'daily' AND is_active = TRUE
     LIMIT 1
     FOR UPDATE`,
    [userId, venture]
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE credit_streaks
       SET count = $3, end_date = CURRENT_DATE, updated_at = NOW()
       WHERE id = $1 AND venture = $2`,
      [existing.rows[0].id, venture, newStreak]
    );
  } else {
    await client.query(
      `INSERT INTO credit_streaks (user_id, venture, streak_type, count, start_date, end_date, is_active)
       VALUES ($1, $2, 'daily', $3, CURRENT_DATE, CURRENT_DATE, TRUE)`,
      [userId, venture, newStreak]
    );
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getUserCredits(userId: string) {
  const userResult = await pool.query<UserCreditsRow>(
    `SELECT credits_balance, lifetime_earned, lifetime_spent, current_streak, longest_streak
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) {
    throw new Error("User not found");
  }

  const walletsResult = await pool.query<WalletRow>(
    `SELECT id, user_id, venture, balance, locked, created_at, updated_at
     FROM credit_wallets
     WHERE user_id = $1
     ORDER BY venture ASC`,
    [userId]
  );

  const transactionsResult = await pool.query<TransactionRow>(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );

  return {
    userId,
    totalBalance: toInt(user.credits_balance),
    lifetimeEarned: toInt(user.lifetime_earned),
    lifetimeSpent: toInt(user.lifetime_spent),
    currentStreak: toInt(user.current_streak),
    longestStreak: toInt(user.longest_streak),
    wallets: walletsResult.rows.map(normalizeWallet),
    recentTransactions: transactionsResult.rows.map(normalizeTransaction),
  };
}

export async function getWalletBalance(userId: string, venture: string) {
  await ensureWalletRow(pool, userId, venture);
  const row = await getWalletRow(pool, userId, venture);
  return normalizeWallet(row);
}

export async function getTransactionHistory(
  userId: string,
  venture?: string,
  limit = 50,
  offset = 0
) {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const safeOffset = Math.max(0, Math.trunc(offset));

  const result = venture
    ? await pool.query<TransactionRow>(
        `SELECT ${TRANSACTION_COLUMNS}
         FROM credit_transactions
         WHERE user_id = $1 AND venture = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, venture, safeLimit, safeOffset]
      )
    : await pool.query<TransactionRow>(
        `SELECT ${TRANSACTION_COLUMNS}
         FROM credit_transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, safeLimit, safeOffset]
      );

  return result.rows.map(normalizeTransaction);
}

export async function getRedemptionHistory(userId: string) {
  const result = await pool.query<RedemptionRow>(
    `SELECT id, user_id, venture, source, amount, item_id, item_type, item_name, status, processed_at, created_at
     FROM credit_redemptions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  return result.rows.map(normalizeRedemption);
}

// ---------------------------------------------------------------------------
// Earn / Spend / Transfer / Redeem (transactional)
// ---------------------------------------------------------------------------

type EarnSpendInput = {
  userId: string;
  venture: VentureType;
  source: CreditSource;
  amount: number;
  description: string;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
};

export async function earnCredits(input: EarnSpendInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureWalletRow(client, input.userId, input.venture);
    const wallet = await getWalletRowForUpdate(client, input.userId, input.venture);

    if (input.idempotencyKey) {
      const existing = await getTransactionByIdempotencyKey(client, input.idempotencyKey);
      if (existing) {
        await client.query("COMMIT");
        return {
          account: normalizeWallet(wallet),
          transaction: normalizeTransaction(existing),
          alreadyProcessed: true,
        };
      }
    }

    const rule = getCreditRule(input.source);
    // The ledger is authoritative: the amount is always the rule amount for
    // the source. A client-supplied amount is ignored so /credits/earn and
    // /credits/sync can never mint a source at an inflated value.
    const finalAmount = Math.trunc(rule.amount);
    if (finalAmount <= 0) {
      throw new CreditsInvalidAmountError();
    }

    if (rule.maxPerDay) {
      await ensureRateLimitRow(client, input.userId, input.venture, input.source, rule.maxPerDay);
      const rateRow = await getRateLimitRowForUpdate(client, input.userId, input.venture, input.source);
      checkRateLimitOrThrow(rateRow, rule.maxPerDay);
    }

    const balanceBefore = toInt(wallet.balance);
    const balanceAfter = balanceBefore + finalAmount;

    const walletResult = await client.query<WalletRow>(
      `UPDATE credit_wallets
       SET balance = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, venture, balance, locked, created_at, updated_at`,
      [wallet.id, balanceAfter]
    );

    await client.query(
      `UPDATE users
       SET credits_balance = credits_balance + $2, lifetime_earned = lifetime_earned + $2
       WHERE id = $1`,
      [input.userId, finalAmount]
    );

    const txResult = await client.query<TransactionRow>(
      `INSERT INTO credit_transactions (
         user_id, wallet_id, venture, type, source, amount,
         balance_before, balance_after, description, metadata, idempotency_key,
         reference_id, reference_type
       ) VALUES ($1, $2, $3, 'EARN', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        input.userId,
        wallet.id,
        input.venture,
        input.source,
        finalAmount,
        balanceBefore,
        balanceAfter,
        input.description,
        JSON.stringify(input.metadata ?? {}),
        input.idempotencyKey ?? null,
        input.referenceId ?? null,
        input.referenceType ?? null,
      ]
    );
    const transaction = txResult.rows[0];
    if (!transaction) {
      throw new Error("Failed to record credit transaction");
    }

    if (rule.maxPerDay) {
      await incrementRateLimit(client, input.userId, input.venture, input.source);
    }

    await bumpStreak(client, input.userId, input.venture);

    await client.query("COMMIT");
    return {
      account: normalizeWallet(walletResult.rows[0] ?? wallet),
      transaction: normalizeTransaction(transaction),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      if (input.idempotencyKey) {
        const existing = await getTransactionByIdempotencyKey(pool, input.idempotencyKey);
        if (existing) {
          const account = await getWalletBalance(input.userId, input.venture);
          return {
            account,
            transaction: normalizeTransaction(existing),
            alreadyProcessed: true,
          };
        }
      }
      throw new CreditsIdempotencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}

// Admin-only award for milestone / recognition sources that must never be
// self-claimable (INCUBATOR_ACCEPTANCE, FUNDING_MILESTONE, FOUNDER_RECOGNITION,
// ...). Rejects sources a user could earn themselves so the only minting path
// for big-ticket sources is an authenticated admin.
export async function awardCredits(input: EarnSpendInput) {
  if (isSelfClaimableSource(input.source)) {
    throw new CreditsInvalidAmountError(`Source ${input.source} must use /credits/earn`);
  }
  if (!isEarnSource(input.source)) {
    throw new CreditsInvalidAmountError(`Source ${input.source} is not an earn source`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureWalletRow(client, input.userId, input.venture);
    const wallet = await getWalletRowForUpdate(client, input.userId, input.venture);

    if (input.idempotencyKey) {
      const existing = await getTransactionByIdempotencyKey(client, input.idempotencyKey);
      if (existing) {
        await client.query("COMMIT");
        return {
          account: normalizeWallet(wallet),
          transaction: normalizeTransaction(existing),
          alreadyProcessed: true,
        };
      }
    }

    const rule = getCreditRule(input.source);
    const finalAmount = Math.trunc(rule.amount);
    if (finalAmount <= 0) {
      throw new CreditsInvalidAmountError();
    }

    const balanceBefore = toInt(wallet.balance);
    const balanceAfter = balanceBefore + finalAmount;

    const walletResult = await client.query<WalletRow>(
      `UPDATE credit_wallets
       SET balance = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, venture, balance, locked, created_at, updated_at`,
      [wallet.id, balanceAfter]
    );

    await client.query(
      `UPDATE users
       SET credits_balance = credits_balance + $2, lifetime_earned = lifetime_earned + $2
       WHERE id = $1`,
      [input.userId, finalAmount]
    );

    const txResult = await client.query<TransactionRow>(
      `INSERT INTO credit_transactions (
         user_id, wallet_id, venture, type, source, amount,
         balance_before, balance_after, description, metadata, idempotency_key,
         reference_id, reference_type
       ) VALUES ($1, $2, $3, 'EARN', $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        input.userId,
        wallet.id,
        input.venture,
        input.source,
        finalAmount,
        balanceBefore,
        balanceAfter,
        input.description,
        JSON.stringify(input.metadata ?? {}),
        input.idempotencyKey ?? null,
        input.referenceId ?? null,
        input.referenceType ?? null,
      ]
    );
    const transaction = txResult.rows[0];
    if (!transaction) {
      throw new Error("Failed to record credit transaction");
    }

    await bumpStreak(client, input.userId, input.venture);

    await client.query("COMMIT");
    return {
      account: normalizeWallet(walletResult.rows[0] ?? wallet),
      transaction: normalizeTransaction(transaction),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      if (input.idempotencyKey) {
        const existing = await getTransactionByIdempotencyKey(pool, input.idempotencyKey);
        if (existing) {
          const account = await getWalletBalance(input.userId, input.venture);
          return {
            account,
            transaction: normalizeTransaction(existing),
            alreadyProcessed: true,
          };
        }
      }
      throw new CreditsIdempotencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}

async function applySpendCore(client: Queryable, input: EarnSpendInput) {
  await ensureWalletRow(client, input.userId, input.venture);
  const wallet = await getWalletRowForUpdate(client, input.userId, input.venture);

  if (input.idempotencyKey) {
    const existing = await getTransactionByIdempotencyKey(client, input.idempotencyKey);
    if (existing) {
      return {
        account: normalizeWallet(wallet),
        transaction: normalizeTransaction(existing),
        alreadyProcessed: true,
      };
    }
  }

  const rule = getCreditRule(input.source);
  const finalAmount = Math.trunc(input.amount > 0 ? input.amount : Math.abs(rule.amount));
  if (finalAmount <= 0) {
    throw new CreditsInvalidAmountError();
  }

  const balanceBefore = toInt(wallet.balance);
  if (balanceBefore < finalAmount) {
    throw new CreditsInsufficientFundsError();
  }
  const balanceAfter = balanceBefore - finalAmount;

  const walletResult = await client.query<WalletRow>(
    `UPDATE credit_wallets
     SET balance = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, user_id, venture, balance, locked, created_at, updated_at`,
    [wallet.id, balanceAfter]
  );

  await client.query(
    `UPDATE users
     SET credits_balance = credits_balance - $2, lifetime_spent = lifetime_spent + $2
     WHERE id = $1`,
    [input.userId, finalAmount]
  );

  const txResult = await client.query<TransactionRow>(
    `INSERT INTO credit_transactions (
       user_id, wallet_id, venture, type, source, amount,
       balance_before, balance_after, description, metadata, idempotency_key,
       reference_id, reference_type
     ) VALUES ($1, $2, $3, 'SPEND', $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${TRANSACTION_COLUMNS}`,
    [
      input.userId,
      wallet.id,
      input.venture,
      input.source,
      -finalAmount,
      balanceBefore,
      balanceAfter,
      input.description,
      JSON.stringify(input.metadata ?? {}),
      input.idempotencyKey ?? null,
      input.referenceId ?? null,
      input.referenceType ?? null,
    ]
  );
  const transaction = txResult.rows[0];
  if (!transaction) {
    throw new Error("Failed to record credit transaction");
  }

  return {
    account: normalizeWallet(walletResult.rows[0] ?? wallet),
    transaction: normalizeTransaction(transaction),
    alreadyProcessed: false,
  };
}

export async function spendCredits(input: EarnSpendInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await applySpendCore(client, input);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      if (input.idempotencyKey) {
        const existing = await getTransactionByIdempotencyKey(pool, input.idempotencyKey);
        if (existing) {
          const account = await getWalletBalance(input.userId, input.venture);
          return {
            account,
            transaction: normalizeTransaction(existing),
            alreadyProcessed: true,
          };
        }
      }
      throw new CreditsIdempotencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}

export type TransferCreditsInput = {
  fromUserId: string;
  toUserId: string;
  venture: VentureType;
  amount: number;
  description: string;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
};

export async function transferCredits(input: TransferCreditsInput) {
  const finalAmount = Math.trunc(input.amount);
  if (finalAmount <= 0) {
    throw new CreditsInvalidAmountError();
  }

  const client = await pool.connect();
  let outKey: string | null = null;
  try {
    await client.query("BEGIN");

    outKey = input.idempotencyKey ? `${input.idempotencyKey}-out` : null;
    const inKey = input.idempotencyKey ? `${input.idempotencyKey}-in` : null;

    if (outKey) {
      const existing = await getTransactionByIdempotencyKey(client, outKey);
      if (existing) {
        await client.query("COMMIT");
        const account = await getWalletBalance(input.fromUserId, input.venture);
        return {
          account,
          transaction: normalizeTransaction(existing),
          alreadyProcessed: true,
        };
      }
    }

    await ensureWalletRow(client, input.fromUserId, input.venture);
    await ensureWalletRow(client, input.toUserId, input.venture);
    const fromWallet = await getWalletRowForUpdate(client, input.fromUserId, input.venture);
    const toWallet = await getWalletRowForUpdate(client, input.toUserId, input.venture);

    const fromBalanceBefore = toInt(fromWallet.balance);
    if (fromBalanceBefore < finalAmount) {
      throw new CreditsInsufficientFundsError();
    }
    const fromBalanceAfter = fromBalanceBefore - finalAmount;
    const toBalanceBefore = toInt(toWallet.balance);
    const toBalanceAfter = toBalanceBefore + finalAmount;

    await client.query(
      `UPDATE credit_wallets SET balance = $2, updated_at = NOW() WHERE id = $1`,
      [fromWallet.id, fromBalanceAfter]
    );
    await client.query(
      `UPDATE credit_wallets SET balance = $2, updated_at = NOW() WHERE id = $1`,
      [toWallet.id, toBalanceAfter]
    );

    await client.query(
      `UPDATE users SET credits_balance = credits_balance - $2, lifetime_spent = lifetime_spent + $2 WHERE id = $1`,
      [input.fromUserId, finalAmount]
    );
    await client.query(
      `UPDATE users SET credits_balance = credits_balance + $2, lifetime_earned = lifetime_earned + $2 WHERE id = $1`,
      [input.toUserId, finalAmount]
    );

    const outResult = await client.query<TransactionRow>(
      `INSERT INTO credit_transactions (
         user_id, wallet_id, venture, type, source, amount,
         balance_before, balance_after, description, metadata, idempotency_key,
         reference_id, reference_type
       ) VALUES ($1, $2, $3, 'TRANSFER_OUT', 'CROSS_VENTURE_BONUS', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        input.fromUserId,
        fromWallet.id,
        input.venture,
        -finalAmount,
        fromBalanceBefore,
        fromBalanceAfter,
        `Transfer to user ${input.toUserId}: ${input.description}`,
        JSON.stringify(input.metadata ?? {}),
        outKey,
        input.toUserId,
        "user",
      ]
    );
    const outTransaction = outResult.rows[0];
    if (!outTransaction) {
      throw new Error("Failed to record transfer-out transaction");
    }

    await client.query<TransactionRow>(
      `INSERT INTO credit_transactions (
         user_id, wallet_id, venture, type, source, amount,
         balance_before, balance_after, description, metadata, idempotency_key,
         reference_id, reference_type
       ) VALUES ($1, $2, $3, 'TRANSFER_IN', 'CROSS_VENTURE_BONUS', $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${TRANSACTION_COLUMNS}`,
      [
        input.toUserId,
        toWallet.id,
        input.venture,
        finalAmount,
        toBalanceBefore,
        toBalanceAfter,
        `Transfer from user ${input.fromUserId}: ${input.description}`,
        JSON.stringify(input.metadata ?? {}),
        inKey,
        input.fromUserId,
        "user",
      ]
    );

    await client.query("COMMIT");
    return {
      account: { ...normalizeWallet(fromWallet), balance: fromBalanceAfter },
      transaction: normalizeTransaction(outTransaction),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueConstraintViolation(error)) {
      if (outKey) {
        const existing = await getTransactionByIdempotencyKey(pool, outKey);
        if (existing) {
          const account = await getWalletBalance(input.fromUserId, input.venture);
          return {
            account,
            transaction: normalizeTransaction(existing),
            alreadyProcessed: true,
          };
        }
      }
      throw new CreditsIdempotencyConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}

export type RedemptionInput = {
  userId: string;
  venture: VentureType;
  source: CreditSource;
  amount: number;
  itemId: string;
  itemType: string;
  itemName: string;
  metadata?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
};

export async function redeemCredits(input: RedemptionInput) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const spendResult = await applySpendCore(client, {
      userId: input.userId,
      venture: input.venture,
      source: input.source,
      amount: input.amount,
      description: `Redeemed: ${input.itemName}`,
      metadata: {
        ...(input.metadata ?? {}),
        redemptionItemId: input.itemId,
        redemptionItemType: input.itemType,
      },
      idempotencyKey: input.idempotencyKey,
    });

    if (spendResult.alreadyProcessed) {
      await client.query("COMMIT");
      return {
        success: true,
        redemptionId: null,
        transaction: spendResult.transaction,
        alreadyProcessed: true,
      };
    }

    const redemptionResult = await client.query<RedemptionRow>(
      `INSERT INTO credit_redemptions (
         user_id, venture, source, amount, item_id, item_type, item_name, status, metadata, processed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED', $8, NOW())
       RETURNING id, user_id, venture, source, amount, item_id, item_type, item_name, status, processed_at, created_at`,
      [
        input.userId,
        input.venture,
        input.source,
        Math.abs(Math.trunc(input.amount)),
        input.itemId,
        input.itemType,
        input.itemName,
        JSON.stringify(input.metadata ?? {}),
      ]
    );
    const redemption = redemptionResult.rows[0];
    if (!redemption) {
      throw new Error("Failed to record redemption");
    }

    await client.query("COMMIT");
    return {
      success: true,
      redemptionId: redemption.id,
      transaction: spendResult.transaction,
      redemption: normalizeRedemption(redemption),
      alreadyProcessed: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Audit + admin
// ---------------------------------------------------------------------------

export async function recordCreditAudit(input: {
  userId?: string | null;
  venture: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  performedBy?: string | null;
  reason?: string | null;
  ipHash?: string | null;
  userAgentFamily?: string | null;
}) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO credit_audit_log (
       user_id, venture, action, entity_type, entity_id, old_value, new_value,
       performed_by, reason, ip_hash, user_agent_family
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      input.userId ?? null,
      input.venture,
      input.action,
      input.entityType,
      input.entityId,
      input.oldValue == null ? null : JSON.stringify(input.oldValue),
      input.newValue == null ? null : JSON.stringify(input.newValue),
      input.performedBy ?? null,
      input.reason ?? null,
      input.ipHash ?? null,
      input.userAgentFamily ?? null,
    ]
  );
  return result.rows[0]?.id ?? null;
}

export async function getAdminCreditsSummary() {
  const result = await pool.query<{
    total_users_with_wallets: string | number;
    total_wallets: string | number;
    total_balance_credits: string | number;
    total_lifetime_earned: string | number;
    total_lifetime_spent: string | number;
    total_transactions: string | number;
    total_redemptions: string | number;
    total_redemption_value: string | number;
  }>(
    `SELECT
       (SELECT COUNT(DISTINCT user_id)::bigint FROM credit_wallets) AS total_users_with_wallets,
       (SELECT COUNT(*)::bigint FROM credit_wallets) AS total_wallets,
       (SELECT COALESCE(SUM(balance), 0)::bigint FROM credit_wallets) AS total_balance_credits,
       (SELECT COALESCE(SUM(lifetime_earned), 0)::bigint FROM users) AS total_lifetime_earned,
       (SELECT COALESCE(SUM(lifetime_spent), 0)::bigint FROM users) AS total_lifetime_spent,
       (SELECT COUNT(*)::bigint FROM credit_transactions) AS total_transactions,
       (SELECT COUNT(*)::bigint FROM credit_redemptions) AS total_redemptions,
       (SELECT COALESCE(SUM(amount), 0)::bigint FROM credit_redemptions) AS total_redemption_value`
  );
  const row = result.rows[0] ?? {};
  return {
    totalUsersWithWallets: toInt(row.total_users_with_wallets),
    totalWallets: toInt(row.total_wallets),
    totalBalanceCredits: toInt(row.total_balance_credits),
    totalLifetimeEarned: toInt(row.total_lifetime_earned),
    totalLifetimeSpent: toInt(row.total_lifetime_spent),
    netOutstandingCredits: toInt(row.total_lifetime_earned) - toInt(row.total_lifetime_spent),
    totalTransactions: toInt(row.total_transactions),
    totalRedemptions: toInt(row.total_redemptions),
    totalRedemptionValue: toInt(row.total_redemption_value),
  };
}

export async function reconcileCreditBalances() {
  const mismatchResult = await pool.query<{
    user_id: string;
    wallet_balance: string | number;
    user_balance: string | number;
    difference: string | number;
  }>(
    `WITH wallet_totals AS (
       SELECT user_id, SUM(balance)::bigint AS wallet_balance
       FROM credit_wallets
       GROUP BY user_id
     )
     SELECT
       users.id::text AS user_id,
       wallet_totals.wallet_balance,
       users.credits_balance AS user_balance,
       wallet_totals.wallet_balance - users.credits_balance AS difference
     FROM users
     JOIN wallet_totals ON wallet_totals.user_id = users.id
     WHERE wallet_totals.wallet_balance <> users.credits_balance
     ORDER BY users.id::text ASC`
  );

  return {
    mismatchCount: mismatchResult.rows.length,
    mismatches: mismatchResult.rows.map((row) => ({
      userId: row.user_id,
      walletBalance: toInt(row.wallet_balance),
      userBalance: toInt(row.user_balance),
      difference: toInt(row.difference),
    })),
  };
}
