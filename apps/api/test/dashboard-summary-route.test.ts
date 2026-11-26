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

function buildAuthHeader(app: any, input: { userId: string; role: string; email: string }) {
  const token = app.jwt.sign({
    sub: input.userId,
    email: input.email,
    firstName: "Test",
    lastName: "User",
    role: input.role,
    planType: "trial",
    planStatus: "active",
    isEmailVerified: true,
    isPhoneVerified: false,
    verificationLevel: "basic",
  });
  return { authorization: `Bearer ${token}` };
}

function buildWriteHeaders(baseHeaders: Record<string, string>, csrfToken = "test-csrf-token") {
  return {
    ...baseHeaders,
    "x-csrf-token": csrfToken,
    cookie: `saedu_csrf=${csrfToken}`,
  };
}

test("dashboard summary endpoint returns cache metadata and cache headers", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearDashboardSummaryCache, DASHBOARD_SUMMARY_CACHE_TTL_MS } = await import(
    "../src/lib/dashboard-summary.js"
  );

  await withMockedQuery(
    async () => ({ rows: [] }),
    async () => {
      clearDashboardSummaryCache();
      const app = await buildServer();

      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });

      const first = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary",
        headers,
      });
      assert.equal(first.statusCode, 200);
      assert.match(String(first.headers["cache-control"] ?? ""), /private/i);
      assert.equal(first.headers["x-dashboard-cache"], "miss");
      const firstBody = first.json() as {
        summary: { role: string };
        meta: { cached: boolean; generatedAt: string; ttlMs: number };
      };
      assert.equal(firstBody.summary.role, "learner");
      assert.equal(firstBody.meta.cached, false);
      assert.equal(typeof firstBody.meta.generatedAt, "string");
      assert.ok(firstBody.meta.ttlMs <= DASHBOARD_SUMMARY_CACHE_TTL_MS);
      assert.ok(firstBody.meta.ttlMs > 0);

      const second = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary",
        headers,
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["x-dashboard-cache"], "hit");
      const secondBody = second.json() as {
        meta: { cached: boolean; ttlMs: number };
      };
      assert.equal(secondBody.meta.cached, true);
      assert.ok(secondBody.meta.ttlMs >= 0);

      const refreshed = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary?refresh=true",
        headers,
      });
      assert.equal(refreshed.statusCode, 200);
      assert.equal(refreshed.headers["x-dashboard-cache"], "miss");
      const refreshedBody = refreshed.json() as {
        meta: { cached: boolean; ttlMs: number };
      };
      assert.equal(refreshedBody.meta.cached, false);
      assert.ok(refreshedBody.meta.ttlMs <= DASHBOARD_SUMMARY_CACHE_TTL_MS);

      await app.close();
      await closeRedis();
      clearDashboardSummaryCache();
    }
  );
});

test("dashboard summary endpoint returns role-specific payload structures", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearDashboardSummaryCache } = await import("../src/lib/dashboard-summary.js");

  await withMockedQuery(
    async () => ({ rows: [] }),
    async () => {
      clearDashboardSummaryCache();
      const app = await buildServer();

      const learnerHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000011",
        role: "learner",
        email: "learner-contract@example.com",
      });
      const learnerRes = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary",
        headers: learnerHeaders,
      });
      assert.equal(learnerRes.statusCode, 200);
      const learnerBody = learnerRes.json() as {
        summary: {
          role: string;
          cards: unknown[];
          highlights: unknown[];
          quickActions: unknown[];
          activity: { dueReviews?: unknown[]; recommendations?: unknown[] };
        };
      };
      assert.equal(learnerBody.summary.role, "learner");
      assert.ok(Array.isArray(learnerBody.summary.cards));
      assert.ok(Array.isArray(learnerBody.summary.highlights));
      assert.ok(Array.isArray(learnerBody.summary.quickActions));
      assert.ok(Array.isArray(learnerBody.summary.activity.dueReviews));
      assert.ok(Array.isArray(learnerBody.summary.activity.recommendations));

      const tutorHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000012",
        role: "tutor",
        email: "tutor-contract@example.com",
      });
      const tutorRes = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary",
        headers: tutorHeaders,
      });
      assert.equal(tutorRes.statusCode, 200);
      const tutorBody = tutorRes.json() as {
        summary: {
          role: string;
          cards: Array<{ id?: string }>;
          activity: { interactedUsers?: unknown[] };
        };
      };
      assert.equal(tutorBody.summary.role, "tutor");
      assert.ok(Array.isArray(tutorBody.summary.cards));
      assert.ok(Array.isArray(tutorBody.summary.activity.interactedUsers));
      assert.ok(tutorBody.summary.cards.some((card) => card.id === "tutor-onboarding"));

      const adminHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000013",
        role: "admin",
        email: "admin-contract@example.com",
      });
      const adminRes = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary",
        headers: adminHeaders,
      });
      assert.equal(adminRes.statusCode, 200);
      const adminBody = adminRes.json() as {
        summary: {
          role: string;
          activity: { topSubjects?: unknown[]; topLessons?: unknown[] };
        };
      };
      assert.equal(adminBody.summary.role, "admin");
      assert.ok(Array.isArray(adminBody.summary.activity.topSubjects));
      assert.ok(Array.isArray(adminBody.summary.activity.topLessons));

      await app.close();
      await closeRedis();
      clearDashboardSummaryCache();
    }
  );
});

test("dashboard summary endpoint rejects invalid refresh query", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearDashboardSummaryCache } = await import("../src/lib/dashboard-summary.js");

  await withMockedQuery(
    async () => ({ rows: [] }),
    async () => {
      clearDashboardSummaryCache();
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000021",
        role: "learner",
        email: "invalid-refresh@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/analytics/dashboard-summary?refresh=1",
        headers,
      });

      assert.equal(response.statusCode, 400);
      const body = response.json() as { error: string };
      assert.equal(body.error, "Invalid query");

      await app.close();
      await closeRedis();
      clearDashboardSummaryCache();
    }
  );
});

