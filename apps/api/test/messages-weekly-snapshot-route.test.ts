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

test("weekly snapshot route returns aggregate metrics and unread counters", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  let seenWindowDays = 0;

  await withMockedQuery(
    async (queryText, values) => {
      const text = queryText.toLowerCase();
      if (text.includes("with bounds as") && text.includes("user_conversation_messages")) {
        seenWindowDays = Number(values?.[1] ?? 0);
        return {
          rows: [
            {
              window_days: 7,
              window_start: "2026-02-14T00:00:00.000Z",
              window_end: "2026-02-21T00:00:00.000Z",
              sent_messages: 22,
              received_messages: 17,
              active_conversations: 6,
              active_direct_conversations: 3,
              active_group_conversations: 2,
              active_channel_conversations: 1,
              collaborator_count: 5,
              due_soon_channels: 2,
              overdue_channels: 1,
            },
          ],
        };
      }
      if (text.includes("from message_mentions mm")) {
        return { rows: [{ total: 4 }] };
      }
      if (text.includes("from assignment_reminder_notifications arn")) {
        return { rows: [{ total: 3 }] };
      }
      if (text.includes("coalesce(unread.unread_count, 0)::int as unread_count")) {
        return {
          rows: [
            { id: "c1", unread_count: 0 },
            { id: "c2", unread_count: 2 },
            { id: "c3", unread_count: 1 },
          ],
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

      const response = await app.inject({
        method: "GET",
        url: "/messages/weekly-snapshot?windowDays=7",
        headers,
      });
      assert.equal(response.statusCode, 200);
      assert.equal(seenWindowDays, 7);

      const body = response.json() as {
        snapshot: {
          windowDays: number;
          sentMessages: number;
          receivedMessages: number;
          activeConversations: number;
          activeDirectConversations: number;
          activeGroupConversations: number;
          activeChannelConversations: number;
          collaboratorCount: number;
          dueSoonChannels: number;
          overdueChannels: number;
          unreadMentions: number;
          unreadAssignmentReminders: number;
          unreadConversations: number;
        };
      };
      assert.equal(body.snapshot.windowDays, 7);
      assert.equal(body.snapshot.sentMessages, 22);
      assert.equal(body.snapshot.receivedMessages, 17);
      assert.equal(body.snapshot.activeConversations, 6);
      assert.equal(body.snapshot.activeDirectConversations, 3);
      assert.equal(body.snapshot.activeGroupConversations, 2);
      assert.equal(body.snapshot.activeChannelConversations, 1);
      assert.equal(body.snapshot.collaboratorCount, 5);
      assert.equal(body.snapshot.dueSoonChannels, 2);
      assert.equal(body.snapshot.overdueChannels, 1);
      assert.equal(body.snapshot.unreadMentions, 4);
      assert.equal(body.snapshot.unreadAssignmentReminders, 3);
      assert.equal(body.snapshot.unreadConversations, 2);

      await app.close();
      await closeRedis();
    }
  );
});

test("weekly snapshot route validates query bounds", async () => {
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
        url: "/messages/weekly-snapshot?windowDays=0",
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

