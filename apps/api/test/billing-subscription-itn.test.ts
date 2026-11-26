import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret";
process.env.COOKIE_SECRET = "test_cookie";
process.env.CORS_ORIGIN = "http://localhost:3000";

const { subscriptionAmountZar } = await import("../src/routes/billing.js");
const { getPlan, PLANS } = await import("../src/services/pricing.js");

test("subscriptionAmountZar matches the published monthly tier prices", () => {
  assert.equal(subscriptionAmountZar("scholar", "monthly"), 29);
  assert.equal(subscriptionAmountZar("family", "monthly"), 59);
  assert.equal(subscriptionAmountZar("school", "monthly"), 199);
});

test("annual cadence is 10x monthly (two months free) and agrees with PLANS", () => {
  for (const tier of ["scholar", "family", "school"] as const) {
    assert.equal(subscriptionAmountZar(tier, "annual"), Math.round(getPlan(tier).priceZAR * 10));
  }
});

test("free and sponsored tiers can never produce a chargeable amount", () => {
  assert.equal(subscriptionAmountZar("free", "monthly"), 0);
  assert.equal(subscriptionAmountZar("bursary", "annual"), 0);
  assert.equal(PLANS.free.priceZAR, 0);
  assert.equal(PLANS.bursary.priceZAR, 0);
});

// The ITN validator recomputes the expected amount from the tier and rejects any
// mismatch, so a tampered or mis-built checkout cannot grant a cheaper plan.
test("annual amount is never equal to the monthly amount for a paid tier", () => {
  for (const tier of ["scholar", "family", "school"] as const) {
    assert.notEqual(subscriptionAmountZar(tier, "annual"), subscriptionAmountZar(tier, "monthly"));
  }
});
