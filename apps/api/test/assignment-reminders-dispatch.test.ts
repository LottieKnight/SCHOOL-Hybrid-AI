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

test("claimDueAssignmentReminders inserts deduped deliveries and returns dispatch rows", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { claimDueAssignmentReminders } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            conversation_id: "00000000-0000-0000-0000-000000000011",
            conversation_name: "Grade 12 Physics",
            user_id: "00000000-0000-0000-0000-000000000099",
            assignment_title: "Momentum worksheet",
            assignment_due_at: "2026-02-22T10:00:00.000Z",
            reminder_kind: "24h",
            sent_at: "2026-02-21T10:00:00.000Z",
          },
        ],
      };
    },
    async () => {
      const nowIso = "2026-02-21T10:00:00.000Z";
      const rows = await claimDueAssignmentReminders({ nowIso, limit: 42 });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.reminder_kind, "24h");
      assert.equal(rows[0]?.conversation_name, "Grade 12 Physics");
      assert.equal(rows[0]?.assignment_due_at, "2026-02-22T10:00:00.000Z");
    }
  );

  assert.match(capturedQuery, /INSERT INTO assignment_reminder_deliveries/i);
  assert.match(
    capturedQuery,
    /ON CONFLICT \(conversation_id, user_id, reminder_kind, assignment_due_at\)\s+DO UPDATE/i
  );
  assert.match(capturedQuery, /overdue_repeat_hours_snapshot/i);
  assert.match(capturedQuery, /'overdue'::text AS reminder_kind/i);
  assert.equal(capturedValues?.[0], "2026-02-21T10:00:00.000Z");
  assert.equal(capturedValues?.[1], 42);
});
