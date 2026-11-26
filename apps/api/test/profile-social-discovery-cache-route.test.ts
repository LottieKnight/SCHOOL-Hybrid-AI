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

test("follow suggestion route returns cache hit on repeated requests", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearSocialDiscoveryCache } = await import("../src/lib/social-discovery-cache.js");

  let suggestionQueryCount = 0;

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (text.includes("with self_profile as")) {
        suggestionQueryCount += 1;
        return {
          rows: [
            {
              user_id: "00000000-0000-0000-0000-000000000101",
              username: "alpha",
              name: "Alpha User",
              email: "alpha@example.com",
              relevance_score: 120,
              same_school: true,
              same_city: false,
              same_province: true,
              same_country: true,
              shared_likes: 2,
              shared_interests: 1,
              mutual_follows: 1,
              recent_interactions: 0,
              already_following: false,
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
        url: "/profile/following/suggestions?limit=8",
        headers,
      });
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["x-social-discovery-cache"], "miss");
      const firstBody = first.json() as {
        suggestions: Array<{ user_id: string }>;
      };
      assert.equal(firstBody.suggestions.length, 1);

      const second = await app.inject({
        method: "GET",
        url: "/profile/following/suggestions?limit=8",
        headers,
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["x-social-discovery-cache"], "hit");
      const secondBody = second.json() as {
        suggestions: Array<{ user_id: string }>;
      };
      assert.equal(secondBody.suggestions.length, 1);
      assert.equal(suggestionQueryCount, 1);

      await app.close();
      await closeRedis();
      clearSocialDiscoveryCache();
    }
  );
});

test("username search cache invalidates after relationship updates", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const { clearSocialDiscoveryCache } = await import("../src/lib/social-discovery-cache.js");

  let usernameSearchQueryCount = 0;

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("from users u") && text.includes("lower(up.username) like")) {
        usernameSearchQueryCount += 1;
        return {
          rows: [
            {
              user_id: "00000000-0000-0000-0000-000000000102",
              username: "alexander",
              name: "Alex User",
              email: "alex@example.com",
              already_following: false,
            },
          ],
        };
      }
      if (text.includes("from users where id = $1")) {
        const id = String(values?.[0] ?? "");
        return {
          rows: [
            {
              id,
              email: "target@example.com",
              password_hash: "",
              first_name: "Target",
              last_name: "User",
              phone: "",
              role: "learner",
              is_email_verified: true,
              is_phone_verified: false,
              verification_level: "basic",
              trial_started_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
              trial_ends_at: new Date("2026-02-01T00:00:00.000Z").toISOString(),
              plan_type: "trial",
              plan_status: "active",
              plan_expires_at: null,
              created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
    async () => {
      clearSocialDiscoveryCache();
      const app = await buildServer();
      const baseHeaders = buildAuthHeader(app, {
        userId: "00000000-0000-0000-0000-000000000001",
        role: "learner",
        email: "learner@example.com",
      });

      const first = await app.inject({
        method: "GET",
        url: "/profile/users/search?username=alex&limit=8",
        headers: baseHeaders,
      });
      assert.equal(first.statusCode, 200);
      assert.equal(first.headers["x-social-discovery-cache"], "miss");

      const second = await app.inject({
        method: "GET",
        url: "/profile/users/search?username=alex&limit=8",
        headers: baseHeaders,
      });
      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["x-social-discovery-cache"], "hit");
      assert.equal(usernameSearchQueryCount, 1);

      const mute = await app.inject({
        method: "POST",
        url: "/profile/users/mute",
        headers: buildWriteHeaders(baseHeaders),
        payload: {
          userId: "00000000-0000-0000-0000-000000000102",
        },
      });
      assert.equal(mute.statusCode, 200);

      const third = await app.inject({
        method: "GET",
        url: "/profile/users/search?username=alex&limit=8",
        headers: baseHeaders,
      });
      assert.equal(third.statusCode, 200);
      assert.equal(third.headers["x-social-discovery-cache"], "miss");
      assert.equal(usernameSearchQueryCount, 2);

      await app.close();
      await closeRedis();
      clearSocialDiscoveryCache();
    }
  );
});
