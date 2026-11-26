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

function buildAuthHeaders(app: any, input: { userId: string; role: string; email: string }) {
  const token = app.jwt.sign({
    sub: input.userId,
    email: input.email,
    firstName: "Test",
    lastName: "User",
    role: input.role,
    planType: "trial",
    planStatus: "active",
    isEmailVerified: true,
    isPhoneVerified: true,
    verificationLevel: "verified",
  });
  const csrfToken = "csrf-test-token";
  return {
    authorization: `Bearer ${token}`,
    cookie: `saedu_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
  };
}

test("report user route stores moderation trust event with target as actor", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  const reporterId = "00000000-0000-0000-0000-000000000001";
  const targetUserId = "00000000-0000-0000-0000-000000000002";
  const conversationId = "00000000-0000-0000-0000-000000000010";
  let insertedTrustEventValues: unknown[] | null = null;

  await withMockedQuery(
    async (queryText, values) => {
      const normalized = queryText.toLowerCase().replace(/\s+/g, " ").trim();

      if (normalized.includes("from user_suspensions")) {
        return { rows: [] };
      }
      if (
        normalized.includes("from users where id = $1") &&
        String(values?.[0] ?? "") === targetUserId
      ) {
        return {
          rows: [
            {
              id: targetUserId,
              email: "target@example.com",
              password_hash: "",
              first_name: "Target",
              last_name: "User",
              phone: "",
              role: "learner",
              is_email_verified: true,
              is_phone_verified: true,
              verification_level: "verified",
              trial_started_at: null,
              trial_ends_at: null,
              plan_type: "trial",
              plan_status: "active",
              plan_expires_at: null,
              created_at: "2026-02-26T00:00:00.000Z",
            },
          ],
        };
      }
      if (normalized.includes("select 1 from conversation_participants where conversation_id = $1 and user_id = $2")) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      if (normalized.includes("insert into trust_events")) {
        insertedTrustEventValues = values ? [...values] : [];
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000999",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeaders(app, {
        userId: reporterId,
        role: "learner",
        email: "reporter@example.com",
      });

      const response = await app.inject({
        method: "POST",
        url: `/messages/users/${targetUserId}/report`,
        headers,
        payload: {
          reason: "Harassment in direct messages",
          conversationId,
        },
      });

      assert.equal(response.statusCode, 201);
      const body = response.json() as { ok: boolean; eventId: string };
      assert.equal(body.ok, true);
      assert.equal(body.eventId, "00000000-0000-0000-0000-000000000999");
      assert.ok(insertedTrustEventValues);
      assert.equal(insertedTrustEventValues?.[0], targetUserId);
      assert.equal(insertedTrustEventValues?.[2], "abuse");
      assert.equal(insertedTrustEventValues?.[3], "medium");

      const metadata = insertedTrustEventValues?.[4] as Record<string, unknown>;
      assert.equal(metadata.source, "user_report");
      assert.equal(metadata.reporterId, reporterId);
      assert.equal(metadata.targetUserId, targetUserId);
      assert.equal(metadata.conversationId, conversationId);

      await app.close();
      await closeRedis();
    }
  );
});

test("report user route enforces spam-resistant rate limit", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  const reporterId = "00000000-0000-0000-0000-000000000021";
  const targetUserId = "00000000-0000-0000-0000-000000000022";
  const conversationId = "00000000-0000-0000-0000-000000000031";

  await withMockedQuery(
    async (queryText, values) => {
      const normalized = queryText.toLowerCase().replace(/\s+/g, " ").trim();

      if (normalized.includes("from user_suspensions")) {
        return { rows: [] };
      }
      if (
        normalized.includes("from users where id = $1") &&
        String(values?.[0] ?? "") === targetUserId
      ) {
        return {
          rows: [
            {
              id: targetUserId,
              email: "target@example.com",
              password_hash: "",
              first_name: "Target",
              last_name: "User",
              phone: "",
              role: "learner",
              is_email_verified: true,
              is_phone_verified: true,
              verification_level: "verified",
              trial_started_at: null,
              trial_ends_at: null,
              plan_type: "trial",
              plan_status: "active",
              plan_expires_at: null,
              created_at: "2026-02-26T00:00:00.000Z",
            },
          ],
        };
      }
      if (normalized.includes("select 1 from conversation_participants where conversation_id = $1 and user_id = $2")) {
        return { rows: [{ "?column?": 1 }], rowCount: 1 };
      }
      if (normalized.includes("insert into trust_events")) {
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000888",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeaders(app, {
        userId: reporterId,
        role: "learner",
        email: "reporter@example.com",
      });

      for (let index = 0; index < 8; index += 1) {
        const response = await app.inject({
          method: "POST",
          url: `/messages/users/${targetUserId}/report`,
          headers,
          payload: {
            reason: `Spam report ${index + 1}`,
            conversationId,
          },
        });
        assert.equal(response.statusCode, 201);
      }

      const throttled = await app.inject({
        method: "POST",
        url: `/messages/users/${targetUserId}/report`,
        headers,
        payload: {
          reason: "Spam report 9",
          conversationId,
        },
      });
      assert.equal(throttled.statusCode, 429);

      await app.close();
      await closeRedis();
    }
  );
});
