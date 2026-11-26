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

test("new messaging endpoints require auth", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/admin/messages/moderation-feed?limit=10" },
    { method: "GET", url: "/messages/following/search?q=ali" },
    { method: "GET", url: "/messages/interactions?limit=10" },
    { method: "GET", url: "/messages/weekly-snapshot?windowDays=7" },
    { method: "GET", url: "/messages/mentions?limit=10" },
    { method: "GET", url: "/messages/assignment-reminders?limit=10&unreadOnly=true" },
    { method: "POST", url: "/messages/assignment-reminders/read-all", payload: {} },
    { method: "POST", url: `/messages/assignment-reminders/${TEST_UUID}/read`, payload: {} },
    { method: "GET", url: "/messages/saved?limit=20" },
    { method: "POST", url: `/messages/conversations/direct/${TEST_UUID}`, payload: {} },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/state` },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/attachment-quota` },
    {
      method: "PUT",
      url: `/messages/conversations/${TEST_UUID}/attachment-quota`,
      payload: { maxBytes: 300000000, retentionDays: 30 },
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/upload-sessions`,
      payload: { fileName: "notes.pdf", mimeType: "application/pdf", totalBytes: 1024 },
    },
    {
      method: "GET",
      url: `/messages/conversations/${TEST_UUID}/upload-sessions/${TEST_UUID}`,
    },
    {
      method: "PUT",
      url: `/messages/conversations/${TEST_UUID}/upload-sessions/${TEST_UUID}/chunk`,
      payload: { chunkBase64: "AA==" },
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/upload-sessions/${TEST_UUID}/complete`,
      payload: {},
    },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/channel-tasks?limit=20` },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/channel-tasks`,
      payload: { title: "Draft assignment plan" },
    },
    {
      method: "PATCH",
      url: `/messages/conversations/${TEST_UUID}/channel-tasks/${TEST_UUID}`,
      payload: { status: "done" },
    },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/channel-assessments?limit=20` },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/channel-assessments`,
      payload: { title: "Mini quiz", questions: [] },
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/channel-assessments/${TEST_UUID}/attempts`,
      payload: { answers: {} },
    },
    {
      method: "GET",
      url: `/messages/conversations/${TEST_UUID}/messages/context?messageId=${TEST_UUID}&before=20&after=40`,
    },
    {
      method: "GET",
      url: `/messages/conversations/${TEST_UUID}/threads/${TEST_UUID}?limit=40`,
    },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/search?q=hello` },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/pins?limit=10` },
    { method: "GET", url: `/messages/conversations/${TEST_UUID}/activity?limit=20` },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/typing`,
      payload: { isTyping: true },
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/read`,
      payload: {},
    },
    {
      method: "PUT",
      url: `/messages/conversations/${TEST_UUID}/settings`,
      payload: { muteMinutes: 30 },
    },
    {
      method: "POST",
      url: `/messages/messages/${TEST_UUID}/report`,
      payload: { reason: "Unsafe content" },
    },
    {
      method: "POST",
      url: `/messages/users/${TEST_UUID}/report`,
      payload: { reason: "Abusive behavior", conversationId: TEST_UUID },
    },
    {
      method: "PUT",
      url: `/messages/messages/${TEST_UUID}/pin`,
      payload: {},
    },
    {
      method: "PUT",
      url: `/messages/messages/${TEST_UUID}/edit`,
      payload: { body: "Edited message" },
    },
    {
      method: "DELETE",
      url: `/messages/messages/${TEST_UUID}`,
    },
    {
      method: "POST",
      url: `/messages/messages/${TEST_UUID}/reactions`,
      payload: { emoji: "👍" },
    },
    {
      method: "POST",
      url: `/messages/messages/${TEST_UUID}/saved`,
      payload: {},
    },
    {
      method: "POST",
      url: `/messages/messages/${TEST_UUID}/forward`,
      payload: { targetConversationId: TEST_UUID },
    },
    {
      method: "DELETE",
      url: `/messages/messages/${TEST_UUID}/pin`,
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/messages/attachments`,
      payload: {},
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/participants`,
      payload: { userId: TEST_UUID },
    },
    {
      method: "DELETE",
      url: `/messages/conversations/${TEST_UUID}/participants/${TEST_UUID}`,
    },
    {
      method: "POST",
      url: `/messages/conversations/${TEST_UUID}/leave`,
      payload: {},
    },
    {
      method: "PUT",
      url: `/messages/conversations/${TEST_UUID}/participants/${TEST_UUID}/role`,
      payload: { role: "viewer" },
    },
    {
      method: "GET",
      url: `/messages/attachments/${TEST_UUID}`,
    },
    {
      method: "PUT",
      url: `/messages/conversations/${TEST_UUID}/archive`,
      payload: { archived: true },
    },
    {
      method: "PATCH",
      url: `/messages/conversations/${TEST_UUID}/channel`,
      payload: { assignmentTitle: "Updated assignment title" },
    },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("new adaptive analytics and session security endpoints require auth", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/analytics/dashboard-summary" },
    { method: "GET", url: "/analytics/recommendations?limit=3" },
    { method: "GET", url: "/analytics/baseline" },
    {
      method: "PUT",
      url: "/analytics/baseline",
      payload: { scorePercent: 64, confidence: "medium" },
    },
    { method: "GET", url: "/analytics/mastery-heatmap?limit=10" },
    { method: "GET", url: "/analytics/adaptive-path?limit=8" },
    { method: "GET", url: "/analytics/guardian-links" },
    {
      method: "POST",
      url: "/analytics/guardian-links",
      payload: { learnerId: TEST_UUID, relation: "guardian" },
    },
    { method: "GET", url: "/analytics/guardian-summary?limit=5" },
    { method: "GET", url: "/analytics/lesson-checkpoints?lessonKey=grade-08-science-term-01-week-01" },
    {
      method: "POST",
      url: "/analytics/lesson-checkpoints",
      payload: {
        lessonKey: "grade-08-science-term-01-week-01",
        sectionKey: "explanation",
        completed: true,
      },
    },
    { method: "GET", url: "/analytics/spaced-reviews?dueOnly=true&limit=5" },
    { method: "POST", url: `/analytics/spaced-reviews/${TEST_UUID}/done`, payload: {} },
    { method: "POST", url: `/analytics/spaced-reviews/${TEST_UUID}/dismiss`, payload: {} },
    { method: "GET", url: "/auth/sessions" },
    { method: "GET", url: "/auth/security-alerts?limit=20" },
    { method: "POST", url: "/auth/security-alerts/read-all", payload: {} },
    { method: "POST", url: "/auth/sessions/revoke-all", payload: {} },
    { method: "GET", url: "/admin/observability/summary" },
    { method: "GET", url: "/admin/feature-flags" },
    {
      method: "PUT",
      url: "/admin/feature-flags/instant-messaging-v2",
      payload: { enabled: true },
    },
    { method: "GET", url: "/admin/feature-flags/instant-messaging-v2/audits?limit=20" },
    {
      method: "POST",
      url: "/admin/feature-flags/instant-messaging-v2/evaluate",
      payload: { userId: TEST_UUID, role: "learner" },
    },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("new profile social discovery endpoints require auth", async () => {
  setTestEnv();

  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/profile/following/suggestions?limit=8" },
    { method: "POST", url: "/profile/following", payload: { userId: TEST_UUID } },
    { method: "GET", url: "/profile/users/search?username=alex&limit=8" },
    { method: "POST", url: "/profile/users/block", payload: { userId: TEST_UUID } },
    { method: "POST", url: "/profile/users/mute", payload: { userId: TEST_UUID } },
    { method: "DELETE", url: `/profile/users/block/${TEST_UUID}` },
    { method: "DELETE", url: `/profile/users/mute/${TEST_UUID}` },
    { method: "GET", url: "/profile/users/relationships?limit=10" },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});
