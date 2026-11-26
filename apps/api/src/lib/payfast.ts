import { createHash } from "node:crypto";
import { config } from "../config.js";

const LIVE_URL = "https://www.payfast.co.za/eng/process";
const SANDBOX_URL = "https://sandbox.payfast.co.za/eng/process";
const LIVE_VALIDATE_URL = "https://www.payfast.co.za/eng/query/validate";
const SANDBOX_VALIDATE_URL = "https://sandbox.payfast.co.za/eng/query/validate";

// PayFast IPs — used to verify ITN origin
const PAYFAST_IPS = new Set([
  "197.97.145.144",
  "41.74.179.194",
  "196.33.227.144",
  "196.33.227.145",
  "196.33.227.146",
  "196.33.227.147",
  "196.33.227.148",
  "196.33.227.149",
  "196.33.227.150",
  "196.33.227.151",
]);

export function payfastEnabled() {
  return Boolean(config.payfastMerchantId && config.payfastMerchantKey);
}

function payfastBaseUrl() {
  return config.payfastSandbox ? SANDBOX_URL : LIVE_URL;
}

function payfastValidateUrl() {
  return config.payfastSandbox ? SANDBOX_VALIDATE_URL : LIVE_VALIDATE_URL;
}

/**
 * PHP `urlencode` equivalent.
 *
 * PayFast computes its signatures with PHP's urlencode, which encodes
 * `! ' ( ) * ~` as `%21 %27 %28 %29 %2A %7E` (and spaces as `+`).
 * JavaScript's encodeURIComponent leaves those characters untouched, so using
 * it directly produces a "Generated signature does not match" error whenever a
 * field contains them — e.g. an item_name with parentheses.
 */
function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Builds the MD5 signature PayFast requires.
 * Parameters must be in the exact order they appear in the form — do not sort.
 *
 * `includeEmpty` must be true when verifying ITNs: PayFast signs every field it
 * sends, including the present-but-empty `custom_str3..5` / `custom_int1..5` /
 * `name_*` / `email_address` fields, as bare `key=` pairs. The hosted checkout
 * omits empty fields instead, so its signature filters them out.
 */
export function buildPayFastSignature(
  params: Record<string, string>,
  options: { includeEmpty?: boolean; passphrase?: string } = {}
): string {
  const includeEmpty = options.includeEmpty ?? false;
  const passphrase = options.passphrase ?? config.payfastPassphrase;
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && (includeEmpty || v !== ""))
    .map(([k, v]) => `${k}=${phpUrlEncode(v)}`);

  if (passphrase) {
    parts.push(`passphrase=${phpUrlEncode(passphrase)}`);
  }

  return createHash("md5").update(parts.join("&")).digest("hex");
}

export type PayFastCheckoutInput = {
  topupId: string;
  userId: string;
  amountZar: number;
  creditsGranted: number;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export function createPayFastCheckoutUrl(input: PayFastCheckoutInput): string {
  const amountStr = input.amountZar.toFixed(2);
  const params: Record<string, string> = {
    merchant_id: config.payfastMerchantId,
    merchant_key: config.payfastMerchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.topupId,
    amount: amountStr,
    item_name: "SCHOOL Wallet Credits",
    item_description: `${input.creditsGranted} credits`,
    custom_str1: input.userId,
    custom_str2: String(input.creditsGranted),
  };

  const signature = buildPayFastSignature(params);
  params.signature = signature;

  const qs = new URLSearchParams(params).toString();
  return `${payfastBaseUrl()}?${qs}`;
}

export type PayFastSubscriptionCheckoutInput = {
  subscriptionId: string;
  userId: string;
  tier: string;
  cadence: "monthly" | "annual";
  amountZar: number;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

/**
 * PayFast checkout for a subscription tier (Scholar/Family/School).
 * custom_str1 = userId, custom_str2 = "subscription:<tier>:<cadence>" so the ITN
 * handler can map the payment back to the correct plan.
 */
export function createPayFastSubscriptionUrl(input: PayFastSubscriptionCheckoutInput): string {
  const amountStr = input.amountZar.toFixed(2);
  const params: Record<string, string> = {
    merchant_id: config.payfastMerchantId,
    merchant_key: config.payfastMerchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.subscriptionId,
    amount: amountStr,
    item_name: `SCHOOL ${input.tier} plan (${input.cadence})`,
    item_description: `SCHOOL ${input.tier} subscription`,
    custom_str1: input.userId,
    custom_str2: `subscription:${input.tier}:${input.cadence}`,
  };

  const signature = buildPayFastSignature(params);
  params.signature = signature;

  const qs = new URLSearchParams(params).toString();
  return `${payfastBaseUrl()}?${qs}`;
}

export type PayFastBookstoreCheckoutInput = {
  orderId: string;
  userId: string;
  amountZar: number;
  itemNames: string[];
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export function createPayFastBookstoreCheckoutUrl(input: PayFastBookstoreCheckoutInput): string {
  const amountStr = input.amountZar.toFixed(2);
  const itemNames = input.itemNames.filter(Boolean).map((name) => name.trim().slice(0, 100));
  const itemName = itemNames.length > 1 ? `Bookstore order ${input.orderId.slice(0, 8)}` : itemNames[0];
  const params: Record<string, string> = {
    merchant_id: config.payfastMerchantId,
    merchant_key: config.payfastMerchantKey,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    m_payment_id: input.orderId,
    amount: amountStr,
    item_name: itemName || "Bookstore order",
    item_description:
      itemNames.length > 1 ? `${itemNames.length} items` : itemNames[0] || "Bookstore order",
    custom_str1: input.userId,
  };

  const signature = buildPayFastSignature(params);
  params.signature = signature;

  const qs = new URLSearchParams(params).toString();
  return `${payfastBaseUrl()}?${qs}`;
}

export type PayFastItnPayload = {
  m_payment_id?: string;
  pf_payment_id?: string;
  payment_status?: string;
  amount_gross?: string;
  custom_str1?: string;
  custom_str2?: string;
  signature?: string;
  [key: string]: string | undefined;
};

/**
 * Verifies a PayFast ITN:
 * 1. Signature check against received data
 * 2. Server-side validation POST to PayFast
 */
export async function verifyPayFastItn(
  payload: PayFastItnPayload,
  sourceIp: string
): Promise<{ valid: boolean; reason?: string }> {
  // In sandbox mode skip IP check; PayFast sandbox IPs are not fixed
  if (!config.payfastSandbox && !PAYFAST_IPS.has(sourceIp)) {
    return { valid: false, reason: `Untrusted IP: ${sourceIp}` };
  }

  // Rebuild params without signature field to verify. Keep empty fields —
  // PayFast includes them in the signed string (see buildPayFastSignature).
  const { signature: receivedSig, ...rest } = payload;
  const sigParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) sigParams[k] = v;
  }
  const expectedSig = buildPayFastSignature(sigParams, { includeEmpty: true });
  if (expectedSig !== receivedSig) {
    return { valid: false, reason: "Signature mismatch" };
  }

  // Validate with PayFast server
  try {
    const formBody = new URLSearchParams(
      Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined)) as Record<string, string>
    ).toString();

    const response = await fetch(payfastValidateUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
      signal: AbortSignal.timeout(5000),
    });

    const text = await response.text();
    if (!text.trim().toUpperCase().startsWith("VALID")) {
      return { valid: false, reason: `PayFast validation response: ${text.trim()}` };
    }
  } catch (err) {
    return { valid: false, reason: `PayFast validation request failed: ${String(err)}` };
  }

  return { valid: true };
}
