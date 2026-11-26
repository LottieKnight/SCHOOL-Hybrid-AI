import { test } from "node:test";
import assert from "node:assert/strict";
import type { UserRecord } from "../src/db/users.js";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

type FakeWalletAccount = {
  userId: string;
  balanceCredits: number;
  currency: string;
};

test("wallet debit idempotency only debits once for repeated key", async () => {
  setTestEnv();

  const { debitWallet } = await import("../src/db/wallet.js");
  const { pool } = await import("../src/db/pool.js");

  const account: FakeWalletAccount = {
    userId: "00000000-0000-0000-0000-000000000123",
    balanceCredits: 100,
    currency: "ZAR",
  };
  let entryCounter = 0;
  const entries = new Map<
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

      if (normalized.includes("from wallet_ledger_entries where idempotency_key = $1")) {
        const key = String(values[0] ?? "");
        return { rows: entries.has(key) ? [entries.get(key)] : [] };
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
        const id = `entry-${++entryCounter}`;
        const row = {
          id,
          user_id: String(values[0]),
          type: values[1] as "CREDIT" | "DEBIT",
          amount_credits: Number(values[2]),
          reason: String(values[3]),
          ref_type: (values[4] ?? null) as string | null,
          ref_id: (values[5] ?? null) as string | null,
          idempotency_key: String(values[6]),
          created_at: new Date("2026-01-02T00:00:00.000Z").toISOString(),
        };
        entries.set(row.idempotency_key, row);
        return { rows: [row] };
      }

      throw new Error(`Unexpected query in wallet idempotency test: ${normalized}`);
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
    const idempotencyKey = "attempt:abc123:detailed-report";
    const first = await debitWallet({
      userId: account.userId,
      amountCredits: 30,
      reason: "Past paper detailed report unlock",
      refType: "past_paper_unlock",
      refId: "attempt-abc123",
      idempotencyKey,
    });
    assert.equal(first.alreadyProcessed, false);
    assert.equal(first.account.balanceCredits, 70);
    assert.equal(entries.size, 1);

    const second = await debitWallet({
      userId: account.userId,
      amountCredits: 30,
      reason: "Past paper detailed report unlock",
      refType: "past_paper_unlock",
      refId: "attempt-abc123",
      idempotencyKey,
    });
    assert.equal(second.alreadyProcessed, true);
    assert.equal(second.account.balanceCredits, 70);
    assert.equal(entries.size, 1);
  } finally {
    mutablePool.connect = originalConnect;
  }
});

test("billing webhook processor grants plan entitlements through verified path", async () => {
  setTestEnv();

  const { processBillingWebhookUpgrade } = await import("../src/lib/billing-webhook.js");

  const user: UserRecord = {
    id: "00000000-0000-0000-0000-000000000888",
    email: "learner@example.com",
    password_hash: "hash",
    first_name: "Test",
    last_name: "User",
    phone: "+27110000000",
    role: "learner",
    is_email_verified: true,
    is_phone_verified: true,
    verification_level: "verified",
    trial_started_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    trial_ends_at: new Date("2026-01-08T00:00:00.000Z").toISOString(),
    plan_type: "trial",
    plan_status: "trialing",
    plan_expires_at: null,
    created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };

  const rawBody = JSON.stringify({
    id: "evt_billing_001",
    type: "checkout.session.completed",
    data: {
      object: {
        payment_status: "paid",
        metadata: {
          userId: user.id,
          planType: "monthly",
        },
      },
    },
  });

  const updates: Array<{ userId: string; planType: string; status: string; expiresAt: Date | null }> = [];
  const audits: Array<Record<string, unknown>> = [];

  const result = await processBillingWebhookUpgrade(
    {
      provider: "stripe",
      rawBody,
      signatureHeader: "t=1,v1=test",
      stripeWebhookSecretConfigured: true,
    },
    {
      verifySignature: () => true,
      parseEvent: (payload) => JSON.parse(payload),
      markProcessed: async () => true,
      findUser: async () => user,
      updatePlan: async (userId, planType, status, expiresAt) => {
        updates.push({ userId, planType, status, expiresAt });
        return {
          ...user,
          id: userId,
          plan_type: planType,
          plan_status: status,
          plan_expires_at: expiresAt ? expiresAt.toISOString() : null,
        };
      },
      createAuditEvent: async (_userId, metadata) => {
        audits.push(metadata);
      },
      now: () => new Date("2026-02-01T00:00:00.000Z"),
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.handled, true);
  assert.equal(result.planType, "monthly");
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "active");
  assert.equal(audits.length, 1);

  const duplicate = await processBillingWebhookUpgrade(
    {
      provider: "stripe",
      rawBody,
      signatureHeader: "t=1,v1=test",
      stripeWebhookSecretConfigured: true,
    },
    {
      verifySignature: () => true,
      parseEvent: (payload) => JSON.parse(payload),
      markProcessed: async () => false,
      findUser: async () => user,
      updatePlan: async () => user,
      createAuditEvent: async () => undefined,
      now: () => new Date("2026-02-01T00:00:00.000Z"),
    }
  );

  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.handled, false);
});