test("dashboard summary cache invalidates after learner analytics writes", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearDashboardSummaryCache } = await import("../src/lib/dashboard-summary.js");

  const reviewId = "00000000-0000-0000-0000-000000000099";

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (text.includes("insert into lesson_engagements")) {
        return { rows: [{ id: "engagement-id" }] };
      }
      if (text.includes("insert into quiz_attempts_v2")) {
        return { rows: [{ id: "attempt-id" }] };
      }
      if (text.includes("insert into lesson_checkpoints")) {
        return {
          rows: [
            {
              learner_id: "00000000-0000-0000-0000-000000000022",
              lesson_key: "grade-08-science-term-01-week-01",
              section_key: "summary",
              completed: true,
              notes: null,
              updated_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (
        text.includes("update learner_spaced_reviews") &&
        text.includes("returning id, lesson_key, status, updated_at")
      ) {
        return {
          rows: [
            {
              id: reviewId,
              lesson_key: "grade-08-science-term-01-week-01",
              status: "done",
              updated_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      clearDashboardSummaryCache();
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000022",
        role: "learner",
        email: "invalidate-cache@example.com",
      });
      const writeHeaders = buildWriteHeaders(headers);

      const assertMissThenHit = async () => {
        const first = await app.inject({
          method: "GET",
          url: "/analytics/dashboard-summary",
          headers,
        });
        assert.equal(first.statusCode, 200);
        assert.equal(first.headers["x-dashboard-cache"], "miss");

        const second = await app.inject({
          method: "GET",
          url: "/analytics/dashboard-summary",
          headers,
        });
        assert.equal(second.statusCode, 200);
        assert.equal(second.headers["x-dashboard-cache"], "hit");
      };

      await assertMissThenHit();

      const engagementWrite = await app.inject({
        method: "POST",
        url: "/analytics/lesson-engagement",
        headers: writeHeaders,
        payload: {
          lessonKey: "grade-08-science-term-01-week-01",
          openedAt: new Date().toISOString(),
          timeSpentSeconds: 180,
          completed: true,
        },
      });
      assert.equal(engagementWrite.statusCode, 201);
      await assertMissThenHit();

      const quizWrite = await app.inject({
        method: "POST",
        url: "/analytics/quiz-attempt",
        headers: writeHeaders,
        payload: {
          lessonKey: "grade-08-science-term-01-week-01",
          subject: "Science",
          grade: 8,
          scorePercent: 62,
          timeSpentSeconds: 240,
          answersJson: { q1: "A" },
        },
      });
      assert.equal(quizWrite.statusCode, 201);
      await assertMissThenHit();

      const checkpointWrite = await app.inject({
        method: "POST",
        url: "/analytics/lesson-checkpoints",
        headers: writeHeaders,
        payload: {
          lessonKey: "grade-08-science-term-01-week-01",
          sectionKey: "summary",
          completed: true,
        },
      });
      assert.equal(checkpointWrite.statusCode, 201);
      await assertMissThenHit();

      const doneWrite = await app.inject({
        method: "POST",
        url: `/analytics/spaced-reviews/${reviewId}/done`,
        headers: writeHeaders,
        payload: {},
      });
      assert.equal(doneWrite.statusCode, 200);
      await assertMissThenHit();

      const dismissWrite = await app.inject({
        method: "POST",
        url: `/analytics/spaced-reviews/${reviewId}/dismiss`,
        headers: writeHeaders,
        payload: {},
      });
      assert.equal(dismissWrite.statusCode, 200);
      await assertMissThenHit();

      await app.close();
      await closeRedis();
      clearDashboardSummaryCache();
    }
  );
});

test("dashboard summary cache invalidates after reminder read actions", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearDashboardSummaryCache } = await import("../src/lib/dashboard-summary.js");

  const reminderId = "00000000-0000-0000-0000-000000000111";

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (
        text.includes("with updated as") &&
        text.includes("update assignment_reminder_notifications")
      ) {
        return { rows: [{ updated_count: 2 }] };
      }
      if (
        text.includes("update assignment_reminder_notifications") &&
        text.includes("returning id")
      ) {
        return { rows: [{ id: reminderId }] };
      }
      return { rows: [] };
    },
    async () => {
      clearDashboardSummaryCache();
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000023",
        role: "learner",
        email: "invalidate-reminders@example.com",
      });
      const writeHeaders = buildWriteHeaders(headers);

      const assertMissThenHit = async () => {
        const first = await app.inject({
          method: "GET",
          url: "/analytics/dashboard-summary",
          headers,
        });
        assert.equal(first.statusCode, 200);
        assert.equal(first.headers["x-dashboard-cache"], "miss");

        const second = await app.inject({
          method: "GET",
          url: "/analytics/dashboard-summary",
          headers,
        });
        assert.equal(second.statusCode, 200);
        assert.equal(second.headers["x-dashboard-cache"], "hit");
      };

      await assertMissThenHit();

      const readAll = await app.inject({
        method: "POST",
        url: "/messages/assignment-reminders/read-all",
        headers: writeHeaders,
        payload: {},
      });
      assert.equal(readAll.statusCode, 200);
      await assertMissThenHit();

      const readOne = await app.inject({
        method: "POST",
        url: `/messages/assignment-reminders/${reminderId}/read`,
        headers: writeHeaders,
        payload: {},
      });
      assert.equal(readOne.statusCode, 200);
      await assertMissThenHit();

      await app.close();
      await closeRedis();
      clearDashboardSummaryCache();
    }
  );
});
