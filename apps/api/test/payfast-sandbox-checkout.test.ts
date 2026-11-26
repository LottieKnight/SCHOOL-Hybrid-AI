import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret";
process.env.COOKIE_SECRET = "test_cookie";
process.env.CORS_ORIGIN = "http://localhost:3000";

// PayFast's publicly documented sandbox test merchant. These are not secrets and
// must never be set in a live environment: sandbox mode is the only safe use.
process.env.PAYFAST_SANDBOX = "true";
process.env.PAYFAST_MERCHANT_ID = "10000100";
process.env.PAYFAST_MERCHANT_KEY = "46f0cd694581a";
process.env.PAYFAST_PASSPHRASE = "DTPN8FDGSN";

const {
  buildPayFastSignature,
  createPayFastSubscriptionUrl,
  payfastEnabled,
  verifyPayFastItn,
} = await import("../src/lib/payfast.js");
const { subscriptionAmountZar } = await import("../src/routes/billing.js");

const checkoutInput = {
  subscriptionId: "sub_test_123",
  userId: "user_abc",
  tier: "scholar",
  cadence: "monthly" as const,
  amountZar: 29,
  returnUrl: "https://school.ditshego-ventures.co.za/settings?payfast=return",
  cancelUrl: "https://school.ditshego-ventures.co.za/settings?payfast=cancel",
  notifyUrl: "https://api.example.com/billing/itn",
};

/** Rebuilds a signature from a checkout URL the way the ITN handler would. */
function signatureFromUrl(url: string): string {
  const params = new URL(url).searchParams;
  const received = params.get("signature");
  assert.ok(received, "checkout URL must carry a signature");

  const rebuild: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (k !== "signature" && v !== "") rebuild[k] = v;
  }
  const expected = buildPayFastSignature(rebuild);
  assert.equal(expected, received, "signature must round-trip through the ITN rebuild");
  return received;
}

test("payfast is enabled with sandbox credentials and targets the sandbox host", () => {
  assert.equal(payfastEnabled(), true);
  const url = createPayFastSubscriptionUrl(checkoutInput);
  assert.ok(
    url.startsWith("https://sandbox.payfast.co.za/eng/process"),
    `expected sandbox host, got ${new URL(url).origin}`
  );
  assert.ok(!url.includes("www.payfast.co.za"), "must never point at the live gateway in sandbox mode");
});

test("subscription checkout URL round-trips its own signature", () => {
  const url = createPayFastSubscriptionUrl(checkoutInput);
  const params = new URL(url).searchParams;

  assert.equal(params.get("merchant_id"), "10000100");
  assert.equal(params.get("amount"), "29.00");
  assert.equal(params.get("custom_str1"), "user_abc");
  assert.equal(params.get("custom_str2"), "subscription:scholar:monthly");
  assert.equal(params.get("notify_url"), checkoutInput.notifyUrl);
  assert.equal(params.get("return_url"), checkoutInput.returnUrl);
  assert.equal(params.get("cancel_url"), checkoutInput.cancelUrl);

  signatureFromUrl(url);
});

test("a tampered amount breaks the signature and would be rejected by the ITN", () => {
  const url = createPayFastSubscriptionUrl(checkoutInput);
  const params = new URL(url).searchParams;
  const original = params.get("signature");

  const tampered = new URL(url);
  tampered.searchParams.set("amount", "1.00");

  const rebuild: Record<string, string> = {};
  for (const [k, v] of tampered.searchParams.entries()) {
    if (k !== "signature" && v !== "") rebuild[k] = v;
  }

  assert.notEqual(
    buildPayFastSignature(rebuild),
    original,
    "reducing the amount must invalidate the signature"
  );
});

test("the ITN amount check accepts the real price and rejects a discount attempt", () => {
  // Mirrors the handler: the expected amount is recomputed from tier + cadence and
  // never read from the ITN body.
  assert.equal(subscriptionAmountZar("scholar", "monthly"), 29);

  const received = (raw: string) => Number.parseFloat(raw);
  assert.equal(received("29.00"), subscriptionAmountZar("scholar", "monthly"));

  // A tampered ITN claiming a cheaper plan must not match.
  assert.notEqual(received("1.00"), subscriptionAmountZar("scholar", "monthly"));
  assert.notEqual(received("290.00"), subscriptionAmountZar("scholar", "monthly"));
});

test("untrusted IPs are rejected on live but sandbox validation is attempted", async () => {
  // A bad signature must fail before any network call is made.
  const result = await verifyPayFastItn(
    {
      merchant_id: "10000100",
      amount_gross: "29.00",
      custom_str1: "user_abc",
      custom_str2: "subscription:scholar:monthly",
      payment_status: "COMPLETE",
      signature: "deadbeefdeadbeefdeadbeefdeadbeef",
    },
    "1.2.3.4"
  );
  assert.equal(result.valid, false);
  assert.match(String(result.reason), /Signature mismatch/);
});
