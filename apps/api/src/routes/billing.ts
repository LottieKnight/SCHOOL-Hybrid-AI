import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { findUserById, updateUserPlan } from "../db/users.js";
import { getAccessStatus } from "../lib/access.js";
import { createProductEvent } from "../db/product-events.js";
import { processBillingWebhookUpgrade } from "../lib/billing-webhook.js";
import { config } from "../config.js";
import { PLANS, getPlan, type PlanTier } from "../services/pricing.js";
import { payfastEnabled, createPayFastSubscriptionUrl, verifyPayFastItn, type PayFastItnPayload } from "../lib/payfast.js";
import { markWebhookEventProcessed } from "../db/wallet.js";
import { randomUUID } from "node:crypto";
import { issueBursaryCodes, redeemBursaryCode, listBursaryCodes } from "../db/bursaryCodes.js";

const upgradeSchema = z.object({
  planType: z.enum(["monthly", "annual"]),
  userId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

const subscribeSchema = z.object({
  tier: z.enum(["scholar", "family", "school"]),
  cadence: z.enum(["monthly", "annual"]).default("monthly"),
});

const billingWebhookParamsSchema = z.object({
  provider: z.literal("stripe"),
});

/**
 * Subscription amounts must be derived from the tier, never trusted from the ITN.
 * `subscriptionAmountZar` is the single source of truth shared by the checkout
 * builder and the ITN validator so the two can never drift.
 */
export function subscriptionAmountZar(tier: PlanTier, cadence: "monthly" | "annual"): number {
  const monthly = getPlan(tier).priceZAR;
  return cadence === "annual" ? Math.round(monthly * 10) : monthly;
}

const SUBSCRIPTION_TIERS = ["scholar", "family", "school"] as const;
type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

function isSubscriptionTier(value: string): value is SubscriptionTier {
  return (SUBSCRIPTION_TIERS as readonly string[]).includes(value);
}

export function shouldRejectBillingWebhookWithoutSecret(input: {
  isProd: boolean;
  stripeWebhookSecret: string;
}) {
  return input.isProd && !input.stripeWebhookSecret.trim();
}

export async function registerBillingRoutes(app: FastifyInstance) {
  app.get("/billing/status", { preHandler: requireAuth }, async (request, reply) => {
    const user = await findUserById(request.user.sub);
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }
    reply.send({ access: getAccessStatus(user) });
  });

  // Self-serve subscription to an economic tier (Scholar/Family/School) via PayFast.
  app.post("/billing/subscribe", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const user = await findUserById(request.user.sub);
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    // Annual = 10x monthly (2 months free), rounded to whole rand.
    const amountZar = subscriptionAmountZar(parsed.data.tier, parsed.data.cadence);

    if (amountZar <= 0) {
      reply.code(400).send({ error: "Invalid plan amount" });
      return;
    }

    if (!payfastEnabled()) {
      reply.code(503).send({
        error: "Payments are not configured. Set PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY.",
      });
      return;
    }

    const subscriptionId = randomUUID();
    const baseUrl = config.appUrl || "https://school.ditshego-ventures.co.za";
    const checkoutUrl = createPayFastSubscriptionUrl({
      subscriptionId,
      userId: user.id,
      tier: parsed.data.tier,
      cadence: parsed.data.cadence,
      amountZar,
      returnUrl: `${baseUrl}/settings?plan=${parsed.data.tier}&status=success`,
      cancelUrl: `${baseUrl}/settings?plan=${parsed.data.tier}&status=cancel`,
      notifyUrl: `${baseUrl}/api/billing/itn`,
    });

    // Record the pending subscription intent so the ITN handler can confirm it.
    await createProductEvent(user.id, "billing_subscribe_intent", {
      tier: parsed.data.tier,
      cadence: parsed.data.cadence,
      amountZar,
      subscriptionId,
      payfastEnabled: true,
    });

    reply.send({ checkoutUrl, tier: parsed.data.tier, cadence: parsed.data.cadence, amountZar });
  });

  // Redeem a sponsor bursary code (Bursary tier, R0 to the learner).
  app.post("/billing/redeem", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ code: z.string().trim().min(4).max(64) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Enter a valid code." });
      return;
    }

    const userId = request.user.sub;
    const result = await redeemBursaryCode(parsed.data.code, userId);
    if (!result.ok) {
      reply.code(400).send({ error: result.reason ?? "Could not redeem code." });
      return;
    }

    const now = new Date();
    // 1-year sponsored access (renewable by re-redeeming or sponsor extension).
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const updated = await updateUserPlan(userId, "bursary", "active", expiresAt);
    if (!updated) {
      reply.code(500).send({ error: "Redeemed but failed to activate plan. Contact support." });
      return;
    }

    await createProductEvent(userId, "billing_bursary_redeemed", {
      code: parsed.data.code.trim().toUpperCase(),
      planType: "bursary",
      expiresAt: expiresAt.toISOString(),
    });

    reply.send({ ok: true, plan: getAccessStatus(updated) });
  });

  // Admin: issue bulk sponsor bursary codes.
  app.post("/billing/codes", { preHandler: requireAdmin }, async (request, reply) => {
    const schema = z.object({
      sponsorName: z.string().trim().min(2).max(120),
      sponsorEmail: z.string().email().optional(),
      count: z.number().int().min(1).max(500),
      seatsPerCode: z.number().int().min(1).max(50).optional(),
      expiresAt: z.string().datetime().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const codes = await issueBursaryCodes({
      sponsorName: parsed.data.sponsorName,
      sponsorEmail: parsed.data.sponsorEmail,
      count: parsed.data.count,
      seatsPerCode: parsed.data.seatsPerCode,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdBy: request.user.sub,
    });
    reply.send({ ok: true, count: codes.length, codes });
  });

  app.get("/billing/codes", { preHandler: requireAdmin }, async (_request, reply) => {
    const codes = await listBursaryCodes();
    reply.send({ ok: true, codes });
  });

  app.post("/billing/upgrade", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = upgradeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }

    const user = await findUserById(parsed.data.userId);
    if (!user) {
      reply.code(404).send({ error: "User not found" });
      return;
    }

    const now = new Date();
    const planExpiresAt =
      parsed.data.planType === "annual"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await updateUserPlan(user.id, parsed.data.planType, "active", planExpiresAt);
    if (!updated) {
      reply.code(500).send({ error: "Failed to update plan" });
      return;
    }

    await createProductEvent(request.user.sub, "billing_admin_upgrade", {
      targetUserId: user.id,
      targetUserEmail: user.email,
      previousPlanType: user.plan_type,
      previousPlanStatus: user.plan_status,
      newPlanType: updated.plan_type,
      newPlanStatus: updated.plan_status,
      requestedPlanType: parsed.data.planType,
      reason: parsed.data.reason,
      grantedByAdminId: request.user.sub,
      grantedAt: new Date().toISOString(),
    });

    reply.send({
      access: getAccessStatus(updated),
      targetUserId: updated.id,
      grantedByAdminId: request.user.sub,
    });
  });

  // PayFast ITN for tier subscriptions. This is the notify_url target emitted by
  // createPayFastSubscriptionUrl; without this handler PayFast would post, get a
  // 404, retry, and give up, so the customer would pay and never be upgraded.
  app.post("/billing/itn", async (request, reply) => {
    const sourceIp =
      String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
      String((request.socket as { remoteAddress?: string }).remoteAddress || "");

    const body = request.body as PayFastItnPayload;
    const { valid, reason } = await verifyPayFastItn(body, sourceIp);
    if (!valid) {
      app.log.warn({ reason, sourceIp }, "Billing PayFast ITN rejected");
      reply.code(400).send({ error: "Invalid PayFast ITN", reason });
      return;
    }

    // custom_str2 is `subscription:<tier>:<cadence>` (see createPayFastSubscriptionUrl).
    const parts = (body.custom_str2 || "").split(":");
    const tier = parts[1] || "";
    const cadence = parts[2] === "annual" ? "annual" : "monthly";
    const userId = body.custom_str1?.trim() || "";

    if (!isSubscriptionTier(tier) || !userId) {
      reply.code(400).send({ error: "Malformed subscription ITN" });
      return;
    }

    // Idempotency: PayFast retries ITNs, so key on the gateway payment id.
    const pfPaymentId = body.pf_payment_id?.trim() || null;
    const eventId = pfPaymentId || body.m_payment_id?.trim() || null;
    if (!eventId) {
      reply.send({ ok: true, handled: false, message: "Missing pf_payment_id" });
      return;
    }
    const marked = await markWebhookEventProcessed("payfast", eventId);
    if (!marked) {
      reply.send({ ok: true, duplicate: true, provider: "payfast", eventId });
      return;
    }

    if (body.payment_status?.toUpperCase() !== "COMPLETE") {
      reply.send({ ok: true, provider: "payfast", eventId, handled: false, message: "Payment not complete" });
      return;
    }

    // Never trust the amount from the ITN: recompute from the tier and reject a
    // mismatch so a tampered or mis-built checkout cannot grant the wrong plan.
    const expectedZar = subscriptionAmountZar(tier, cadence);
    const receivedZar = Number.parseFloat(body.amount_gross || "");
    if (!Number.isFinite(receivedZar) || Math.abs(receivedZar - expectedZar) > 0.01) {
      app.log.error({ eventId, tier, cadence, expectedZar, receivedZar }, "Subscription ITN amount mismatch");
      reply.code(400).send({ error: "Subscription amount mismatch" });
      return;
    }

    const days = cadence === "annual" ? 365 : 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const upgraded = await updateUserPlan(userId, tier, "active", expiresAt);
    if (!upgraded) {
      app.log.error({ eventId, userId, tier }, "Subscription paid but plan upgrade failed");
      reply.code(500).send({ error: "Payment received but plan activation failed. Contact support." });
      return;
    }

    await createProductEvent(userId, "billing_subscribe_activated", {
      tier,
      cadence,
      amountZar: expectedZar,
      subscriptionId: body.m_payment_id?.trim() || null,
      payfastPaymentId: pfPaymentId,
    });

    reply.send({ ok: true, provider: "payfast", eventId, handled: true, tier, cadence, expiresAt });
    return;
  });

  app.post("/billing/webhooks/:provider", async (request, reply) => {
    const params = billingWebhookParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Unsupported billing webhook provider" });
      return;
    }

    if (
      shouldRejectBillingWebhookWithoutSecret({
        isProd: config.isProd,
        stripeWebhookSecret: config.stripeWebhookSecret,
      })
    ) {
      app.log.error(
        {
          provider: params.data.provider,
          route: "/billing/webhooks/stripe",
        },
        "Rejecting billing webhook because STRIPE_WEBHOOK_SECRET is not configured in production."
      );
      reply.code(503).send({ error: "Stripe webhook secret is not configured." });
      return;
    }

    const signatureHeader = String(request.headers["stripe-signature"] || "");
    const body = request.body;
    const rawBody =
      typeof body === "string" ? body : body ? JSON.stringify(body) : "";
    const result = await processBillingWebhookUpgrade({
      provider: params.data.provider,
      rawBody,
      signatureHeader,
      stripeWebhookSecretConfigured: Boolean(config.stripeWebhookSecret),
    });

    if (!result.ok) {
      reply.code(400).send({ error: result.message, eventId: result.eventId ?? null });
      return;
    }

    reply.send(result);
  });
}
