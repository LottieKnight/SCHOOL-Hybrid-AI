import { isStripeWebhookSignatureValid } from "./bookstore-payments.js";
import { findUserById, updateUserPlan, type UserRecord } from "../db/users.js";
import { createProductEvent } from "../db/product-events.js";
import { markWebhookEventProcessed } from "../db/wallet.js";

type BillingPlanType = "monthly" | "annual";

type BillingWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      payment_status?: string;
      metadata?: Record<string, string | undefined>;
      client_reference_id?: string;
    };
  };
};

type ProcessBillingWebhookInput = {
  provider: "stripe";
  rawBody: string;
  signatureHeader: string;
  stripeWebhookSecretConfigured: boolean;
};

type ProcessBillingWebhookResult = {
  ok: boolean;
  duplicate?: boolean;
  handled?: boolean;
  message: string;
  eventId?: string | null;
  userId?: string | null;
  planType?: BillingPlanType | null;
};

type BillingWebhookDeps = {
  verifySignature: (rawBody: string, signatureHeader: string) => boolean;
  parseEvent: (rawBody: string) => BillingWebhookEvent;
  markProcessed: (provider: string, eventId: string) => Promise<boolean>;
  findUser: (userId: string) => Promise<UserRecord | null>;
  updatePlan: (
    userId: string,
    planType: BillingPlanType,
    planStatus: string,
    planExpiresAt: Date | null
  ) => Promise<UserRecord | null>;
  createAuditEvent: (userId: string, metadata: Record<string, unknown>) => Promise<void>;
  now: () => Date;
};

const defaultDeps: BillingWebhookDeps = {
  verifySignature: (rawBody, signatureHeader) =>
    isStripeWebhookSignatureValid(rawBody, signatureHeader),
  parseEvent: (rawBody) => JSON.parse(rawBody) as BillingWebhookEvent,
  markProcessed: markWebhookEventProcessed,
  findUser: findUserById,
  updatePlan: updateUserPlan,
  createAuditEvent: async (userId, metadata) => {
    await createProductEvent(userId, "billing_webhook_upgrade", metadata);
  },
  now: () => new Date(),
};

function parsePlanType(value: string | undefined): BillingPlanType | null {
  if (value === "monthly" || value === "annual") {
    return value;
  }
  return null;
}

function parseMetadataValue(
  metadata: Record<string, string | undefined> | undefined,
  keys: string[]
) {
  if (!metadata) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isPaidBillingEvent(event: BillingWebhookEvent) {
  const type = String(event.type || "");
  const paymentStatus = event.data?.object?.payment_status;
  return (
    paymentStatus === "paid" ||
    type === "checkout.session.completed" ||
    type === "invoice.paid" ||
    type === "payment_intent.succeeded"
  );
}

function planExpiryFromType(planType: BillingPlanType, now: Date) {
  const days = planType === "annual" ? 365 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function processBillingWebhookUpgrade(
  input: ProcessBillingWebhookInput,
  deps: BillingWebhookDeps = defaultDeps
): Promise<ProcessBillingWebhookResult> {
  if (!input.rawBody.trim()) {
    return { ok: false, message: "Missing webhook payload." };
  }

  if (!input.signatureHeader || !input.signatureHeader.trim()) {
    return { ok: false, message: "Missing webhook signature header." };
  }

  if (input.stripeWebhookSecretConfigured) {
    const valid = deps.verifySignature(input.rawBody, input.signatureHeader);
    if (!valid) {
      return { ok: false, message: "Invalid Stripe webhook signature." };
    }
  }

  let event: BillingWebhookEvent;
  try {
    event = deps.parseEvent(input.rawBody);
  } catch {
    return { ok: false, message: "Invalid webhook JSON payload." };
  }

  const eventId = event.id?.trim() || null;
  if (!eventId) {
    return { ok: false, message: "Missing webhook event id.", eventId: null };
  }

  const marked = await deps.markProcessed(input.provider, eventId);
  if (!marked) {
    return {
      ok: true,
      duplicate: true,
      handled: false,
      message: "Webhook event already processed.",
      eventId,
      userId: null,
      planType: null,
    };
  }

  if (!isPaidBillingEvent(event)) {
    return {
      ok: true,
      handled: false,
      message: "Webhook event does not grant plan entitlements.",
      eventId,
      userId: null,
      planType: null,
    };
  }

  const metadata = event.data?.object?.metadata;
  const userId =
    parseMetadataValue(metadata, ["userId", "user_id"]) ??
    (event.data?.object?.client_reference_id || null);
  const planType = parsePlanType(
    parseMetadataValue(metadata, ["planType", "plan_type"]) ?? undefined
  );

  if (!userId || !planType) {
    return {
      ok: true,
      handled: false,
      message: "Webhook missing userId or planType metadata.",
      eventId,
      userId: userId ?? null,
      planType: planType ?? null,
    };
  }

  const existingUser = await deps.findUser(userId);
  if (!existingUser) {
    return {
      ok: false,
      handled: false,
      message: "Target user not found for webhook entitlement grant.",
      eventId,
      userId,
      planType,
    };
  }

  const grantedAt = deps.now();
  const updated = await deps.updatePlan(
    existingUser.id,
    planType,
    "active",
    planExpiryFromType(planType, grantedAt)
  );
  if (!updated) {
    return {
      ok: false,
      handled: false,
      message: "Failed to grant plan entitlement from webhook.",
      eventId,
      userId,
      planType,
    };
  }

  await deps.createAuditEvent(existingUser.id, {
    source: "billing_webhook",
    provider: input.provider,
    eventId,
    requestedPlanType: planType,
    previousPlanType: existingUser.plan_type,
    previousPlanStatus: existingUser.plan_status,
    newPlanType: updated.plan_type,
    newPlanStatus: updated.plan_status,
    grantedAt: grantedAt.toISOString(),
  });

  return {
    ok: true,
    handled: true,
    message: "Billing entitlement granted from verified webhook event.",
    eventId,
    userId,
    planType,
  };
}

