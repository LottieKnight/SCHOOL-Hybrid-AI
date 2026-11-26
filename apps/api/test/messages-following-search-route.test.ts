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

test("following search route supports cursor pagination", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  const allRows = [
    {
      user_id: "00000000-0000-0000-0000-000000000201",
      email: "alpha@example.com",
      name: "Alpha User",
      username: "alpha",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000202",
      email: "albert@example.com",
      name: "Albert User",
      username: "albert",
    },
    {
      user_id: "00000000-0000-0000-0000-000000000203",
      email: "alex@example.com",
      name: "Alex User",
      username: "alex",
    },
  ];

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("from friends f")) {
        const search = String(values?.[2] ?? "").toLowerCase();
        const limit = Number(values?.[3] ?? 0);
        const offset = Number(values?.[4] ?? 0);
        const filtered = search.includes("al")
          ? allRows
          : allRows.filter((row) => row.name.toLowerCase().includes(search.replace(/%/g, "")));
        return {
          rows: filtered.slice(offset, offset + limit),
        };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });

      const first = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=2",
        headers,
      });
      assert.equal(first.statusCode, 200);
      const firstBody = first.json() as {
        users: Array<{ user_id: string }>;
        hasMore: boolean;
        nextCursor: string | null;
      };
      assert.equal(firstBody.users.length, 2);
      assert.equal(firstBody.hasMore, true);
      assert.equal(typeof firstBody.nextCursor, "string");
      assert.deepEqual(
        firstBody.users.map((item) => item.user_id),
        [
          "00000000-0000-0000-0000-000000000201",
          "00000000-0000-0000-0000-000000000202",
        ]
      );

      const second = await app.inject({
        method: "GET",
        url: `/messages/following/search?q=al&limit=2&cursor=${encodeURIComponent(
          firstBody.nextCursor || ""
        )}`,
        headers,
      });
      assert.equal(second.statusCode, 200);
      const secondBody = second.json() as {
        users: Array<{ user_id: string }>;
        hasMore: boolean;
        nextCursor: string | null;
      };
      assert.equal(secondBody.users.length, 1);
      assert.equal(secondBody.hasMore, false);
      assert.equal(secondBody.nextCursor, null);
      assert.deepEqual(secondBody.users.map((item) => item.user_id), [
        "00000000-0000-0000-0000-000000000203",
      ]);

      await app.close();
      await closeRedis();
    }
  );
});

test("following search route rejects malformed cursor", async () => {
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
        url: "/messages/following/search?q=al&limit=10&cursor=not-base64url",
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

test("following search route returns cache hits for repeated requests", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearSocialDiscoveryCache } = await import("../src/lib/social-discovery-cache.js");

  let queryCount = 0;

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (text.includes("from friends f")) {
        queryCount += 1;
        return {
          rows: [
            {
              user_id: "00000000-0000-0000-0000-000000000201",
              email: "alpha@example.com",
              name: "Alpha User",
              username: "alpha",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      clearSocialDiscoveryCache();
      const app = await buildServer();
      const headers = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });

      const first = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=12",
        headers,
      });
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["x-social-discovery-cache"], "miss");

      const second = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=12",
        headers,
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["x-social-discovery-cache"], "hit");
      assert.equal(queryCount, 1);

      await app.close();
      await closeRedis();
      clearSocialDiscoveryCache();
    }
  );
});

test("following search passes authenticated role into ranking query", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  let seenRole = "";

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("from friends f")) {
        seenRole = String(values?.[5] ?? "");
        return {
          rows: [
            {
              user_id: "00000000-0000-0000-0000-000000000201",
              email: "alpha@example.com",
              name: "Alpha User",
              username: "alpha",
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
        role: "tutor",
        email: "tutor@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=12",
        headers,
      });
      assert.equal(response.statusCode, 200);
      assert.equal(seenRole, "tutor");

      await app.close();
      await closeRedis();
    }
  );
});

test("following search cache key is role-aware", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearSocialDiscoveryCache } = await import("../src/lib/social-discovery-cache.js");

  let queryCount = 0;

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (text.includes("from friends f")) {
        queryCount += 1;
        return {
          rows: [
            {
              user_id: "00000000-0000-0000-0000-000000000201",
              email: "alpha@example.com",
              name: "Alpha User",
              username: "alpha",
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      clearSocialDiscoveryCache();
      const app = await buildServer();
      const learnerHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });
      const tutorHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "tutor",
        email: "tutor@example.com",
      });

      const first = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=12",
        headers: learnerHeaders,
      });
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["x-social-discovery-cache"], "miss");

      const second = await app.inject({
        method: "GET",
        url: "/messages/following/search?q=al&limit=12",
        headers: tutorHeaders,
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["x-social-discovery-cache"], "miss");
      assert.equal(queryCount, 2);

      await app.close();
      await closeRedis();
      clearSocialDiscoveryCache();
    }
  );
});
