import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  WalletIdempotencyConflictError,
  WalletInsufficientFundsError,
  createWalletTopup,
  creditWallet,
  debitWallet,
  getAdminWalletSummary,
  getWalletBalance,
  unlockDetailedReportWithWeeklyFree,
  listWalletLedgerEntries,
  reconcileWalletBalances,
  getWalletTopupById,
  markWebhookEventProcessed,
  updateWalletTopupStatus,
} from "../db/wallet.js";
import { resolveWalletTopupSelection, walletPricing } from "../lib/wallet-pricing.js";
import { isStripeWebhookSignatureValid } from "../lib/bookstore-payments.js";
import { payfastEnabled, createPayFastCheckoutUrl, verifyPayFastItn, type PayFastItnPayload } from "../lib/payfast.js";
import { createProductEvent } from "../db/product-events.js";

const walletDebitSchema = z.object({
  amountCredits: z.coerce.number().int().positive(),
  reason: z.string().trim().min(2).max(240),
  refType: z.string().trim().min(2).max(80).optional(),
  refId: z.string().trim().min(1).max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

const walletCreditSchema = walletDebitSchema.extend({
  userId: z.string().uuid(),
});

const walletDetailedUnlockSchema = z.object({
  attemptId: z.string().trim().min(1).max(200),
  amountCredits: z.coerce.number().int().positive().optional(),
});

const walletTopupCreateSchema = z
  .object({
    amountZar: z.coerce.number().positive().optional(),
    bundleId: z.string().trim().min(1).max(40).optional(),
  })
  .refine((input) => input.amountZar !== undefined || Boolean(input.bundleId), {
    message: "amountZar or bundleId is required",
  });

const walletLedgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const walletWebhookParamsSchema = z.object({
  provider: z.enum(["stripe", "payfast", "stub"]),
});

const walletStubWebhookBodySchema = z.object({
  eventId: z.string().trim().min(6).max(200),
  topupId: z.string().uuid(),
  paid: z.boolean().default(true),
  providerRef: z.string().trim().min(1).max(200).optional(),
});

export function shouldRejectStripeWebhookWithoutSecret(input: {
  isProd: boolean;
  stripeWebhookSecret: string;
}) {
  return input.isProd && !input.stripeWebhookSecret.trim();
}

function getIdempotencyKey(
  request: { headers: Record<string, unknown> },
  bodyValue?: string
) {
  const headerValue = request.headers["idempotency-key"];
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }
  if (bodyValue && bodyValue.trim()) {
    return bodyValue.trim();
  }
  return null;
}

function stripeEnabled() {
  return Boolean(config.stripeSecretKey);
}

function walletBaseUrl() {
  if (config.bookstorePublicBaseUrl.trim()) {
    return config.bookstorePublicBaseUrl.trim().replace(/\/+$/, "");
  }
  const firstCorsOrigin = config.corsOrigin.split(",")[0]?.trim();
  return (firstCorsOrigin || "http://localhost:3000").replace(/\/+$/, "");
}

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_intent?: string | null;
};

type StripeWalletWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      payment_status?: string;
      payment_intent?: string;
      client_reference_id?: string;
      metadata?: Record<string, string | undefined>;
    };
  };
};

async function createStripeWalletCheckoutSession(input: {
  topupId: string;
  userId: string;
  amountZar: number;
  creditsGranted: number;
}) {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe is not configured.");
  }
  const amountCents = Math.max(1, Math.round(input.amountZar * 100));
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set(
    "success_url",
    `${walletBaseUrl()}/settings?walletTopup=${encodeURIComponent(input.topupId)}&session_id={CHECKOUT_SESSION_ID}`
  );
  params.set(
    "cancel_url",
    `${walletBaseUrl()}/settings?walletTopup=${encodeURIComponent(input.topupId)}&canceled=1`
  );
  params.set("currency", "zar");
  params.set("client_reference_id", input.topupId);
  params.set("metadata[topupId]", input.topupId);
  params.set("metadata[userId]", input.userId);
  params.set("metadata[creditsGranted]", String(input.creditsGranted));
  params.set("metadata[kind]", "wallet_topup");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "zar");
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set("line_items[0][price_data][product_data][name]", "SCHOOL Wallet Credits");
  params.set(
    "line_items[0][price_data][product_data][description]",
    `${input.creditsGranted} credits`
  );
  params.set("payment_method_collection", "always");
  params.set("submit_type", "pay");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload &&
      "error" in payload &&
      typeof (payload as { error?: { message?: string } }).error?.message === "string"
        ? (payload as { error?: { message?: string } }).error!.message!
        : `Stripe checkout session failed (${response.status})`;
    throw new Error(errorMessage);
  }

  const session = payload as StripeCheckoutSession;
  if (!session?.id) {
    throw new Error("Stripe checkout session did not return an id.");
  }
  return session;
}

