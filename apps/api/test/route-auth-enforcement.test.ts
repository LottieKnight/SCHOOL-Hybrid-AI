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

test("profile core endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/profile/me" },
    { method: "PUT", url: "/profile/me", payload: { displayName: "Alice" } },
    { method: "POST", url: "/profile/achievements", payload: { type: "first_lesson" } },
    { method: "GET", url: "/profile/data-export" },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("messages conversation list endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/messages/conversations?limit=20" },
    { method: "POST", url: "/messages/conversations", payload: { participantIds: [TEST_UUID] } },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("tutor marketplace endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/tutors/me" },
    { method: "POST", url: "/tutors/onboard", payload: { subjects: ["mathematics"] } },
    { method: "POST", url: "/tutors/qualification-upload", payload: {} },
    { method: "GET", url: "/tutors/sessions" },
    { method: "POST", url: "/tutors/sessions", payload: { tutorId: TEST_UUID } },
    { method: "GET", url: "/tutors/payouts/summary" },
    { method: "GET", url: "/tutors/payouts/history?limit=20" },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("tutor session action endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "POST", url: `/tutors/sessions/${TEST_UUID}/status`, payload: { status: "accepted" } },
    { method: "POST", url: `/tutors/sessions/${TEST_UUID}/cancel`, payload: { reason: "conflict" } },
    { method: "POST", url: `/tutors/sessions/${TEST_UUID}/no-show`, payload: {} },
    { method: "POST", url: `/tutors/sessions/${TEST_UUID}/dispute`, payload: { reason: "no show" } },
    { method: "POST", url: `/tutors/sessions/${TEST_UUID}/rating`, payload: { rating: 5 } },
    { method: "POST", url: `/tutors/ratings/${TEST_UUID}/flag`, payload: { reason: "spam" } },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("admin lesson generation endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/admin/config" },
    { method: "POST", url: "/admin/lessons/v1/generate-week", payload: { gradeKey: "grade-08" } },
    { method: "GET", url: "/admin/lessons/v1/queue?limit=20" },
    {
      method: "POST",
      url: `/admin/lessons/v1/queue/job-123/transition`,
      payload: { transition: "complete" },
    },
    { method: "POST", url: "/admin/lessons/v1/generate-term", payload: { gradeKey: "grade-08", term: 1 } },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});

test("admin tutor management endpoints require auth", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const requests = [
    { method: "GET", url: "/admin/tutor-verifications?limit=20" },
    {
      method: "POST",
      url: `/admin/tutor-verifications/${TEST_UUID}/decision`,
      payload: { decision: "approved" },
    },
    { method: "GET", url: "/admin/tutor-disputes?limit=20" },
    {
      method: "POST",
      url: `/admin/tutor-disputes/${TEST_UUID}/resolve`,
      payload: { resolution: "refund" },
    },
  ] as const;

  for (const request of requests) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `${request.method} ${request.url} should require auth`);
  }

  await app.close();
  await closeRedis();
});
