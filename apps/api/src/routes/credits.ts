import { createHash } from "node:crypto";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  CreditsIdempotencyConflictError,
  CreditsInsufficientFundsError,
  CreditsInvalidAmountError,
  CreditsRateLimitError,
  awardCredits,
  earnCredits,
  getAdminCreditsSummary,
  getRedemptionHistory,
  getTransactionHistory,
  getUserCredits,
  getWalletBalance,
  reconcileCreditBalances,
  recordCreditAudit,
  redeemCredits,
  spendCredits,
  transferCredits,
} from "../db/credits.js";
import {
  getCreditRule,
  getSourceDisplayName,
  isCreditSource,
  isSelfClaimableSource,
  isVentureType,
} from "../lib/credit-rules.js";

// --- Pseudonymisation helpers (same pattern as routes/research.ts) ----------

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`ip:${ip}`).digest("hex").slice(0, 32);
}

function uaFamily(ua: string | undefined): string | null {
  if (!ua) return null;
  const match = ua.match(/Edg|SamsungBrowser|Chrome|Firefox|Safari|OPR/);
  return match ? match[0] : "Other";
}

// --- Validation -------------------------------------------------------------

const sourceSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isCreditSource, { message: "Unknown credit source" });

const ventureSchema = z
  .string()
  .trim()
  .min(1)
  .refine(isVentureType, { message: "Unknown venture" });

const mutationSchema = z.object({
  venture: ventureSchema,
  source: sourceSchema,
  amount: z.number().int().positive().optional(),
  description: z.string().trim().min(2).max(300).optional(),
  metadata: z.record(z.unknown()).nullish(),
  idempotencyKey: z.string().trim().min(8).max(200).nullish(),
  referenceId: z.string().trim().min(1).max(200).nullish(),
  referenceType: z.string().trim().min(1).max(80).nullish(),
});

const transferSchema = z.object({
  toUserId: z.string().uuid(),
  venture: ventureSchema,
  amount: z.number().int().positive(),
  description: z.string().trim().min(2).max(300).optional(),
  metadata: z.record(z.unknown()).nullish(),
  idempotencyKey: z.string().trim().min(8).max(200).nullish(),
});

const redeemSchema = z.object({
  venture: ventureSchema,
  source: sourceSchema,
  amount: z.number().int().positive(),
  itemId: z.string().trim().min(1).max(200),
  itemType: z.string().trim().min(1).max(80),
  itemName: z.string().trim().min(1).max(300),
  metadata: z.record(z.unknown()).nullish(),
  idempotencyKey: z.string().trim().min(8).max(200).nullish(),
});

const syncSchema = z.object({
  entries: z.array(
    z.object({
      op: z.enum(["earn", "spend"]),
      venture: ventureSchema,
      source: sourceSchema,
      amount: z.number().int().positive().optional(),
      description: z.string().trim().min(2).max(300).optional(),
      metadata: z.record(z.unknown()).nullish(),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
      referenceId: z.string().trim().min(1).max(200).nullish(),
      referenceType: z.string().trim().min(1).max(80).nullish(),
    })
  ),
});

function auditContext(request: { ip: string; headers: Record<string, unknown> }) {
  const ua = typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined;
  return {
    ipHash: hashIp(request.ip),
    userAgentFamily: uaFamily(ua),
  };
}

function defaultDescription(source: string, verb: string) {
  return `${verb}: ${getSourceDisplayName(source as Parameters<typeof getSourceDisplayName>[0])}`;
}

