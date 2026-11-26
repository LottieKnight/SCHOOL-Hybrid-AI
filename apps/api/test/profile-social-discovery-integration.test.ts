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

test("follow suggestion query keeps ranking and privacy filters", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { listFollowSuggestions } = await import("../src/db/profile.js");

  await withMockedQuery(
    async (queryText) => {
      capturedQuery = queryText;
      return { rows: [] };
    },
    async () => {
      await listFollowSuggestions("00000000-0000-0000-0000-000000000001", { limit: 8, offset: 0 });
    }
  );

  assert.match(capturedQuery, /ORDER BY relevance_score DESC/i);
  assert.match(capturedQuery, /mutual_follows/i);
  assert.match(capturedQuery, /recent_interactions/i);
  assert.match(capturedQuery, /discoverableInSuggestions/i);
  assert.match(capturedQuery, /relationship_type = 'blocked'/i);
  assert.match(capturedQuery, /relationship_type = 'muted'/i);
});

test("follow operation stays idempotent", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { followUser } = await import("../src/db/profile.js");

  await withMockedQuery(
    async (queryText) => {
      capturedQuery = queryText;
      return { rows: [] };
    },
    async () => {
      await followUser(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002"
      );
    }
  );

  assert.match(capturedQuery, /ON CONFLICT DO NOTHING/i);
});

test("username search query enforces privacy and block filters", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { searchUsersByUsername } = await import("../src/db/profile.js");

  await withMockedQuery(
    async (queryText) => {
      capturedQuery = queryText;
      return { rows: [] };
    },
    async () => {
      await searchUsersByUsername("00000000-0000-0000-0000-000000000001", "alex", {
        limit: 8,
        offset: 0,
      });
    }
  );

  assert.match(capturedQuery, /discoverableInSuggestions/i);
  assert.match(capturedQuery, /relationship_type = 'blocked'/i);
  assert.match(capturedQuery, /relationship_type = 'muted'/i);
});

test("onboarding transition events are emitted only on state changes", async () => {
  setTestEnv();
  const { resolveOnboardingTransitionEvent } = await import("../src/lib/profile-preferences.js");

  const previous = { profileSettings: { preferenceOnboardingStatus: "pending" } };
  assert.equal(
    resolveOnboardingTransitionEvent(previous, {
      profileSettings: { preferenceOnboardingStatus: "completed" },
    }),
    "onboarding_completed"
  );
  assert.equal(
    resolveOnboardingTransitionEvent(previous, {
      profileSettings: { preferenceOnboardingStatus: "declined" },
    }),
    "onboarding_declined"
  );
  assert.equal(
    resolveOnboardingTransitionEvent(previous, {
      profileSettings: { preferenceOnboardingStatus: "pending" },
    }),
    null
  );
});
