import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.PORT = "0";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test_secret";
process.env.COOKIE_SECRET = "test_cookie";
process.env.CORS_ORIGIN = "http://localhost:3000";

const { buildPayFastSignature } = await import("../src/lib/payfast.js");

// Captured verbatim from a real sandbox ITN posted by PayFast (merchant
// 10004002, passphrase "payfast"). PayFast signs the present-but-empty fields
// (custom_str3..5, custom_int1..5, name_*, email_address) as bare `key=` pairs.
const capturedItn: Record<string, string> = {
  m_payment_id: "d9a46e01-ce08-466b-a8fe-dd8d0db03599",
  pf_payment_id: "3425566",
  payment_status: "COMPLETE",
  item_name: "SCHOOL scholar plan (monthly)",
  item_description: "SCHOOL scholar subscription",
  amount_gross: "29.00",
  amount_fee: "-2.30",
  amount_net: "26.70",
  custom_str1: "87578d84-756e-416c-a50c-64c811435fbe",
  custom_str2: "subscription:scholar:monthly",
  custom_str3: "",
  custom_str4: "",
  custom_str5: "",
  custom_int1: "",
  custom_int2: "",
  custom_int3: "",
  custom_int4: "",
  custom_int5: "",
  name_first: "",
  name_last: "",
  email_address: "",
  merchant_id: "10004002",
};

test("reproduces the exact signature PayFast sent on a real sandbox ITN", () => {
  const sig = buildPayFastSignature(capturedItn, {
    includeEmpty: true,
    passphrase: "payfast",
  });
  assert.equal(sig, "8f56f066bcbabf5937d18e317f40f7a6");
});

test("ITN verification must keep empty fields or the signature will not match", () => {
  const withEmpty = buildPayFastSignature(capturedItn, {
    includeEmpty: true,
    passphrase: "payfast",
  });
  const withoutEmpty = buildPayFastSignature(capturedItn, {
    includeEmpty: false,
    passphrase: "payfast",
  });
  assert.notEqual(withEmpty, withoutEmpty);
});

test("parentheses are PHP-urlencoded (PayFast signs %28/%29, not raw parens)", () => {
  // encodeURIComponent leaves ( ) unencoded; PHP urlencode does not. The old
  // implementation produced the raw-paren hash and every subscription with an
  // item_name containing parentheses failed the gateway signature check.
  const encoded = buildPayFastSignature({ item_name: "a (b)" }, { passphrase: "p" });
  assert.equal(encoded, "17f28e7ec29730392a17491b73e404dd");
  assert.notEqual(encoded, "2dca3c3a305d446b00774389850c456a");
});
