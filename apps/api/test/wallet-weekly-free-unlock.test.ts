import { test } from "node:test";
import assert from "node:assert/strict";

type FakeWalletAccount = {
  userId: string;
  balanceCredits: number;
  currency: string;
};

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

test("weekly detailed report unlock grants first unlock free and second unlock as paid", async () => {
  setTestEnv();

  const { unlockDetailedReportWithWeeklyFree } = await import("../src/db/wallet.js");
  const { pool } = await import("../src/db/pool.js");

  const account: FakeWalletAccount = {
    userId: "00000000-0000-0000-0000-000000001111",
    balanceCredits: 60,
    currency: "ZAR",
  };

  const weekStart = "2026-02-23";
  const freeUnlocksByIdempotency = new Map<
    string,
    {
      id: string;
      user_id: string;
      feature_key: string;
      week_start: string;
      attempt_ref_id: string | null;
      idempotency_key: string;
      created_at: string;
    }
  >();
  const weeklyUsage = new Set<string>();
  const ledgerEntries = new Map<
    string,
    {
      id: string;
      user_id: string;
      type: "CREDIT" | "DEBIT";
      amount_credits: number;
      reason: string;
      ref_type: string | null;
      ref_id: string | null;
      idempotency_key: string;
      created_at: string;
    }
  >();
  let ledgerCounter = 0;

  const fakeClient = {
    async query(queryText: string, values: unknown[] = []) {
      const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized === "begin" || normalized === "commit" || normalized === "rollback") {
        return { rows: [] };
      }

      if (normalized.includes("insert into wallet_accounts")) {
        return { rows: [] };
      }

      if (
        normalized.includes("from wallet_accounts") &&
        normalized.includes("where user_id = $1") &&
        !normalized.includes("update wallet_accounts")
      ) {
        return {
          rows: [
            {
              user_id: account.userId,
              balance_credits: account.balanceCredits,
              currency: account.currency,
              created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            },
          ],
        };
      }

      if (normalized.includes("from wallet_free_unlock_usage") && normalized.includes("idempotency_key = $1")) {
        const key = String(values[0] ?? "");
        return { rows: freeUnlocksByIdempotency.has(key) ? [freeUnlocksByIdempotency.get(key)] : [] };
      }

      if (normalized.includes("from wallet_ledger_entries") && normalized.includes("idempotency_key = $1")) {
        const key = String(values[0] ?? "");
        return { rows: ledgerEntries.has(key) ? [ledgerEntries.get(key)] : [] };
      }

      if (normalized.includes("insert into wallet_free_unlock_usage")) {
        const userId = String(values[0] ?? "");
        const featureKey = String(values[1] ?? "");
        const attemptRefId = values[2] == null ? null : String(values[2]);
        const idempotencyKey = String(values[3] ?? "");
        const weeklyKey = `${userId}:${featureKey}:${weekStart}`;

        if (freeUnlocksByIdempotency.has(idempotencyKey) || weeklyUsage.has(weeklyKey)) {
          return { rows: [] };
        }

        const row = {
          id: `free-${freeUnlocksByIdempotency.size + 1}`,
          user_id: userId,
          feature_key: featureKey,
          week_start: weekStart,
          attempt_ref_id: attemptRefId,
          idempotency_key: idempotencyKey,
          created_at: new Date("2026-02-24T00:00:00.000Z").toISOString(),
        };
        freeUnlocksByIdempotency.set(idempotencyKey, row);
        weeklyUsage.add(weeklyKey);
        return { rows: [row] };
      }

      if (normalized.includes("update wallet_accounts")) {
        account.balanceCredits = Number(values[1] ?? account.balanceCredits);
        return {
          rows: [
            {
              user_id: account.userId,
              balance_credits: account.balanceCredits,
              currency: account.currency,
              created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            },
          ],
        };
      }

      if (normalized.includes("insert into wallet_ledger_entries")) {
        const idempotencyKey = String(values[6] ?? "");
        if (ledgerEntries.has(idempotencyKey)) {
          throw { code: "23505" };
        }
        const row = {
          id: `entry-${++ledgerCounter}`,
          user_id: String(values[0]),
          type: values[1] as "CREDIT" | "DEBIT",
          amount_credits: Number(values[2]),
          reason: String(values[3]),
          ref_type: (values[4] ?? null) as string | null,
          ref_id: (values[5] ?? null) as string | null,
          idempotency_key: idempotencyKey,
          created_at: new Date("2026-02-24T00:00:00.000Z").toISOString(),
        };
        ledgerEntries.set(idempotencyKey, row);
        return { rows: [row] };
      }

      throw new Error(`Unexpected query in weekly free unlock test: ${normalized}`);
    },
    release() {
      return;
    },
  };

  const mutablePool = pool as unknown as {
    connect: () => Promise<typeof fakeClient>;
  };
  const originalConnect = mutablePool.connect;
  mutablePool.connect = async () => fakeClient;

  try {
    const first = await unlockDetailedReportWithWeeklyFree({
      userId: account.userId,
      attemptId: "attempt-free-1",
      amountCredits: 15,
      reason: "Past paper detailed marking report unlock",
      idempotencyKey: "unlock:week:1",
    });

    assert.equal(first.mode, "free_weekly");
    assert.equal(first.chargedCredits, 0);
    assert.equal(first.account.balanceCredits, 60);
    assert.equal(first.entry, null);
    assert.ok(first.freeUnlock);
    assert.equal(first.alreadyProcessed, false);
    assert.equal(ledgerEntries.size, 0);

    const repeatFirst = await unlockDetailedReportWithWeeklyFree({
      userId: account.userId,
      attemptId: "attempt-free-1",
      amountCredits: 15,
      reason: "Past paper detailed marking report unlock",
      idempotencyKey: "unlock:week:1",
    });
    assert.equal(repeatFirst.mode, "free_weekly");
    assert.equal(repeatFirst.alreadyProcessed, true);
    assert.equal(account.balanceCredits, 60);
    assert.equal(ledgerEntries.size, 0);

    const second = await unlockDetailedReportWithWeeklyFree({
      userId: account.userId,
      attemptId: "attempt-paid-2",
      amountCredits: 15,
      reason: "Past paper detailed marking report unlock",
      idempotencyKey: "unlock:week:2",
    });
    assert.equal(second.mode, "paid");
    assert.equal(second.chargedCredits, 15);
    assert.equal(second.account.balanceCredits, 45);
    assert.ok(second.entry);
    assert.equal(second.alreadyProcessed, false);
    assert.equal(ledgerEntries.size, 1);

    const repeatSecond = await unlockDetailedReportWithWeeklyFree({
      userId: account.userId,
      attemptId: "attempt-paid-2",
      amountCredits: 15,
      reason: "Past paper detailed marking report unlock",
      idempotencyKey: "unlock:week:2",
    });
    assert.equal(repeatSecond.mode, "paid");
    assert.equal(repeatSecond.alreadyProcessed, true);
    assert.equal(account.balanceCredits, 45);
    assert.equal(ledgerEntries.size, 1);
  } finally {
    mutablePool.connect = originalConnect;
  }
});
