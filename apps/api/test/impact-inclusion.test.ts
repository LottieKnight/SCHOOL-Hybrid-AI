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

test("impact inclusion summary returns stable metric shape", async () => {
  setTestEnv();

  const { getImpactInclusionSummary } = await import("../src/db/impact.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async (queryText: string) => {
    const normalized = queryText.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      normalized.includes("lite_mode_usage_percent") &&
      normalized.includes("median_unlock_payload_size") &&
      normalized.includes("median_learn_payload_size_proxy")
    ) {
      return {
        rows: [
          {
            lite_mode_usage_percent: "37.5",
            median_unlock_payload_size: "512",
            median_learn_payload_size_proxy: "10240",
            unlock_payload_sample_count: "12",
            learn_payload_sample_count: "24",
            active_users: "16",
          },
        ],
      };
    }
    throw new Error(`Unexpected query in inclusion summary test: ${normalized}`);
  };

  try {
    const summary = await getImpactInclusionSummary("7d");
    assert.equal(summary.range, "7d");
    assert.equal(summary.rangeDays, 7);
    assert.equal(summary.liteModeUsagePercent, 37.5);
    assert.equal(summary.medianUnlockPayloadSize, 512);
    assert.equal(summary.medianLearnPayloadSizeProxy, 10240);
    assert.equal(summary.unlockPayloadSampleCount, 12);
    assert.equal(summary.learnPayloadSampleCount, 24);
    assert.equal(summary.activeUsers, 16);
    assert.equal(typeof summary.generatedAt, "string");
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("impact inclusion summary handles empty datasets without crashing", async () => {
  setTestEnv();

  const { getImpactInclusionSummary } = await import("../src/db/impact.js");
  const { pool } = await import("../src/db/pool.js");

  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const originalQuery = mutablePool.query;

  mutablePool.query = async () => ({ rows: [] });

  try {
    const summary = await getImpactInclusionSummary("30d");
    assert.equal(summary.range, "30d");
    assert.equal(summary.rangeDays, 30);
    assert.equal(summary.liteModeUsagePercent, 0);
    assert.equal(summary.medianUnlockPayloadSize, 0);
    assert.equal(summary.medianLearnPayloadSizeProxy, 0);
    assert.equal(summary.unlockPayloadSampleCount, 0);
    assert.equal(summary.learnPayloadSampleCount, 0);
    assert.equal(summary.activeUsers, 0);
  } finally {
    mutablePool.query = originalQuery;
  }
});

test("admin inclusion endpoint returns required metric fields", async () => {
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
      normalized.includes("lite_mode_usage_percent") &&
      normalized.includes("median_unlock_payload_size") &&
      normalized.includes("median_learn_payload_size_proxy")
    ) {
      return {
        rows: [
          {
            lite_mode_usage_percent: 42,
            median_unlock_payload_size: 550,
            median_learn_payload_size_proxy: 9800,
            unlock_payload_sample_count: 10,
            learn_payload_sample_count: 12,
            active_users: 20,
          },
        ],
      };
    }
    throw new Error(`Unexpected query in admin inclusion endpoint test: ${normalized}`);
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
      url: "/admin/impact/inclusion?range=7d",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json() as Record<string, unknown>;
    assert.equal(body.lite_mode_usage_percent, 42);
    assert.equal(body.median_unlock_payload_size, 550);
    assert.equal(body.median_learn_payload_size_proxy, 9800);
    assert.equal(body.unlock_payload_sample_count, 10);
    assert.equal(body.learn_payload_sample_count, 12);
    assert.equal(body.active_users, 20);
  } finally {
    mutablePool.query = originalQuery;
    await app.close();
    await closeRedis();
  }
});
