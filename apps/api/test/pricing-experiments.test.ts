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

test("pricing experiments list includes duration and associated metrics", async () => {
  setTestEnv();

  const { listPricingExperimentsWithMetrics } = await import("../src/db/pricing-experiments.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string, values?: unknown[]) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from pricing_experiments")) {
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000123",
            start_date: "2026-01-01T00:00:00.000Z",
            end_date: "2026-01-08T00:00:00.000Z",
            detailed_report_price_credits: 15,
            weekly_free_unlocks: 1,
            bundle_structure_json: [{ id: "starter", amountZar: 10 }],
            created_by_admin: "00000000-0000-0000-0000-000000000900",
            created_at: "2026-01-01T00:00:00.000Z",
            duration_seconds: 604800,
          },
        ],
      };
    }
    if (
      normalized.includes("with scoped_attempts as (") &&
      normalized.includes("total_topup_revenue_zar")
    ) {
      assert.equal(values?.[0], "2026-01-01T00:00:00.000Z");
      assert.equal(values?.[1], "2026-01-08T00:00:00.000Z");
      return {
        rows: [
          {
            total_attempts: 12,
            total_unlocks: 3,
            total_credits_spent: 45,
            spending_learners: 2,
            active_learners: 6,
            total_topup_revenue_zar: 30,
            topup_count: 4,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in pricing experiments list test: ${normalized}`);
  };

  try {
    const experiments = await listPricingExperimentsWithMetrics(20);
    assert.equal(experiments.length, 1);
    assert.equal(experiments[0]?.id, "00000000-0000-0000-0000-000000000123");
    assert.equal(experiments[0]?.durationSeconds, 604800);
    assert.equal(experiments[0]?.metrics.totalAttempts, 12);
    assert.equal(experiments[0]?.metrics.totalUnlocks, 3);
    assert.equal(experiments[0]?.metrics.unlockConversionRate, 0.25);
    assert.equal(experiments[0]?.metrics.arpuProxyZar, 5);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("pricing experiments list returns empty array when no experiments exist", async () => {
  setTestEnv();

  const { listPricingExperimentsWithMetrics } = await import("../src/db/pricing-experiments.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalized.includes("from pricing_experiments")) {
      return { rows: [] };
    }
    throw new Error(`Unexpected query in empty pricing experiments test: ${normalized}`);
  };

  try {
    const experiments = await listPricingExperimentsWithMetrics(20);
    assert.deepEqual(experiments, []);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("starting a pricing experiment closes previous active experiment first", async () => {
  setTestEnv();

  const { startPricingExperiment } = await import("../src/db/pricing-experiments.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    connect: () => Promise<{
      query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
      release: () => void;
    }>;
  };
  const originalConnect = mutablePool.connect;

  const executedQueries: string[] = [];
  let released = false;

  mutablePool.connect = async () => ({
    query: async (queryText: string) => {
      const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
      executedQueries.push(normalized);
      if (normalized === "begin" || normalized === "commit" || normalized === "rollback") {
        return { rows: [] };
      }
      if (normalized.startsWith("update pricing_experiments set end_date")) {
        return { rows: [] };
      }
      if (normalized.startsWith("insert into pricing_experiments")) {
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000124",
              start_date: "2026-02-01T00:00:00.000Z",
              end_date: null,
              detailed_report_price_credits: 18,
              weekly_free_unlocks: 1,
              bundle_structure_json: [{ id: "growth", amountZar: 25 }],
              created_by_admin: "00000000-0000-0000-0000-000000000900",
              created_at: "2026-02-01T00:00:00.000Z",
              duration_seconds: 0,
            },
          ],
        };
      }
      throw new Error(`Unexpected query in start pricing experiment test: ${normalized}`);
    },
    release: () => {
      released = true;
    },
  });

  try {
    const experiment = await startPricingExperiment({
      detailedReportPriceCredits: 18,
      weeklyFreeUnlocks: 1,
      bundleStructureJson: [{ id: "growth", amountZar: 25 }],
      createdByAdmin: "00000000-0000-0000-0000-000000000900",
      startDate: "2026-02-01T00:00:00.000Z",
    });

    assert.equal(experiment.id, "00000000-0000-0000-0000-000000000124");
    assert.equal(experiment.isActive, true);
    assert.equal(experiment.detailedReportPriceCredits, 18);
    assert.equal(experiment.weeklyFreeUnlocks, 1);
    assert.equal(
      executedQueries.some((query) => query.startsWith("update pricing_experiments set end_date")),
      true
    );
    assert.equal(
      executedQueries.some((query) => query.startsWith("insert into pricing_experiments")),
      true
    );
    assert.equal(released, true);
  } finally {
    mutablePool.connect = originalConnect;
  }
});

test("admin monetisation experiments endpoint returns experiment rows with metrics", async () => {
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
    if (normalized.includes("from pricing_experiments")) {
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000125",
            start_date: "2026-02-01T00:00:00.000Z",
            end_date: null,
            detailed_report_price_credits: 20,
            weekly_free_unlocks: 1,
            bundle_structure_json: [{ id: "mastery", amountZar: 50 }],
            created_by_admin: "00000000-0000-0000-0000-000000000900",
            created_at: "2026-02-01T00:00:00.000Z",
            duration_seconds: 86400,
          },
        ],
      };
    }
    if (
      normalized.includes("with scoped_attempts as (") &&
      normalized.includes("total_topup_revenue_zar")
    ) {
      return {
        rows: [
          {
            total_attempts: 8,
            total_unlocks: 2,
            total_credits_spent: 30,
            spending_learners: 2,
            active_learners: 4,
            total_topup_revenue_zar: 20,
            topup_count: 3,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in admin experiments route test: ${normalized}`);
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
      url: "/admin/monetisation/experiments?limit=10",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 200);

    const body = response.json() as {
      active_experiment_id?: string;
      experiments?: Array<{
        id: string;
        metrics: {
          total_attempts: number;
          total_unlocks: number;
          unlock_conversion_rate: number;
        };
      }>;
    };
    assert.equal(body.active_experiment_id, "00000000-0000-0000-0000-000000000125");
    assert.equal(body.experiments?.length, 1);
    assert.equal(body.experiments?.[0]?.metrics.total_attempts, 8);
    assert.equal(body.experiments?.[0]?.metrics.total_unlocks, 2);
    assert.equal(body.experiments?.[0]?.metrics.unlock_conversion_rate, 0.25);
  } finally {
    mutablePool.query = originalQuery;
    await app.close();
    await closeRedis();
  }
});
