import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret";
process.env.COOKIE_SECRET = "test_cookie";
process.env.CORS_ORIGIN = "http://localhost:3000";
process.env.PAYFAST_MERCHANT_ID = "10000100";
process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
process.env.PAYFAST_SANDBOX = "true";

const { buildPayFastSignature, createPayFastBookstoreCheckoutUrl } = await import(
  "../src/lib/payfast.js"
);

test("buildPayFastSignature produces the PayFast MD5 signature over url-encoded values", () => {
  const params = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    amount: "99.99",
    item_name: "Test Item",
  };

  const signature = buildPayFastSignature(params);

  const expectedNoPass = createHash("md5")
    .update("merchant_id=10000100&merchant_key=46f0cd694581a&amount=99.99&item_name=Test+Item")
    .digest("hex");
  const expectedWithPass = createHash("md5")
    .update(
      "merchant_id=10000100&merchant_key=46f0cd694581a&amount=99.99&item_name=Test+Item&passphrase=test"
    )
    .digest("hex");

  assert.equal(signature.length, 32);
  assert.ok(signature === expectedNoPass || signature === expectedWithPass);
});

test("createPayFastBookstoreCheckoutUrl builds a sandbox checkout URL with required fields", () => {
  const orderId = "e417718f-97c1-483f-bd6f-800e133605db";
  const url = createPayFastBookstoreCheckoutUrl({
    orderId,
    userId: "user-1",
    amountZar: 1249,
    itemNames: ["Becoming El Matador"],
    returnUrl: "https://example.com/checkout?provider=payfast&orderId=" + orderId,
    cancelUrl:
      "https://example.com/checkout?provider=payfast&orderId=" + orderId + "&canceled=1",
    notifyUrl: "https://example.com/api/bookstore/webhooks/payfast",
  });

  assert.ok(url.includes("payfast.co.za/eng/process?"));
  assert.ok(url.includes("m_payment_id=" + orderId));
  assert.ok(url.includes("amount=1249.00"));
  assert.ok(url.includes("item_name=Becoming+El+Matador"));
  assert.ok(url.includes("custom_str1=user-1"));
  assert.ok(url.includes("signature="));

  const qs = url.split("?")[1];
  const parsed = new URLSearchParams(qs);
  assert.ok(parsed.get("signature"));
  assert.equal(parsed.get("m_payment_id"), orderId);
  assert.equal(parsed.get("amount"), "1249.00");
});

test("createPayFastBookstoreCheckoutUrl uses a short order reference for multiple items", () => {
  const orderId = "e417718f-97c1-483f-bd6f-800e133605db";
  const url = createPayFastBookstoreCheckoutUrl({
    orderId,
    userId: "user-1",
    amountZar: 100,
    itemNames: ["Becoming El Matador", "Study Pack"],
    returnUrl: "https://example.com/checkout",
    cancelUrl: "https://example.com/checkout?canceled=1",
    notifyUrl: "https://example.com/api/bookstore/webhooks/payfast",
  });

  const qs = new URLSearchParams(url.split("?")[1]);
  assert.equal(qs.get("item_name"), "Bookstore order e417718f");
  assert.equal(qs.get("item_description"), "2 items");
});