async function applySuccessfulTopup(input: {
  provider: "stripe" | "payfast" | "stub";
  eventId: string;
  topupId: string;
  providerRef?: string | null;
}) {
  const topup = await getWalletTopupById(input.topupId);
  if (!topup) {
    return { ok: false, message: "Topup not found." };
  }

  const creditResult = await creditWallet({
    userId: topup.userId,
    amountCredits: topup.creditsGranted,
    reason: "Wallet top-up",
    refType: "wallet_topup",
    refId: topup.id,
    idempotencyKey: `wallet-topup:${input.provider}:${input.eventId}`,
  });

  await updateWalletTopupStatus({
    topupId: topup.id,
    status: "succeeded",
    providerRef: input.providerRef ?? topup.providerRef ?? null,
  });

  await createProductEvent(topup.userId, "wallet_credit_topup", {
    topupId: topup.id,
    provider: input.provider,
    eventId: input.eventId,
    amountZar: topup.amountZar,
    creditsGranted: topup.creditsGranted,
    resultingBalanceCredits: creditResult.account.balanceCredits,
    idempotencyKey: `wallet-topup:${input.provider}:${input.eventId}`,
    alreadyProcessed: creditResult.alreadyProcessed,
  });

  return {
    ok: true,
    message: "Topup processed.",
    topup,
    account: creditResult.account,
    entry: creditResult.entry,
    alreadyProcessed: creditResult.alreadyProcessed,
  };
}

