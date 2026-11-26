import { test } from "node:test";
import assert from "node:assert/strict";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

test("wallet health totals keep ledger and account balances aligned", async () => {
  setTestEnv();

  const { getAdminWalletSummary, reconcileWalletBalances } = await import("../src/db/wallet.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      normalized.includes("with ledger as (") &&
      normalized.includes("account_balance_total_credits") &&
      normalized.includes("ledger_net_total_credits")
    ) {
      return {
        rows: [
          {
            total_wallet_accounts: 2,
            total_ledger_users: 2,
            account_balance_total_credits: 50,
            ledger_net_total_credits: 50,
          },
        ],
      };
    }
    if (normalized.includes("select (select count(*)::bigint from wallet_accounts) as total_wallet_accounts")) {
      return {
        rows: [
          {
            total_wallet_accounts: 2,
            total_credits_issued: 80,
            total_credits_debited: 30,
          },
        ],
      };
    }
    if (normalized.includes("full outer join ledger")) {
      return { rows: [] };
    }
    throw new Error(`Unexpected query in wallet health alignment test: ${normalized}`);
  };

  try {
    const summary = await getAdminWalletSummary();
    assert.equal(summary.totalWalletAccounts, 2);
    assert.equal(summary.totalCreditsIssued, 80);
    assert.equal(summary.totalCreditsDebited, 30);
    assert.equal(summary.netOutstandingCredits, 50);

    const reconciliation = await reconcileWalletBalances();
    assert.equal(reconciliation.checkedWalletAccounts, 2);
    assert.equal(reconciliation.checkedLedgerUsers, 2);
    assert.equal(reconciliation.accountBalanceTotalCredits, 50);
    assert.equal(reconciliation.ledgerNetTotalCredits, 50);
    assert.equal(reconciliation.mismatchCount, 0);
    assert.deepEqual(reconciliation.mismatches, []);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("wallet reconciliation detects mismatched account balance fixture", async () => {
  setTestEnv();

  const { reconcileWalletBalances } = await import("../src/db/wallet.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      normalized.includes("with ledger as (") &&
      normalized.includes("account_balance_total_credits") &&
      normalized.includes("ledger_net_total_credits")
    ) {
      return {
        rows: [
          {
            total_wallet_accounts: 1,
            total_ledger_users: 1,
            account_balance_total_credits: 40,
            ledger_net_total_credits: 35,
          },
        ],
      };
    }
    if (normalized.includes("full outer join ledger")) {
      return {
        rows: [
          {
            user_id: "00000000-0000-0000-0000-000000000123",
            account_balance_credits: 40,
            ledger_balance_credits: 35,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in wallet mismatch test: ${normalized}`);
  };

  try {
    const reconciliation = await reconcileWalletBalances();
    assert.equal(reconciliation.mismatchCount, 1);
    assert.equal(reconciliation.checkedWalletAccounts, 1);
    assert.equal(reconciliation.checkedLedgerUsers, 1);
    assert.equal(reconciliation.accountBalanceTotalCredits, 40);
    assert.equal(reconciliation.ledgerNetTotalCredits, 35);
    assert.deepEqual(reconciliation.mismatches[0], {
      userId: "00000000-0000-0000-0000-000000000123",
      accountBalanceCredits: 40,
      ledgerComputedBalanceCredits: 35,
      differenceCredits: 5,
      hasAccount: true,
      hasLedger: true,
    });
  } finally {
    mutablePool.query = originalQuery;
  }
});
