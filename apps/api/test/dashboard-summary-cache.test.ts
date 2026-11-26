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

type QueryMock = (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;

async function withMockedQuery(mock: QueryMock, run: () => Promise<void>) {
  const { pool } = await import("../src/db/pool.js");
  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const original = mutablePool.query;
  mutablePool.query = mock;
  try {
    await run();
  } finally {
    mutablePool.query = original;
  }
}

test("dashboard summary cache reuses query results until refresh is requested", async () => {
  setTestEnv();
  const { getDashboardSummaryCached, clearDashboardSummaryCache } = await import(
    "../src/lib/dashboard-summary.js"
  );

  let queryCount = 0;
  await withMockedQuery(
    async () => {
      queryCount += 1;
      return { rows: [] };
    },
    async () => {
      clearDashboardSummaryCache();
      const input = {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      };

      const first = await getDashboardSummaryCached(input);
      assert.equal(first.cached, false);
      assert.ok(queryCount > 0);
      const afterFirstQueryCount = queryCount;

      const second = await getDashboardSummaryCached(input);
      assert.equal(second.cached, true);
      assert.equal(queryCount, afterFirstQueryCount);
      assert.deepEqual(second.summary, first.summary);

      const third = await getDashboardSummaryCached(input, { refresh: true });
      assert.equal(third.cached, false);
      assert.ok(queryCount > afterFirstQueryCount);

      clearDashboardSummaryCache();
    }
  );
});

test("dashboard summary cache can invalidate one user without evicting others", async () => {
  setTestEnv();
  const { getDashboardSummaryCached, clearDashboardSummaryCache } = await import(
    "../src/lib/dashboard-summary.js"
  );

  let queryCount = 0;
  await withMockedQuery(
    async () => {
      queryCount += 1;
      return { rows: [] };
    },
    async () => {
      clearDashboardSummaryCache();
      const userA = {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "a@example.com",
      };
      const userB = {
        userId: "00000000-0000-0000-0000-000000000002",
        role: "learner",
        email: "b@example.com",
      };

      await getDashboardSummaryCached(userA);
      await getDashboardSummaryCached(userB);
      const baseline = queryCount;

      await getDashboardSummaryCached(userA);
      await getDashboardSummaryCached(userB);
      assert.equal(queryCount, baseline);

      clearDashboardSummaryCache({ userId: userA.userId });
      await getDashboardSummaryCached(userA);
      const afterARebuild = queryCount;
      assert.ok(afterARebuild > baseline);

      await getDashboardSummaryCached(userB);
      assert.equal(queryCount, afterARebuild);

      clearDashboardSummaryCache();
    }
  );
});