test("wallet debit concurrency keeps balance non-negative across 50 parallel requests", async () => {
  setTestEnv();

  const { debitWallet, WalletInsufficientFundsError } = await import("../src/db/wallet.js");
  const { pool } = await import("../src/db/pool.js");

  const account: FakeWalletAccount = {
    userId: "00000000-0000-0000-0000-000000000777",
    balanceCredits: 100,
    currency: "ZAR",
  };

  let entryCounter = 0;
  const entries = new Map<
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

  let rowLockHeld = false;
  const rowLockWaiters: Array<() => void> = [];

  const acquireRowLock = async () => {
    if (!rowLockHeld) {
      rowLockHeld = true;
      return;
    }
    await new Promise<void>((resolve) => {
      rowLockWaiters.push(resolve);
    });
    rowLockHeld = true;
  };

  const releaseRowLock = () => {
    if (!rowLockHeld) return;
    rowLockHeld = false;
    const next = rowLockWaiters.shift();
    if (next) next();
  };

  const fakeClient = {
    async query(queryText: string, values: unknown[] = []) {
      const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized === "begin") return { rows: [] };
      if (normalized === "commit" || normalized === "rollback") {
        releaseRowLock();
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
        if (normalized.includes("for update")) {
          await acquireRowLock();
        }
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

      if (normalized.includes("from wallet_ledger_entries where idempotency_key = $1")) {
        const key = String(values[0] ?? "");
        return { rows: entries.has(key) ? [entries.get(key)] : [] };
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
        if (entries.has(idempotencyKey)) {
          throw { code: "23505" };
        }
        const id = `entry-${++entryCounter}`;
        const row = {
          id,
          user_id: String(values[0]),
          type: values[1] as "CREDIT" | "DEBIT",
          amount_credits: Number(values[2]),
          reason: String(values[3]),
          ref_type: (values[4] ?? null) as string | null,
          ref_id: (values[5] ?? null) as string | null,
          idempotency_key: idempotencyKey,
          created_at: new Date("2026-01-02T00:00:00.000Z").toISOString(),
        };
        entries.set(row.idempotency_key, row);
        return { rows: [row] };
      }

      throw new Error(`Unexpected query in wallet concurrency test: ${normalized}`);
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
    const operations = Array.from({ length: 50 }, (_, index) =>
      debitWallet({
        userId: account.userId,
        amountCredits: 3,
        reason: "Concurrent load test debit",
        refType: "load_test",
        refId: `attempt-${index}`,
        idempotencyKey: `concurrency:debit:${index}`,
      })
    );

    const outcomes = await Promise.allSettled(operations);
    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    assert.equal(fulfilled.length, 33);
    assert.equal(rejected.length, 17);
    assert.equal(
      rejected.every(
        (outcome) =>
          outcome.status === "rejected" && outcome.reason instanceof WalletInsufficientFundsError
      ),
      true
    );

    assert.equal(account.balanceCredits, 1);
    assert.equal(account.balanceCredits >= 0, true);
    assert.equal(entries.size, 33);
    assert.equal(
      Array.from(entries.values()).every((entry) => entry.type === "DEBIT" && entry.amount_credits === 3),
      true
    );
  } finally {
    mutablePool.connect = originalConnect;
  }
});

test("wallet webhook dedupe processes duplicate event id only once", async () => {
  setTestEnv();

  const { markWebhookEventProcessed, creditWallet } = await import("../src/db/wallet.js");
  const { resolveWalletTopupSelection } = await import("../src/lib/wallet-pricing.js");
  const { pool } = await import("../src/db/pool.js");

  const account: FakeWalletAccount = {
    userId: "00000000-0000-0000-0000-000000000555",
    balanceCredits: 0,
    currency: "ZAR",
  };

  const processedEvents = new Set<string>();
  const entries = new Map<
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
  let entryCounter = 0;

  const fakePoolQuery = async (queryText: string, values: unknown[] = []) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("insert into processed_webhook_events")) {
      const key = `${String(values[0] ?? "")}:${String(values[1] ?? "")}`;
      if (processedEvents.has(key)) return { rows: [] };
      processedEvents.add(key);
      return { rows: [{ provider: String(values[0]), event_id: String(values[1]) }] };
    }
    throw new Error(`Unexpected pool.query in wallet webhook dedupe test: ${normalized}`);
  };

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
      if (normalized.includes("from wallet_ledger_entries where idempotency_key = $1")) {
        const key = String(values[0] ?? "");
        return { rows: entries.has(key) ? [entries.get(key)] : [] };
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
        if (entries.has(idempotencyKey)) {
          throw { code: "23505" };
        }
        const row = {
          id: `entry-${++entryCounter}`,
          user_id: String(values[0]),
          type: values[1] as "CREDIT" | "DEBIT",
          amount_credits: Number(values[2]),
          reason: String(values[3]),
          ref_type: (values[4] ?? null) as string | null,
          ref_id: (values[5] ?? null) as string | null,
          idempotency_key: idempotencyKey,
          created_at: new Date("2026-01-02T00:00:00.000Z").toISOString(),
        };
        entries.set(idempotencyKey, row);
        return { rows: [row] };
      }
      throw new Error(`Unexpected query in wallet webhook dedupe test: ${normalized}`);
    },
    release() {
      return;
    },
  };

  const mutablePool = pool as unknown as {
    connect: () => Promise<typeof fakeClient>;
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalConnect = mutablePool.connect;
  const originalQuery = mutablePool.query;
  mutablePool.connect = async () => fakeClient;
  mutablePool.query = fakePoolQuery;

  try {
    const bundleTopup = resolveWalletTopupSelection({ bundleId: "growth" });
    assert.ok(bundleTopup);
    const creditedAmount = bundleTopup.totalCredits;
    assert.equal(bundleTopup.bonusCredits > 0, true);

    const processEvent = async (eventId: string) => {
      const marked = await markWebhookEventProcessed("stripe", eventId);
      if (!marked) return false;
      await creditWallet({
        userId: account.userId,
        amountCredits: creditedAmount,
        reason: "Wallet top-up",
        refType: "wallet_topup",
        refId: "topup-1",
        idempotencyKey: `wallet-topup:stripe:${eventId}`,
      });
      return true;
    };

    const first = await processEvent("evt_wallet_001");
    const second = await processEvent("evt_wallet_001");

    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(processedEvents.size, 1);
    assert.equal(account.balanceCredits, creditedAmount);
    assert.equal(entries.size, 1);
  } finally {
    mutablePool.connect = originalConnect;
    mutablePool.query = originalQuery;
  }
});

test("webhook routes fail closed in production when Stripe secret is missing", async () => {
  setTestEnv();

  const { shouldRejectStripeWebhookWithoutSecret } = await import("../src/routes/wallet.js");
  const { shouldRejectBillingWebhookWithoutSecret } = await import("../src/routes/billing.js");

  assert.equal(
    shouldRejectStripeWebhookWithoutSecret({ isProd: true, stripeWebhookSecret: "" }),
    true
  );
  assert.equal(
    shouldRejectStripeWebhookWithoutSecret({ isProd: false, stripeWebhookSecret: "" }),
    false
  );
  assert.equal(
    shouldRejectStripeWebhookWithoutSecret({ isProd: true, stripeWebhookSecret: "whsec_live" }),
    false
  );

  assert.equal(
    shouldRejectBillingWebhookWithoutSecret({ isProd: true, stripeWebhookSecret: "" }),
    true
  );
  assert.equal(
    shouldRejectBillingWebhookWithoutSecret({ isProd: false, stripeWebhookSecret: "" }),
    false
  );
  assert.equal(
    shouldRejectBillingWebhookWithoutSecret({ isProd: true, stripeWebhookSecret: "whsec_live" }),
    false
  );
});