export async function registerCreditsRoutes(app: FastifyInstance) {
  app.get("/credits/balance", { preHandler: requireAuth }, async (request, reply) => {
    const credits = await getUserCredits(request.user.sub);
    reply.send({
      success: true,
      balance: credits.totalBalance,
      wallets: credits.wallets,
      lifetimeEarned: credits.lifetimeEarned,
      lifetimeSpent: credits.lifetimeSpent,
      currentStreak: credits.currentStreak,
      longestStreak: credits.longestStreak,
      recentTransactions: credits.recentTransactions,
    });
  });

  app.get("/credits/wallet/:venture", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ venture: ventureSchema }).safeParse(request.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid venture", details: parsed.error.flatten() });
      return;
    }
    const venture = parsed.data.venture;
    const wallet = await getWalletBalance(request.user.sub, venture);
    reply.send({ success: true, venture, wallet });
  });

  app.get("/credits/history", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z
      .object({
        venture: ventureSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(request.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      return;
    }
    const transactions = await getTransactionHistory(
      request.user.sub,
      parsed.data.venture,
      parsed.data.limit,
      parsed.data.offset
    );
    reply.send({ success: true, transactions });
  });

  app.get("/credits/redemptions", { preHandler: requireAuth }, async (_request, reply) => {
    const redemptions = await getRedemptionHistory(_request.user.sub);
    reply.send({ success: true, redemptions });
  });

  app.post("/credits/earn", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = mutationSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }
    const { venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = parsed.data;

    // Only daily-capped earn sources are self-servable. Milestone/recognition
    // sources (INCUBATOR_ACCEPTANCE, FUNDING_MILESTONE, FOUNDER_RECOGNITION,
    // ...) are issued only through the admin /admin/credits/award endpoint.
    if (!isSelfClaimableSource(source)) {
      reply.code(422).send({
        error: `Source ${source} is not self-claimable; use the admin award endpoint`,
      });
      return;
    }

    try {
      const result = await earnCredits({
        userId: request.user.sub,
        venture,
        source,
        amount: amount ?? 0,
        description: description ?? defaultDescription(source, "Earned"),
        metadata: metadata ?? null,
        idempotencyKey,
        referenceId,
        referenceType,
      });

      if (!result.alreadyProcessed) {
        await recordCreditAudit({
          userId: request.user.sub,
          venture,
          action: "EARN",
          entityType: "credit_transaction",
          entityId: result.transaction.id,
          oldValue: null,
          newValue: result.transaction,
          performedBy: request.user.sub,
          reason: `Earned via ${source}`,
          ...auditContext(request),
        });
      }

      reply.send({
        success: true,
        account: result.account,
        transaction: result.transaction,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof CreditsRateLimitError) {
        reply.code(429).send({ error: error.message, remaining: error.remaining, resetAt: error.resetAt });
        return;
      }
      if (error instanceof CreditsInvalidAmountError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/credits/spend", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = mutationSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }
    const { venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } = parsed.data;

    try {
      const result = await spendCredits({
        userId: request.user.sub,
        venture,
        source,
        amount: amount ?? 0,
        description: description ?? defaultDescription(source, "Spent"),
        metadata: metadata ?? null,
        idempotencyKey,
        referenceId,
        referenceType,
      });

      if (!result.alreadyProcessed) {
        await recordCreditAudit({
          userId: request.user.sub,
          venture,
          action: "SPEND",
          entityType: "credit_transaction",
          entityId: result.transaction.id,
          oldValue: null,
          newValue: result.transaction,
          performedBy: request.user.sub,
          reason: `Spent via ${source}`,
          ...auditContext(request),
        });
      }

      reply.send({
        success: true,
        account: result.account,
        transaction: result.transaction,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof CreditsInsufficientFundsError) {
        reply.code(402).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsInvalidAmountError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/credits/transfer", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = transferSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }
    const { toUserId, venture, amount, description, metadata, idempotencyKey } = parsed.data;

    try {
      const result = await transferCredits({
        fromUserId: request.user.sub,
        toUserId,
        venture,
        amount,
        description: description ?? `Transfer to user ${toUserId}`,
        metadata: metadata ?? null,
        idempotencyKey,
      });

      if (!result.alreadyProcessed) {
        await recordCreditAudit({
          userId: request.user.sub,
          venture,
          action: "TRANSFER_OUT",
          entityType: "credit_transaction",
          entityId: result.transaction.id,
          oldValue: null,
          newValue: result.transaction,
          performedBy: request.user.sub,
          reason: `Transferred to user ${toUserId}`,
          ...auditContext(request),
        });
      }

      reply.send({
        success: true,
        account: result.account,
        transaction: result.transaction,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof CreditsInsufficientFundsError) {
        reply.code(402).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsInvalidAmountError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/credits/redeem", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = redeemSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }
    const { venture, source, amount, itemId, itemType, itemName, metadata, idempotencyKey } = parsed.data;

    try {
      const result = await redeemCredits({
        userId: request.user.sub,
        venture,
        source,
        amount,
        itemId,
        itemType,
        itemName,
        metadata: metadata ?? null,
        idempotencyKey,
      });

      reply.send(result);
    } catch (error) {
      if (error instanceof CreditsInsufficientFundsError) {
        reply.code(402).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsInvalidAmountError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });

  // Offline-first replay: the PWA queues mutations in IndexedDB and replays
  // them here. Each entry carries an idempotency key so replays are safe.
  app.post("/credits/sync", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = syncSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }

    // Reject the whole batch if any replayed earn targets a source that is not
    // self-claimable — big-ticket sources are admin-awarded only.
    for (const entry of parsed.data.entries) {
      if (entry.op === "earn" && !isSelfClaimableSource(entry.source)) {
        reply.code(422).send({
          error: `Source ${entry.source} is not self-claimable; use the admin award endpoint`,
        });
        return;
      }
    }

    const results = [];
    for (const entry of parsed.data.entries) {
      const common = {
        userId: request.user.sub,
        venture: entry.venture,
        source: entry.source,
        amount: entry.amount ?? 0,
        description: entry.description ?? defaultDescription(entry.source, entry.op === "earn" ? "Earned" : "Spent"),
        metadata: entry.metadata ?? null,
        idempotencyKey: entry.idempotencyKey ?? null,
        referenceId: entry.referenceId ?? null,
        referenceType: entry.referenceType ?? null,
      };
      try {
        const result =
          entry.op === "earn"
            ? await earnCredits(common)
            : await spendCredits(common);
        results.push({
          op: entry.op,
          source: entry.source,
          idempotencyKey: entry.idempotencyKey ?? null,
          success: true,
          alreadyProcessed: result.alreadyProcessed,
          transaction: result.transaction,
        });
      } catch (error) {
        if (
          error instanceof CreditsRateLimitError ||
          error instanceof CreditsInsufficientFundsError ||
          error instanceof CreditsInvalidAmountError ||
          error instanceof CreditsIdempotencyConflictError
        ) {
          results.push({
            op: entry.op,
            source: entry.source,
            idempotencyKey: entry.idempotencyKey ?? null,
            success: false,
            error: error.message,
            code: error.name,
          });
          continue;
        }
        throw error;
      }
    }

    reply.send({ success: true, results });
  });

  app.get("/admin/credits/summary", { preHandler: requireAdmin }, async (_request, reply) => {
    const summary = await getAdminCreditsSummary();
    reply.send({ success: true, ...summary });
  });

  app.get("/admin/credits/reconcile", { preHandler: requireAdmin }, async (_request, reply) => {
    const reconciliation = await reconcileCreditBalances();
    reply.send({ success: true, ...reconciliation });
  });

  // Admin-only minting for milestone / recognition sources. The amount is the
  // authoritative rule amount; a client may not override it.
  app.post("/admin/credits/award", { preHandler: requireAdmin }, async (request, reply) => {
    const awardSchema = z.object({
      userId: z.string().uuid(),
      venture: ventureSchema,
      source: sourceSchema,
      amount: z.number().int().positive().optional(),
      description: z.string().trim().min(2).max(300).optional(),
      metadata: z.record(z.unknown()).nullish(),
      idempotencyKey: z.string().trim().min(8).max(200).nullish(),
      referenceId: z.string().trim().min(1).max(200).nullish(),
      referenceType: z.string().trim().min(1).max(80).nullish(),
    });
    const parsed = awardSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      return;
    }
    const { userId, venture, source, amount, description, metadata, idempotencyKey, referenceId, referenceType } =
      parsed.data;

    const rule = getCreditRule(source);
    if (amount != null && amount !== Math.abs(rule.amount)) {
      reply.code(400).send({
        error: `Amount ${amount} does not match the ${rule.amount} rule amount for ${source}`,
      });
      return;
    }

    try {
      const result = await awardCredits({
        userId,
        venture,
        source,
        amount: amount ?? 0,
        description: description ?? defaultDescription(source, "Awarded"),
        metadata: metadata ?? null,
        idempotencyKey,
        referenceId,
        referenceType,
      });

      if (!result.alreadyProcessed) {
        await recordCreditAudit({
          userId,
          venture,
          action: "EARN",
          entityType: "credit_transaction",
          entityId: result.transaction.id,
          oldValue: null,
          newValue: result.transaction,
          performedBy: request.user.sub,
          reason: `Admin award via ${source}`,
          ...auditContext(request),
        });
      }

      reply.send({
        success: true,
        account: result.account,
        transaction: result.transaction,
        alreadyProcessed: result.alreadyProcessed,
      });
    } catch (error) {
      if (error instanceof CreditsInvalidAmountError) {
        reply.code(400).send({ error: error.message });
        return;
      }
      if (error instanceof CreditsIdempotencyConflictError) {
        reply.code(409).send({ error: error.message });
        return;
      }
      throw error;
    }
  });
}
