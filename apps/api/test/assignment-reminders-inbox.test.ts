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

test("storeAssignmentReminderNotifications uses batch upsert-safe insert", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { storeAssignmentReminderNotifications } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return { rows: [] };
    },
    async () => {
      await storeAssignmentReminderNotifications([
        {
          conversation_id: "00000000-0000-0000-0000-000000000011",
          conversation_name: "Grade 12 Physics",
          user_id: "00000000-0000-0000-0000-000000000099",
          assignment_title: "Momentum worksheet",
          assignment_due_at: "2026-02-22T10:00:00.000Z",
          reminder_kind: "24h",
          sent_at: "2026-02-21T10:00:00.000Z",
        },
      ]);
    }
  );

  assert.match(capturedQuery, /jsonb_to_recordset/i);
  assert.match(capturedQuery, /INSERT INTO assignment_reminder_notifications/i);
  assert.match(
    capturedQuery,
    /ON CONFLICT \(user_id, conversation_id, reminder_kind, assignment_due_at\)\s+DO UPDATE/i
  );
  assert.match(capturedQuery, /WHERE EXCLUDED\.reminder_kind = 'overdue'/i);
  assert.equal(typeof capturedValues?.[0], "string");
});

test("listAssignmentReminderNotifications enforces unread filter and membership join", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { listAssignmentReminderNotifications } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            id: "00000000-0000-0000-0000-000000000201",
            conversation_id: "00000000-0000-0000-0000-000000000011",
            conversation_name: "Grade 12 Physics",
            reminder_kind: "24h",
            assignment_title: "Momentum worksheet",
            assignment_due_at: "2026-02-22T10:00:00.000Z",
            source_sent_at: "2026-02-21T10:00:00.000Z",
            created_at: "2026-02-21T10:00:00.000Z",
            read_at: null,
            unread: true,
          },
        ],
      };
    },
    async () => {
      const rows = await listAssignmentReminderNotifications(
        "00000000-0000-0000-0000-000000000099",
        { unreadOnly: true, limit: 25 }
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.unread, true);
      assert.equal(rows[0]?.reminder_kind, "24h");
    }
  );

  assert.match(capturedQuery, /JOIN conversation_participants cp/i);
  assert.match(capturedQuery, /\(\$2::boolean = false OR arn.read_at IS NULL\)/i);
  assert.equal(capturedValues?.[0], "00000000-0000-0000-0000-000000000099");
  assert.equal(capturedValues?.[1], true);
  assert.equal(capturedValues?.[2], 25);
});
