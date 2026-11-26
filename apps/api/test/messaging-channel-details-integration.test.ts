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

const TEST_UUID = "00000000-0000-0000-0000-000000000001";

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

test("channel details update query constrains to channels and supports partial fields", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { updateChannelConversationDetails } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            id: TEST_UUID,
            name: "Physics channel",
            type: "channel",
            created_at: "2026-02-21T00:00:00.000Z",
            archived_at: null,
            archived_by: null,
            assignment_title: "Momentum practical",
            assignment_description: null,
            assignment_due_at: "2026-03-01T10:00:00.000Z",
            assignment_template: { templateId: "presentation" },
          },
        ],
      };
    },
    async () => {
      const conversation = await updateChannelConversationDetails(TEST_UUID, {
        name: "Physics channel",
        assignmentTitle: "Momentum practical",
        assignmentDescription: null,
        assignmentDueAt: "2026-03-01T10:00:00.000Z",
        assignmentTemplate: { templateId: "presentation" },
      });
      assert.equal(conversation?.type, "channel");
      assert.equal(conversation?.name, "Physics channel");
      assert.equal(conversation?.assignment_title, "Momentum practical");
    }
  );

  assert.match(capturedQuery, /WHERE id = \$1/i);
  assert.match(capturedQuery, /AND type = 'channel'/i);
  assert.match(capturedQuery, /name = CASE WHEN/i);
  assert.match(capturedQuery, /assignment_template = CASE WHEN/i);
  assert.equal(capturedValues?.[1], true);
  assert.equal(capturedValues?.[3], true);
  assert.equal(capturedValues?.[5], true);
  assert.equal(capturedValues?.[7], true);
  assert.equal(capturedValues?.[9], true);
  assert.equal(typeof capturedValues?.[10], "string");
});

test("message activity event insert accepts channel detail updates", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { createMessageActivityEvent } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            id: TEST_UUID,
            conversation_id: TEST_UUID,
            actor_id: TEST_UUID,
            actor_name: null,
            event_type: "channel_details_updated",
            message_id: null,
            message_body: null,
            metadata: {},
            created_at: "2026-02-21T00:00:00.000Z",
          },
        ],
      };
    },
    async () => {
      const event = await createMessageActivityEvent({
        conversationId: TEST_UUID,
        actorId: TEST_UUID,
        eventType: "channel_details_updated",
      });
      assert.equal(event?.event_type, "channel_details_updated");
    }
  );

  assert.match(capturedQuery, /INSERT INTO message_activity_events/i);
  assert.equal(capturedValues?.[2], "channel_details_updated");
});

test("message activity event insert accepts channel reminder settings updates", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { createMessageActivityEvent } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            id: TEST_UUID,
            conversation_id: TEST_UUID,
            actor_id: TEST_UUID,
            actor_name: null,
            event_type: "channel_reminder_settings_updated",
            message_id: null,
            message_body: null,
            metadata: {},
            created_at: "2026-02-21T00:00:00.000Z",
          },
        ],
      };
    },
    async () => {
      const event = await createMessageActivityEvent({
        conversationId: TEST_UUID,
        actorId: TEST_UUID,
        eventType: "channel_reminder_settings_updated",
      });
      assert.equal(event?.event_type, "channel_reminder_settings_updated");
    }
  );

  assert.match(capturedQuery, /INSERT INTO message_activity_events/i);
  assert.equal(capturedValues?.[2], "channel_reminder_settings_updated");
});

test("message activity event insert accepts channel notification settings updates", async () => {
  setTestEnv();

  let capturedQuery = "";
  let capturedValues: unknown[] | undefined;
  const { createMessageActivityEvent } = await import("../src/db/messages.js");

  await withMockedQuery(
    async (queryText, values) => {
      capturedQuery = queryText;
      capturedValues = values;
      return {
        rows: [
          {
            id: TEST_UUID,
            conversation_id: TEST_UUID,
            actor_id: TEST_UUID,
            actor_name: null,
            event_type: "channel_notification_settings_updated",
            message_id: null,
            message_body: null,
            metadata: {},
            created_at: "2026-02-21T00:00:00.000Z",
          },
        ],
      };
    },
    async () => {
      const event = await createMessageActivityEvent({
        conversationId: TEST_UUID,
        actorId: TEST_UUID,
        eventType: "channel_notification_settings_updated",
      });
      assert.equal(event?.event_type, "channel_notification_settings_updated");
    }
  );

  assert.match(capturedQuery, /INSERT INTO message_activity_events/i);
  assert.equal(capturedValues?.[2], "channel_notification_settings_updated");
});
