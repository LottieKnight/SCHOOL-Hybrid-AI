import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTargetMarginRate, recommendPodRetailPrice } from "../src/lib/bookstore-pod-pricing.js";

test("POD pricing defaults expose target margins by product type", () => {
  assert.equal(defaultTargetMarginRate("workbook"), 0.4);
  assert.equal(defaultTargetMarginRate("textbook"), 0.3);
  assert.equal(defaultTargetMarginRate("color"), 0.25);
});

test("POD pricing recommendation returns rounded retail price with VAT", () => {
  const result = recommendPodRetailPrice({
    printCostCents: 12000,
    shippingCostCents: 4500,
    fixedFeesCents: 1500,
    paymentFeeRate: 0.03,
    riskBufferRate: 0.02,
    targetMarginRate: 0.3,
    vatRate: 0.15,
    vatInclusive: true,
    roundingStepCents: 100,
  });

  assert.ok(result.denominator > 0);
  assert.ok(result.roundedRecommendedCentsIncVat >= result.recommendedRetailCentsIncVat);
  assert.equal(result.roundedRecommendedCentsIncVat % 100, 0);
});
