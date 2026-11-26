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

test("health endpoint responds even when db is unavailable", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);

  const body = response.json() as { status: string; db: string; uptime: number };
  assert.equal(body.status, "ok");
  assert.ok(body.db === "ok" || body.db === "unavailable");
  assert.equal(typeof body.uptime, "number");

  await app.close();
  await closeRedis();
});

test("analytics endpoints require auth", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const lessonEngagementRes = await app.inject({
    method: "POST",
    url: "/analytics/lesson-engagement",
    payload: {
      lessonKey: "foundation-grade-01-maths-term-01-week-01",
      openedAt: new Date().toISOString(),
      timeSpentSeconds: 120,
      completed: true,
    },
  });
  assert.equal(lessonEngagementRes.statusCode, 401);

  const adminAnalyticsRes = await app.inject({
    method: "GET",
    url: "/admin/learning-analytics",
  });
  assert.equal(adminAnalyticsRes.statusCode, 401);

  const adminWalletSummaryRes = await app.inject({
    method: "GET",
    url: "/admin/wallet/summary",
  });
  assert.equal(adminWalletSummaryRes.statusCode, 401);

  const adminWalletReconcileRes = await app.inject({
    method: "GET",
    url: "/admin/wallet/reconcile",
  });
  assert.equal(adminWalletReconcileRes.statusCode, 401);

  const adminUnlockFunnelRes = await app.inject({
    method: "GET",
    url: "/admin/funnels/unlock",
  });
  assert.equal(adminUnlockFunnelRes.statusCode, 401);

  const adminQuoteFunnelRes = await app.inject({
    method: "GET",
    url: "/admin/funnels/quotes",
  });
  assert.equal(adminQuoteFunnelRes.statusCode, 401);

  const adminMonetisationRes = await app.inject({
    method: "GET",
    url: "/admin/monetisation",
  });
  assert.equal(adminMonetisationRes.statusCode, 401);

  const adminMonetisationExperimentsRes = await app.inject({
    method: "GET",
    url: "/admin/monetisation/experiments",
  });
  assert.equal(adminMonetisationExperimentsRes.statusCode, 401);

  const adminMonetisationExperimentCreateRes = await app.inject({
    method: "POST",
    url: "/admin/monetisation/experiments",
    payload: {
      detailedReportPriceCredits: 15,
      weeklyFreeUnlocks: 1,
      bundleStructureJson: [],
    },
  });
  assert.equal(adminMonetisationExperimentCreateRes.statusCode, 401);

  const adminImpactInclusionRes = await app.inject({
    method: "GET",
    url: "/admin/impact/inclusion",
  });
  assert.equal(adminImpactInclusionRes.statusCode, 401);

  const dashboardSummaryRes = await app.inject({
    method: "GET",
    url: "/analytics/dashboard-summary",
  });
  assert.equal(dashboardSummaryRes.statusCode, 401);

  await app.close();
  await closeRedis();
});
