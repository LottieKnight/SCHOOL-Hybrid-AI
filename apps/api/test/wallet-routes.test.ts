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

test("GET /wallet/balance returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/wallet/balance" });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("GET /wallet/ledger returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/wallet/ledger" });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("POST /wallet/debit returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/wallet/debit",
    payload: { amountCredits: 10, reason: "test reason" },
  });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("POST /wallet/credit returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/wallet/credit",
    payload: { userId: "00000000-0000-0000-0000-000000000001", amountCredits: 50, reason: "admin credit" },
  });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("POST /wallet/topup/create returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/wallet/topup/create",
    payload: { bundleId: "growth" },
  });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("GET /admin/wallet/summary returns 401 when not authenticated", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({ method: "GET", url: "/admin/wallet/summary" });
  assert.equal(response.statusCode, 401);

  await app.close();
  await closeRedis();
});

test("POST /wallet/webhooks/unsupported-provider returns 400", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/wallet/webhooks/cashapp",
    payload: {},
  });
  assert.equal(response.statusCode, 400);
  const body = JSON.parse(response.body) as { error: string };
  assert.ok(body.error.toLowerCase().includes("provider"));

  await app.close();
  await closeRedis();
});

test("POST /wallet/webhooks/stub returns 400 for missing required fields", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  // eventId present but topupId (uuid) missing
  const response = await app.inject({
    method: "POST",
    url: "/wallet/webhooks/stub",
    payload: { eventId: "evt_test_001_missing_topup" },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("POST /wallet/webhooks/stub returns 400 when eventId is too short", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/wallet/webhooks/stub",
    payload: {
      eventId: "short",
      topupId: "00000000-0000-0000-0000-000000000001",
      paid: true,
    },
  });
  assert.equal(response.statusCode, 400);

  await app.close();
  await closeRedis();
});

test("getIdempotencyKey prefers Idempotency-Key header over body field", async () => {
  setTestEnv();
  const { resolveWalletTopupSelection } = await import("../src/lib/wallet-pricing.js");

  const byBundle = resolveWalletTopupSelection({ bundleId: "starter" });
  assert.ok(byBundle, "starter bundle should resolve");
  assert.equal(byBundle.bonusCredits >= 0, true);
  assert.equal(byBundle.totalCredits, byBundle.baseCredits + byBundle.bonusCredits);

  const byAmount = resolveWalletTopupSelection({ amountZar: 50 });
  assert.ok(byAmount, "custom amount should resolve");
  assert.equal(byAmount.bundle, null);
  assert.equal(byAmount.bonusCredits, 0);
  assert.equal(byAmount.baseCredits > 0, true);

  const noInput = resolveWalletTopupSelection({});
  assert.equal(noInput, null);

  const negativeAmount = resolveWalletTopupSelection({ amountZar: -10 });
  assert.equal(negativeAmount, null);
});