export async function registerWalletRoutes(app: FastifyInstance) {
  app.get("/admin/wallet/summary", { preHandler: requireAdmin }, async (_request, reply) => {
    const summary = await getAdminWalletSummary();
    reply.send({
      total_wallet_accounts: summary.totalWalletAccounts,
      total_credits_issued: summary.totalCreditsIssued,
      total_credits_debited: summary.totalCreditsDebited,
      net_outstanding_credits: summary.netOutstandingCredits,
    });
  });

  app.get("/admin/wallet/reconcile", { preHandler: requireAdmin }, async (_request, reply) => {
    const reconciliation = await reconcileWalletBalances();
    reply.send({
      checked_wallet_accounts: reconciliation.checkedWalletAccounts,
      checked_ledger_users: reconciliation.checkedLedgerUsers,
      account_balance_total_credits: reconciliation.accountBalanceTotalCredits,
      ledger_net_total_credits: reconciliation.ledgerNetTotalCredits,
      mismatch_count: reconciliation.mismatchCount,
      mismatches: reconciliation.mismatches.map((row) => ({
        user_id: row.userId,
        account_balance_credits: row.accountBalanceCredits,
        ledger_computed_balance_credits: row.ledgerComputedBalanceCredits,
        difference_credits: row.differenceCredits,
        has_account: row.hasAccount,
        has_ledger: row.hasLedger,
      })),
    });
  });

  app.get("/wallet/balance", { preHandler: requireAuth }, async (request, reply) => {
    const balance = await getWalletBalance(request.user.sub);
    reply.send({
      wallet: balance,
      pricing: walletPricing,
    });
  });

  app.get("/wallet/ledger", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = walletLedgerQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }

    const entries = await listWalletLedgerEntries(request.user.sub, parsed.data.limit);
    reply.send({
      entries,
      limit: parsed.data.limit,
    });
  });

  app.post("/wallet/debit", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = walletDebitSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const idempotencyKey = getIdempotencyKey(request, parsed.data.idempotencyKey);
    if (!idempotencyKey) {
      reply.code(400).send({ error: "idempotency key is required" });
      return;
    }

    try {
      const result = await debitWallet({
        userId: request.user.sub,
        amountCredits: parsed.data.amountCredits,
        reason: parsed.data.reason,
        refType: parsed.data.refType ?? null,
        refId: parsed.data.refId ?? null,
        idempotencyKey,
      });

      await createProductEvent(request.user.sub, "wallet_debit", {
        amountCredits: result.entry.amountCredits,
        reason: result.entry.reason,
        refType: result.entry.refType,
        refId: result.entry.refId,
        idempotencyKey: result.entry.idempotencyKey,
        resultingBalanceCredits: result.account.balanceCredits,
        alreadyProcessed: result.alreadyProcessed,
      });
      if (
        result.entry.refType === "past_paper_detailed_report" &&
        !result.alreadyProcessed
      ) {
        const payloadBytes = Buffer.byteLength(
          JSON.stringify({
            amountCredits: parsed.data.amountCredits,
            reason: parsed.data.reason,
            refType: parsed.data.refType ?? null,
            refId: parsed.data.refId ?? null,
            idempotencyKey,
          })
        );
        await createProductEvent(request.user.sub, "past_paper_unlock", {
          attemptId: result.entry.refId,
          amountCredits: result.entry.amountCredits,
          idempotencyKey: result.entry.idempotencyKey,
          payloadBytes,
          source: "wallet_debit",
        });
      }

      reply.send({
        wallet: result.account,
        ledgerEntry: result.entry,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof WalletInsufficientFundsError) {
        reply.code(402).send({ error: error.message });
        return;
      }
      if (error instanceof WalletIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/wallet/unlocks/detailed-report", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = walletDetailedUnlockSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const idempotencyKey = getIdempotencyKey(request, undefined);
    if (!idempotencyKey) {
      reply.code(400).send({ error: "idempotency key is required" });
      return;
    }

    const requestedAmountCredits = parsed.data.amountCredits ?? walletPricing.detailedReportCredits;
    const debitAmountCredits = Math.max(1, Math.trunc(requestedAmountCredits));

    try {
      const result = await unlockDetailedReportWithWeeklyFree({
        userId: request.user.sub,
        attemptId: parsed.data.attemptId,
        amountCredits: debitAmountCredits,
        reason: "Past paper detailed marking report unlock",
        idempotencyKey,
      });

      const payloadBytes = Buffer.byteLength(
        JSON.stringify({
          attemptId: parsed.data.attemptId,
          amountCredits: debitAmountCredits,
          idempotencyKey,
          mode: result.mode,
        })
      );

      if (result.mode === "paid" && result.entry) {
        await createProductEvent(request.user.sub, "wallet_debit", {
          amountCredits: result.entry.amountCredits,
          reason: result.entry.reason,
          refType: result.entry.refType,
          refId: result.entry.refId,
          idempotencyKey: result.entry.idempotencyKey,
          resultingBalanceCredits: result.account.balanceCredits,
          alreadyProcessed: result.alreadyProcessed,
        });
      }

      await createProductEvent(request.user.sub, "past_paper_unlock", {
        attemptId: parsed.data.attemptId,
        amountCredits: result.chargedCredits,
        idempotencyKey,
        payloadBytes,
        source: "wallet_detailed_unlock",
        unlockMode: result.mode,
        alreadyProcessed: result.alreadyProcessed,
        freeUnlockWeekStart: result.freeUnlock?.weekStart ?? null,
      });

      reply.send({
        wallet: result.account,
        ledgerEntry: result.entry,
        freeUnlock: result.freeUnlock,
        pricing: walletPricing,
        unlock: {
          mode: result.mode,
          chargedCredits: result.chargedCredits,
          alreadyProcessed: result.alreadyProcessed,
        },
      });
    } catch (error) {
      if (error instanceof WalletInsufficientFundsError) {
        reply.code(402).send({ error: error.message });
        return;
      }
      if (error instanceof WalletIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/wallet/credit", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = walletCreditSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const idempotencyKey = getIdempotencyKey(request, parsed.data.idempotencyKey);
    if (!idempotencyKey) {
      reply.code(400).send({ error: "idempotency key is required" });
      return;
    }

    try {
      const result = await creditWallet({
        userId: parsed.data.userId,
        amountCredits: parsed.data.amountCredits,
        reason: parsed.data.reason,
        refType: parsed.data.refType ?? "admin_credit",
        refId: parsed.data.refId ?? request.user.sub,
        idempotencyKey,
      });

      await createProductEvent(request.user.sub, "wallet_credit_admin", {
        targetUserId: parsed.data.userId,
        amountCredits: result.entry.amountCredits,
        reason: result.entry.reason,
        refType: result.entry.refType,
        refId: result.entry.refId,
        idempotencyKey: result.entry.idempotencyKey,
        resultingBalanceCredits: result.account.balanceCredits,
        alreadyProcessed: result.alreadyProcessed,
      });

      reply.send({
        wallet: result.account,
        ledgerEntry: result.entry,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof WalletIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/wallet/topup/create", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = walletTopupCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    const selection = resolveWalletTopupSelection({
      amountZar: parsed.data.amountZar ?? null,
      bundleId: parsed.data.bundleId ?? null,
    });
    if (!selection) {
      reply.code(400).send({
        error: "Unable to resolve wallet top-up credits from provided amount or bundle.",
      });
      return;
    }

    const amountZar = selection.amountZar;
    if (amountZar < walletPricing.minTopupZar || amountZar > walletPricing.maxTopupZar) {
      reply.code(400).send({
        error: `amountZar must be between ${walletPricing.minTopupZar.toFixed(2)} and ${walletPricing.maxTopupZar.toFixed(2)}`,
      });
      return;
    }

    const creditsGranted = selection.totalCredits;
    const provider = payfastEnabled() ? "payfast" : stripeEnabled() ? "stripe" : "stub";
    const topup = await createWalletTopup({
      userId: request.user.sub,
      provider,
      amountZar,
      creditsGranted,
      status: "pending",
    });

    try {
      await createProductEvent(request.user.sub, "wallet_topup_created", {
        topupId: topup.id,
        provider,
        amountZar,
        baseCredits: selection.baseCredits,
        bonusCredits: selection.bonusCredits,
        totalCredits: selection.totalCredits,
        bundleId: selection.bundle?.id ?? null,
      });
    } catch (error) {
      app.log.warn({ err: error, topupId: topup.id }, "Failed to record wallet topup create event.");
    }

    if (provider === "payfast") {
      try {
        const baseUrl = walletBaseUrl();
        // ITN notify URL routes through the Next.js app which proxies /api/* to Fastify
        const notifyUrl = `${baseUrl}/api/wallet/webhooks/payfast`;
        const checkoutUrl = createPayFastCheckoutUrl({
          topupId: topup.id,
          userId: request.user.sub,
          amountZar,
          creditsGranted,
          returnUrl: `${baseUrl}/settings?walletTopup=${encodeURIComponent(topup.id)}`,
          cancelUrl: `${baseUrl}/settings?walletTopup=${encodeURIComponent(topup.id)}&canceled=1`,
          notifyUrl,
        });

        reply.code(201).send({
          topup,
          pricing: walletPricing,
          selection: {
            amountZar: selection.amountZar,
            baseCredits: selection.baseCredits,
            bonusCredits: selection.bonusCredits,
            totalCredits: selection.totalCredits,
            bundle: selection.bundle
              ? {
                  id: selection.bundle.id,
                  name: selection.bundle.name,
                  description: selection.bundle.description,
                  bonusPercent: selection.bundle.bonusPercent,
                }
              : null,
          },
          checkout: {
            provider: "payfast",
            checkoutSessionId: topup.id,
            checkoutUrl,
          },
        });
        return;
      } catch (error) {
        app.log.error({ err: error }, "Wallet PayFast topup create failed; falling back to stub.");
      }
    }

    if (provider === "stripe") {
      try {
        const session = await createStripeWalletCheckoutSession({
          topupId: topup.id,
          userId: request.user.sub,
          amountZar,
          creditsGranted,
        });

        await updateWalletTopupStatus({
          topupId: topup.id,
          status: "pending",
          providerRef: session.id,
        });

        reply.code(201).send({
          topup,
          pricing: walletPricing,
          selection: {
            amountZar: selection.amountZar,
            baseCredits: selection.baseCredits,
            bonusCredits: selection.bonusCredits,
            totalCredits: selection.totalCredits,
            bundle: selection.bundle
              ? {
                  id: selection.bundle.id,
                  name: selection.bundle.name,
                  description: selection.bundle.description,
                  bonusPercent: selection.bundle.bonusPercent,
                }
              : null,
          },
          checkout: {
            provider: "stripe",
            checkoutSessionId: session.id,
            checkoutUrl: session.url,
          },
        });
        return;
      } catch (error) {
        app.log.error({ err: error }, "Wallet Stripe topup create failed; falling back to stub.");
      }
    }

    reply.code(201).send({
      topup,
      pricing: walletPricing,
      selection: {
        amountZar: selection.amountZar,
        baseCredits: selection.baseCredits,
        bonusCredits: selection.bonusCredits,
        totalCredits: selection.totalCredits,
        bundle: selection.bundle
          ? {
              id: selection.bundle.id,
              name: selection.bundle.name,
              description: selection.bundle.description,
              bonusPercent: selection.bundle.bonusPercent,
            }
          : null,
      },
      checkout: {
        provider: "stub",
        checkoutSessionId: null,
        checkoutUrl: null,
        note:
          "Stub topup created. Use /wallet/webhooks/stub in non-production to simulate successful payment.",
      },
    });
  });

  app.post("/wallet/webhooks/:provider", async (request, reply) => {
    const params = walletWebhookParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Unsupported wallet webhook provider" });
      return;
    }
    const provider = params.data.provider;

    if (provider === "payfast") {
      const sourceIp =
        String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
        String((request.socket as { remoteAddress?: string }).remoteAddress || "");

      const body = request.body as PayFastItnPayload;
      const { valid, reason } = await verifyPayFastItn(body, sourceIp);
      if (!valid) {
        app.log.warn({ reason, sourceIp }, "PayFast ITN rejected");
        reply.code(400).send({ error: "Invalid PayFast ITN", reason });
        return;
      }

      const topupId = body.m_payment_id?.trim();
      if (!topupId) {
        reply.send({ ok: true, provider: "payfast", handled: false, message: "Missing m_payment_id" });
        return;
      }

      const pfPaymentId = body.pf_payment_id?.trim() || null;
      const eventId = pfPaymentId || topupId;
      const marked = await markWebhookEventProcessed("payfast", eventId);
      if (!marked) {
        reply.send({ ok: true, duplicate: true, provider: "payfast", eventId });
        return;
      }

      const paid = body.payment_status?.toUpperCase() === "COMPLETE";
      if (!paid) {
        await updateWalletTopupStatus({ topupId, status: "failed" });
        reply.send({ ok: true, provider: "payfast", eventId, handled: false, message: "Payment not complete" });
        return;
      }

      const settled = await applySuccessfulTopup({ provider: "payfast", eventId, topupId, providerRef: pfPaymentId });
      if (!settled.ok) {
        reply.code(404).send({ error: settled.message });
        return;
      }
      reply.send({ provider: "payfast", eventId, handled: true, ...settled });
      return;
    }

    if (provider === "stub" && config.isProd) {
      reply.code(404).send({ error: "Not found" });
      return;
    }

    if (provider === "stub") {
      const parsed = walletStubWebhookBodySchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400).send({ error: "Invalid webhook payload", details: parsed.error.flatten() });
        return;
      }

      const marked = await markWebhookEventProcessed("stub", parsed.data.eventId);
      if (!marked) {
        reply.send({ ok: true, duplicate: true, provider: "stub", eventId: parsed.data.eventId });
        return;
      }

      if (!parsed.data.paid) {
        await updateWalletTopupStatus({ topupId: parsed.data.topupId, status: "failed" });
        reply.send({
          ok: true,
          provider: "stub",
          eventId: parsed.data.eventId,
          handled: false,
          message: "Stub topup marked as failed.",
        });
        return;
      }

      const settled = await applySuccessfulTopup({
        provider: "stub",
        eventId: parsed.data.eventId,
        topupId: parsed.data.topupId,
        providerRef: parsed.data.providerRef ?? null,
      });
      if (!settled.ok) {
        reply.code(404).send({ error: settled.message });
        return;
      }
      reply.send({
        provider: "stub",
        eventId: parsed.data.eventId,
        handled: true,
        ...settled,
      });
      return;
    }

    if (
      shouldRejectStripeWebhookWithoutSecret({
        isProd: config.isProd,
        stripeWebhookSecret: config.stripeWebhookSecret,
      })
    ) {
      app.log.error(
        {
          provider: "stripe",
          route: "/wallet/webhooks/stripe",
        },
        "Rejecting Stripe wallet webhook because STRIPE_WEBHOOK_SECRET is not configured in production."
      );
      reply.code(503).send({ error: "Stripe webhook secret is not configured." });
      return;
    }

    const signatureHeader = String(request.headers["stripe-signature"] || "");
    const body = request.body;
    const rawBody = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
    if (!rawBody.trim()) {
      reply.code(400).send({ error: "Missing webhook payload" });
      return;
    }

    if (config.stripeWebhookSecret && !signatureHeader.trim()) {
      reply.code(400).send({ error: "Missing Stripe signature header" });
      return;
    }
    if (
      config.stripeWebhookSecret &&
      !isStripeWebhookSignatureValid(rawBody, signatureHeader)
    ) {
      reply.code(400).send({ error: "Invalid Stripe signature" });
      return;
    }

    let event: StripeWalletWebhookEvent | null = null;
    try {
      event =
        typeof body === "object" && body
          ? (body as StripeWalletWebhookEvent)
          : (JSON.parse(rawBody) as StripeWalletWebhookEvent);
    } catch {
      reply.code(400).send({ error: "Invalid webhook JSON payload" });
      return;
    }

    const eventId = event?.id?.trim();
    if (!eventId) {
      reply.code(400).send({ error: "Missing webhook event id" });
      return;
    }

    const marked = await markWebhookEventProcessed("stripe", eventId);
    if (!marked) {
      reply.send({ ok: true, duplicate: true, provider: "stripe", eventId });
      return;
    }

    const object = event?.data?.object;
    const metadata = object?.metadata;
    const topupId =
      metadata?.topupId?.trim() ||
      metadata?.topup_id?.trim() ||
      object?.client_reference_id?.trim() ||
      null;
    if (!topupId) {
      reply.send({
        ok: true,
        provider: "stripe",
        eventId,
        handled: false,
        message: "Webhook does not reference a wallet topup id.",
      });
      return;
    }

    const type = String(event?.type || "");
    const paid =
      object?.payment_status === "paid" ||
      type === "checkout.session.completed" ||
      type === "payment_intent.succeeded";
    if (!paid) {
      if (type === "checkout.session.expired" || type === "payment_intent.payment_failed") {
        await updateWalletTopupStatus({
          topupId,
          status: "failed",
          providerRef: object?.id ?? null,
        });
      }
      reply.send({
        ok: true,
        provider: "stripe",
        eventId,
        handled: false,
        message: "Stripe event processed without wallet credit grant.",
      });
      return;
    }

    const settled = await applySuccessfulTopup({
      provider: "stripe",
      eventId,
      topupId,
      providerRef: object?.payment_intent ?? object?.id ?? null,
    });
    if (!settled.ok) {
      reply.code(404).send({ error: settled.message });
      return;
    }

    reply.send({
      provider: "stripe",
      eventId,
      handled: true,
      ...settled,
    });
  });
}
