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

test("monetisation summary computes conversion, average spend, and arpu proxy", async () => {
  setTestEnv();

  const { getMonetisationSummary } = await import("../src/db/monetisation.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      normalized.includes("total_credits_spent") &&
      normalized.includes("weekly_topup_count") &&
      normalized.includes("total_topup_revenue_zar")
    ) {
      return {
        rows: [
          {
            total_attempts: 20,
            total_unlocks: 5,
            total_credits_spent: 100,
            spending_learners: 4,
            active_learners: 10,
            total_topup_revenue_zar: 80,
            weekly_topup_count: 6,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in monetisation summary test: ${normalized}`);
  };

  try {
    const summary = await getMonetisationSummary("7d");
    assert.equal(summary.range, "7d");
    assert.equal(summary.rangeDays, 7);
    assert.equal(summary.totalAttempts, 20);
    assert.equal(summary.totalUnlocks, 5);
    assert.equal(summary.unlockConversionRate, 0.25);
    assert.equal(summary.totalCreditsSpent, 100);
    assert.equal(summary.spendingLearners, 4);
    assert.equal(summary.averageCreditsSpentPerLearner, 25);
    assert.equal(summary.weeklyTopupCount, 6);
    assert.equal(summary.totalTopupRevenueZar, 80);
    assert.equal(summary.activeLearners, 10);
    assert.equal(summary.arpuProxyZar, 8);
    assert.equal(typeof summary.generatedAt, "string");
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("monetisation summary handles empty datasets without crashing", async () => {
  setTestEnv();

  const { getMonetisationSummary } = await import("../src/db/monetisation.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async () => ({ rows: [] });

  try {
    const summary = await getMonetisationSummary("30d");
    assert.equal(summary.range, "30d");
    assert.equal(summary.rangeDays, 30);
    assert.equal(summary.totalAttempts, 0);
    assert.equal(summary.totalUnlocks, 0);
    assert.equal(summary.unlockConversionRate, 0);
    assert.equal(summary.totalCreditsSpent, 0);
    assert.equal(summary.spendingLearners, 0);
    assert.equal(summary.averageCreditsSpentPerLearner, 0);
    assert.equal(summary.weeklyTopupCount, 0);
    assert.equal(summary.totalTopupRevenueZar, 0);
    assert.equal(summary.activeLearners, 0);
    assert.equal(summary.arpuProxyZar, 0);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("monetisation summary applies experiment date window when experiment_id is provided", async () => {
  setTestEnv();

  const { getMonetisationSummary } = await import("../src/db/monetisation.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string, values?: unknown[]) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from pricing_experiments")) {
      assert.equal(values?.[0], "00000000-0000-0000-0000-000000000222");
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000222",
            start_date: "2026-01-10T00:00:00.000Z",
            end_date: "2026-01-17T00:00:00.000Z",
          },
        ],
      };
    }
    if (
      normalized.includes("total_credits_spent") &&
      normalized.includes("scoped_topup_count.weekly_topup_count")
    ) {
      assert.equal(values?.[0], "2026-01-10T00:00:00.000Z");
      assert.equal(values?.[1], "2026-01-17T00:00:00.000Z");
      return {
        rows: [
          {
            total_attempts: 16,
            total_unlocks: 4,
            total_credits_spent: 64,
            spending_learners: 4,
            active_learners: 8,
            total_topup_revenue_zar: 48,
            weekly_topup_count: 5,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in experiment scoped monetisation test: ${normalized}`);
  };

  try {
    const summary = await getMonetisationSummary("7d", {
      experimentId: "00000000-0000-0000-0000-000000000222",
    });
    assert.ok(summary);
    assert.equal(summary?.scope, "experiment");
    assert.equal(summary?.experimentId, "00000000-0000-0000-0000-000000000222");
    assert.equal(summary?.rangeDays, 7);
    assert.equal(summary?.totalAttempts, 16);
    assert.equal(summary?.totalUnlocks, 4);
    assert.equal(summary?.unlockConversionRate, 0.25);
    assert.equal(summary?.averageCreditsSpentPerLearner, 16);
    assert.equal(summary?.weeklyTopupCount, 5);
    assert.equal(summary?.arpuProxyZar, 6);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("monetisation summary experiment scope handles empty metric rows without crashing", async () => {
  setTestEnv();

  const { getMonetisationSummary } = await import("../src/db/monetisation.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from pricing_experiments")) {
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000223",
            start_date: "2026-01-20T00:00:00.000Z",
            end_date: null,
          },
        ],
      };
    }
    if (
      normalized.includes("total_credits_spent") &&
      normalized.includes("scoped_topup_count.weekly_topup_count")
    ) {
      return { rows: [] };
    }
    throw new Error(`Unexpected query in experiment empty monetisation test: ${normalized}`);
  };

  try {
    const summary = await getMonetisationSummary("30d", {
      experimentId: "00000000-0000-0000-0000-000000000223",
    });
    assert.ok(summary);
    assert.equal(summary?.scope, "experiment");
    assert.equal(summary?.experimentId, "00000000-0000-0000-0000-000000000223");
    assert.equal(summary?.totalAttempts, 0);
    assert.equal(summary?.totalUnlocks, 0);
    assert.equal(summary?.unlockConversionRate, 0);
    assert.equal(summary?.totalCreditsSpent, 0);
    assert.equal(summary?.spendingLearners, 0);
    assert.equal(summary?.averageCreditsSpentPerLearner, 0);
    assert.equal(summary?.weeklyTopupCount, 0);
    assert.equal(summary?.totalTopupRevenueZar, 0);
    assert.equal(summary?.activeLearners, 0);
    assert.equal(summary?.arpuProxyZar, 0);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("admin monetisation endpoint returns required metric fields", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from user_suspensions")) {
      return { rows: [] };
    }
    if (
      normalized.includes("total_credits_spent") &&
      normalized.includes("weekly_topup_count") &&
      normalized.includes("total_topup_revenue_zar")
    ) {
      return {
        rows: [
          {
            total_attempts: 12,
            total_unlocks: 3,
            total_credits_spent: 45,
            spending_learners: 2,
            active_learners: 6,
            total_topup_revenue_zar: 30,
            weekly_topup_count: 4,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in admin monetisation endpoint test: ${normalized}`);
  };

  const app = await buildServer();
  const token = app.jwt.sign({
    sub: "00000000-0000-0000-0000-000000000900",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    planType: "trial",
    planStatus: "active",
    isEmailVerified: true,
    isPhoneVerified: true,
    verificationLevel: "verified",
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/admin/monetisation?range=7d",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 200);

    const body = response.json() as Record<string, unknown>;
    assert.equal(body.total_attempts, 12);
    assert.equal(body.total_unlocks, 3);
    assert.equal(body.unlock_conversion_rate, 0.25);
    assert.equal(body.average_credits_spent_per_learner, 22.5);
    assert.equal(body.weekly_topup_count, 4);
    assert.equal(body.arpu_proxy_zar, 5);
  } finally {
    mutablePool.query = originalQuery;
    await app.close();
    await closeRedis();
  }
});

test("admin monetisation endpoint supports experiment_id-scoped aggregation", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string, values?: unknown[]) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from user_suspensions")) {
      return { rows: [] };
    }
    if (normalized.includes("from pricing_experiments")) {
      assert.equal(values?.[0], "00000000-0000-0000-0000-000000000224");
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000224",
            start_date: "2026-02-01T00:00:00.000Z",
            end_date: "2026-02-08T00:00:00.000Z",
          },
        ],
      };
    }
    if (
      normalized.includes("total_credits_spent") &&
      normalized.includes("scoped_topup_count.weekly_topup_count")
    ) {
      assert.equal(values?.[0], "2026-02-01T00:00:00.000Z");
      assert.equal(values?.[1], "2026-02-08T00:00:00.000Z");
      return {
        rows: [
          {
            total_attempts: 10,
            total_unlocks: 4,
            total_credits_spent: 40,
            spending_learners: 2,
            active_learners: 5,
            total_topup_revenue_zar: 25,
            weekly_topup_count: 3,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in admin scoped monetisation endpoint test: ${normalized}`);
  };

  const app = await buildServer();
  const token = app.jwt.sign({
    sub: "00000000-0000-0000-0000-000000000900",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    planType: "trial",
    planStatus: "active",
    isEmailVerified: true,
    isPhoneVerified: true,
    verificationLevel: "verified",
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/admin/monetisation?range=30d&experiment_id=00000000-0000-0000-0000-000000000224",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 200);

    const body = response.json() as Record<string, unknown>;
    assert.equal(body.scope, "experiment");
    assert.equal(body.experiment_id, "00000000-0000-0000-0000-000000000224");
    assert.equal(body.total_attempts, 10);
    assert.equal(body.total_unlocks, 4);
    assert.equal(body.unlock_conversion_rate, 0.4);
    assert.equal(body.weekly_topup_count, 3);
  } finally {
    mutablePool.query = originalQuery;
    await app.close();
    await closeRedis();
  }
});
