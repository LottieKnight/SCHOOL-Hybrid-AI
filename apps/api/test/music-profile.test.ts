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

test("getMusicProfile queries by user_id", async () => {
  setTestEnv();
  let capturedQuery = "";
  let capturedValues: unknown[] = [];
  const { getMusicProfile } = await import("../src/db/music.js");

  await withMockedQuery(
    async (q, v) => {
      capturedQuery = q;
      capturedValues = v ?? [];
      return { rows: [] };
    },
    async () => {
      await getMusicProfile("00000000-0000-0000-0000-000000000001");
    }
  );

  assert.match(capturedQuery, /FROM student_music_profiles/i);
  assert.match(capturedQuery, /WHERE user_id = \$1/i);
  assert.deepEqual(capturedValues, ["00000000-0000-0000-0000-000000000001"]);
});

test("getMusicProfile returns null when no row found", async () => {
  setTestEnv();
  let queryWasCalled = false;
  const { getMusicProfile } = await import("../src/db/music.js");

  await withMockedQuery(
    async () => {
      queryWasCalled = true;
      return { rows: [] };
    },
    async () => {
      const result = await getMusicProfile("00000000-0000-0000-0000-000000000001");
      assert.equal(result, null);
    }
  );

  assert.ok(queryWasCalled, "getMusicProfile should call pool.query");
});

test("upsertMusicProfile uses ON CONFLICT upsert", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { upsertMusicProfile } = await import("../src/db/music.js");
  const fakeRecord = {
    user_id: "00000000-0000-0000-0000-000000000001",
    genres: ["Amapiano"],
    artists: ["Tyler ICU"],
    playlist_url: null,
    playlist_title: null,
    vibe_tags: ["Chilled"],
    visibility: "campus",
    updated_at: new Date().toISOString(),
  };

  let capturedValues: unknown[] = [];

  await withMockedQuery(
    async (q, v) => {
      capturedQuery = q;
      capturedValues = v ?? [];
      return { rows: [fakeRecord] };
    },
    async () => {
      await upsertMusicProfile("00000000-0000-0000-0000-000000000001", {
        genres: ["Amapiano"],
        artists: ["Tyler ICU"],
        playlist_url: null,
        playlist_title: null,
        vibe_tags: ["Chilled"],
        visibility: "campus",
      });
    }
  );

  assert.match(capturedQuery, /ON CONFLICT \(user_id\) DO UPDATE/i);
  assert.match(capturedQuery, /RETURNING/i);
  assert.equal(capturedValues.length, 7, "upsert should pass 7 parameters");
  assert.equal(capturedValues[0], "00000000-0000-0000-0000-000000000001");
});

test("discoverMusicProfiles similar uses array overlap operator", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { discoverMusicProfiles } = await import("../src/db/music.js");

  await withMockedQuery(
    async (q) => {
      capturedQuery = q;
      return { rows: [] };
    },
    async () => {
      await discoverMusicProfiles({
        userId: "00000000-0000-0000-0000-000000000001",
        schoolId: "school-1",
        userGenres: ["Amapiano"],
        match: "similar",
        limit: 12,
        offset: 0,
      });
    }
  );

  assert.match(capturedQuery, /smp\.genres && \$3/i);
  assert.match(capturedQuery, /overlap_count DESC/i);
  assert.doesNotMatch(capturedQuery, /ORDER BY random/i);
});

test("discoverMusicProfiles different uses NOT overlap and random order", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { discoverMusicProfiles } = await import("../src/db/music.js");

  await withMockedQuery(
    async (q) => {
      capturedQuery = q;
      return { rows: [] };
    },
    async () => {
      await discoverMusicProfiles({
        userId: "00000000-0000-0000-0000-000000000001",
        schoolId: null,
        userGenres: ["Amapiano"],
        match: "different",
        limit: 12,
        offset: 0,
      });
    }
  );

  assert.match(capturedQuery, /NOT \(smp\.genres && \$3/i);
  assert.match(capturedQuery, /ORDER BY random\(\)/i);
});

test("discoverMusicProfiles enforces visibility filter", async () => {
  setTestEnv();
  let capturedQuery = "";
  const { discoverMusicProfiles } = await import("../src/db/music.js");

  await withMockedQuery(
    async (q) => {
      capturedQuery = q;
      return { rows: [] };
    },
    async () => {
      await discoverMusicProfiles({
        userId: "00000000-0000-0000-0000-000000000001",
        schoolId: "school-1",
        userGenres: ["Jazz"],
        match: "similar",
        limit: 12,
        offset: 0,
      });
    }
  );

  assert.match(capturedQuery, /visibility = 'public'/i);
  assert.match(capturedQuery, /visibility = 'campus'/i);
  assert.match(capturedQuery, /up\.school_id = \$2/i);
});
