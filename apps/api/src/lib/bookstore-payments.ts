import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { config } from "../config.js";

export type PaymentIntentInput = {
  orderId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, string>;
  lineItems?: Array<{
    name: string;
    quantity: number;
    unitAmountCents: number;
    description?: string;
  }>;
};

export type PaymentIntentResult = {
  provider: "stub" | "stripe";
  paymentIntentId: string;
  clientSecret: string | null;
  amountCents: number;
  currency: string;
  status: "requires_confirmation" | "requires_action" | "succeeded";
  checkoutUrl?: string | null;
  checkoutSessionId?: string | null;
  providerMetadata?: Record<string, unknown>;
};

type StripeCheckoutSessionResult = {
  id: string;
  url: string | null;
  payment_intent: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required" | string;
  status: "open" | "complete" | "expired" | string;
  metadata?: Record<string, string>;
  amount_total?: number | null;
  currency?: string | null;
};

function getBookstorePublicBaseUrl() {
  if (config.bookstorePublicBaseUrl.trim()) {
    return config.bookstorePublicBaseUrl.trim().replace(/\/+$/, "");
  }
  const firstCorsOrigin = config.corsOrigin.split(",")[0]?.trim();
  return (firstCorsOrigin || "http://localhost:3000").replace(/\/+$/, "");
}

function isStripeEnabled() {
  return config.bookstorePaymentProvider === "stripe" && Boolean(config.stripeSecretKey);
}

function toStripeCurrency(value: string) {
  return (value || "ZAR").toLowerCase();
}

async function stripeRequest<T>(path: string, body?: URLSearchParams): Promise<T> {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured.");
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
  });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!response.ok) {
    const message = payload?.error?.message || `Stripe API error (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function buildStripeCheckoutParams(input: PaymentIntentInput) {
  const params = new URLSearchParams();
  const webBase = getBookstorePublicBaseUrl();
  params.set("mode", "payment");
  params.set("success_url", `${webBase}/checkout?provider=stripe&orderId=${encodeURIComponent(input.orderId)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${webBase}/checkout?provider=stripe&orderId=${encodeURIComponent(input.orderId)}&canceled=1`);
  params.set("currency", toStripeCurrency(input.currency));
  params.set("client_reference_id", input.orderId);
  params.set("metadata[orderId]", input.orderId);
  if (input.metadata) {
    for (const [key, value] of Object.entries(input.metadata)) {
      params.set(`metadata[${key}]`, String(value));
    }
  }

  const lineItems = input.lineItems?.length
    ? input.lineItems
    : [
        {
          name: `Bookstore order ${input.orderId.slice(0, 8)}`,
          quantity: 1,
          unitAmountCents: input.amountCents,
          description: "Education platform bookstore checkout",
        },
      ];

  lineItems.forEach((item, index) => {
    params.set(`line_items[${index}][quantity]`, String(Math.max(1, item.quantity || 1)));
    params.set(`line_items[${index}][price_data][currency]`, toStripeCurrency(input.currency));
    params.set(`line_items[${index}][price_data][unit_amount]`, String(Math.max(0, item.unitAmountCents || 0)));
    params.set(`line_items[${index}][price_data][product_data][name]`, item.name.slice(0, 120));
    if (item.description) {
      params.set(`line_items[${index}][price_data][product_data][description]`, item.description.slice(0, 500));
    }
  });

  params.set("payment_method_collection", "always");
  params.set("submit_type", "pay");
  return params;
}

async function createStripeCheckoutSession(input: PaymentIntentInput): Promise<PaymentIntentResult> {
  const session = await stripeRequest<StripeCheckoutSessionResult>(
    "/checkout/sessions",
    buildStripeCheckoutParams(input)
  );
  return {
    provider: "stripe",
    paymentIntentId: session.payment_intent || session.id,
    clientSecret: null,
    amountCents: input.amountCents,
    currency: input.currency,
    status: session.payment_status === "paid" ? "succeeded" : "requires_action",
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    providerMetadata: {
      sessionStatus: session.status,
      paymentStatus: session.payment_status,
    },
  };
}

function createStubPaymentIntent(input: PaymentIntentInput): PaymentIntentResult {
  const paymentIntentId = `pi_stub_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const fingerprint = createHash("sha256")
    .update(`${input.orderId}:${input.amountCents}:${input.currency}`)
    .digest("hex")
    .slice(0, 24);

  return {
    provider: "stub",
    paymentIntentId,
    clientSecret: `stub_secret_${fingerprint}`,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.amountCents <= 0 ? "succeeded" : "requires_confirmation",
    checkoutUrl: null,
    checkoutSessionId: null,
  };
}

export async function createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
  if (input.amountCents > 0 && isStripeEnabled()) {
    try {
      return await createStripeCheckoutSession(input);
    } catch (error) {
      // Never mask a real payment failure with a stub intent in production: the caller
      // would render a success receipt for an order that was never charged.
      if (config.isProd) throw error;
      // Fall back to stub in development or if Stripe is misconfigured; UI still works.
    }
  }
  if (input.amountCents > 0 && config.isProd) {
    throw new Error(
      "No payment provider is configured. Set BOOKSTORE_PAYMENT_PROVIDER=payfast with " +
        "PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE (or a Stripe key) " +
        "before accepting paid checkout.",
    );
  }
  return createStubPaymentIntent(input);
}

export async function fetchStripeCheckoutSession(sessionId: string) {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured.");
  }
  return stripeRequest<StripeCheckoutSessionResult>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`
  );
}

export function isStripeWebhookSignatureValid(payload: string, signatureHeader: string) {
  if (!config.stripeWebhookSecret) return false;
  if (!signatureHeader) return false;
  const components = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = components.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = components.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !signatures.length) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", config.stripeWebhookSecret).update(signedPayload).digest("hex");
  return signatures.some((candidate) => {
    try {
      return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  });
}

export async function confirmPaymentWebhook(payload: unknown) {
  const input = (payload ?? {}) as {
    provider?: "stripe" | "stub";
    rawBody?: string;
    signatureHeader?: string;
    event?: any;
  };

  if (input.provider === "stripe") {
    let event = input.event;
    if (!event && typeof input.rawBody === "string") {
      if (config.stripeWebhookSecret && input.signatureHeader) {
        const valid = isStripeWebhookSignatureValid(input.rawBody, input.signatureHeader);
        if (!valid) {
          return { ok: false, provider: "stripe", message: "Invalid Stripe webhook signature." };
        }
      }
      try {
        event = JSON.parse(input.rawBody);
      } catch {
        return { ok: false, provider: "stripe", message: "Invalid Stripe webhook JSON payload." };
      }
    }
    const type = String(event?.type || "");
    const object = event?.data?.object ?? {};
    const orderId =
      object?.metadata?.orderId ||
      object?.metadata?.order_id ||
      object?.client_reference_id ||
      null;
    const paid =
      object?.payment_status === "paid" ||
      type === "checkout.session.completed" ||
      type === "payment_intent.succeeded";
    return {
      ok: true,
      provider: "stripe",
      type,
      orderId,
      paid,
      eventId: event?.id ?? null,
      message: paid ? "Stripe payment confirmed." : "Stripe event processed.",
    };
  }

  return {
    ok: true,
    provider: "stub",
    message: "Stub payment confirmation accepted.",
  };
}
