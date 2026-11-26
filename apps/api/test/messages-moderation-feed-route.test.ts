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

test("admin moderation feed route returns trust events with filters", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  let seenLimit = 0;
  let seenType = "";
  let seenSeverity = "";

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("te.type = $2::text") && text.includes("te.severity = $3::text")) {
        seenLimit = Number(values?.[0] ?? 0);
        seenType = String(values?.[1] ?? "");
        seenSeverity = String(values?.[2] ?? "");
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000901",
              actor_id: "00000000-0000-0000-0000-000000000010",
              actor_email: "flagged@example.com",
              actor_name: "Flagged User",
              session_id: null,
              type: "abuse",
              severity: "high",
              metadata: { source: "message_report", messageId: "00000000-0000-0000-0000-000000000777" },
              created_at: "2026-02-21T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "admin",
        email: "admin@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/messages/moderation-feed?limit=25&type=abuse&severity=high",
        headers,
      });
      assert.equal(response.statusCode, 200);
      assert.equal(seenLimit, 25);
      assert.equal(seenType, "abuse");
      assert.equal(seenSeverity, "high");

      const body = response.json() as {
        events: Array<{ id: string; type: string; severity: string; actor_email: string }>;
      };
      assert.equal(body.events.length, 1);
      assert.equal(body.events[0]?.id, "00000000-0000-0000-0000-000000000901");
      assert.equal(body.events[0]?.type, "abuse");
      assert.equal(body.events[0]?.severity, "high");
      assert.equal(body.events[0]?.actor_email, "flagged@example.com");

      await app.close();
      await closeRedis();
    }
  );
});

test("admin moderation feed route applies defaults when no filters are provided", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  let seenValues: unknown[] | undefined;

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("te.type = $2::text") && text.includes("te.severity = $3::text")) {
        seenValues = values;
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000902",
              actor_id: "00000000-0000-0000-0000-000000000011",
              actor_email: "review@example.com",
              actor_name: "Review User",
              session_id: null,
              type: "off_platform_attempt",
              severity: "medium",
              metadata: null,
              created_at: "2026-02-21T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "admin",
        email: "admin@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/messages/moderation-feed",
        headers,
      });
      assert.equal(response.statusCode, 200);
      assert.ok(Array.isArray(seenValues));
      assert.equal(Number(seenValues?.[0] ?? 0), 40);
      assert.equal(seenValues?.[1] ?? null, null);
      assert.equal(seenValues?.[2] ?? null, null);

      const body = response.json() as {
        events: Array<{ id: string; type: string; severity: string; actor_email: string }>;
      };
      assert.equal(body.events.length, 1);
      assert.equal(body.events[0]?.id, "00000000-0000-0000-0000-000000000902");

      await app.close();
      await closeRedis();
    }
  );
});

test("admin moderation feed route rejects invalid filter values", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  await withMockedQuery(
    async () => ({ rows: [] }),
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "admin",
        email: "admin@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/messages/moderation-feed?severity=critical",
        headers,
      });
      assert.equal(response.statusCode, 400);
      const body = response.json() as { error: string };
      assert.equal(body.error, "Invalid query");

      await app.close();
      await closeRedis();
    }
  );
});

test("admin moderation feed route denies non-admin roles", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  await withMockedQuery(
    async () => ({ rows: [] }),
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/admin/messages/moderation-feed?limit=25",
        headers,
      });
      assert.equal(response.statusCode, 403);
      const body = response.json() as { error: string };
      assert.equal(body.error, "Admin access required");

      await app.close();
      await closeRedis();
    }
  );
});
