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

test("wallet pricing exposes starter/growth/mastery bundles with bonuses on higher tiers", async () => {
  setTestEnv();

  const { walletPricing } = await import("../src/lib/wallet-pricing.js");

  const bundleIds = walletPricing.bundles.map((bundle) => bundle.id);
  assert.deepEqual(bundleIds, ["starter", "growth", "mastery"]);

  const starter = walletPricing.bundles.find((bundle) => bundle.id === "starter");
  const growth = walletPricing.bundles.find((bundle) => bundle.id === "growth");
  const mastery = walletPricing.bundles.find((bundle) => bundle.id === "mastery");
  assert.ok(starter);
  assert.ok(growth);
  assert.ok(mastery);

  assert.equal(starter.bonusCredits, 0);
  assert.equal(growth.bonusCredits > 0, true);
  assert.equal(mastery.bonusCredits > 0, true);
});

test("bundle selection resolves total credits with bonus while plain amount keeps zero bonus", async () => {
  setTestEnv();

  const { resolveWalletTopupSelection } = await import("../src/lib/wallet-pricing.js");

  const bundleSelection = resolveWalletTopupSelection({
    bundleId: "mastery",
    amountZar: 10,
  });
  assert.ok(bundleSelection);
  assert.equal(bundleSelection.bundle?.id, "mastery");
  assert.equal(bundleSelection.bonusCredits > 0, true);
  assert.equal(bundleSelection.totalCredits, bundleSelection.baseCredits + bundleSelection.bonusCredits);

  const plainSelection = resolveWalletTopupSelection({
    amountZar: 12.5,
  });
  assert.ok(plainSelection);
  assert.equal(plainSelection.bundle, null);
  assert.equal(plainSelection.bonusCredits, 0);
  assert.equal(plainSelection.totalCredits, plainSelection.baseCredits);
});
