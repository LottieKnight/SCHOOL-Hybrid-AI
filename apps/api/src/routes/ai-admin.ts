// apps/api/src/routes/ai-admin.ts
//
// Phase 3.3 — AI tutor multi-tenancy + accounting.
//
// Per-institution AI config (provider/model/limits/enabled) and durable AI usage
// accounting. The AI request path (web app) POSTs each tutor call here to record
// tokens/cost against the tenant; institution admins configure their own AI
// before it is used.
//
//   PUT   /institutions/:id/ai-config   set per-institution AI config
//   GET   /institutions/:id/ai-config   read per-institution AI config
//   POST  /institutions/:id/ai/usage    record an AI usage line (learn:ai_tutor)
//   GET   /institutions/:id/ai/usage    read AI usage (analytics:institution)

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission, requireRole } from "../middleware/rbac.js";
import {
  AiProvider,
  getInstitutionAiConfig,
  setInstitutionAiConfig,
  sanitizeAiConfig,
} from "../lib/ai-config.js";
import { recordAiUsage, getInstitutionAiUsage } from "../lib/usage.js";

const aiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(["openai", "anthropic", "ollama", "azure", "auto"]).optional(),
  model: z.string().max(120).optional(),
  minRole: z.string().max(120).optional(),
  maxTokens: z.number().int().min(128).max(16384).optional(),
  rateLimitPerMin: z.number().int().min(0).max(600).optional(),
  dailyLimitPerUser: z.number().int().min(0).max(10000).optional(),
  costMultiplier: z.number().min(0).max(100).optional(),
});

const aiUsageSchema = z.object({
  provider: z.string().min(1).default("openai"),
  model: z.string().min(1).default("gpt-4o-mini"),
  purpose: z.string().max(60).default("tutor"),
  promptTokens: z.number().int().min(0).default(0),
  completionTokens: z.number().int().min(0).default(0),
  costZar: z.number().min(0).optional(),
});

function scopeInstitutionId(request: any): string | null {
  if (request.user?.role === "superadmin") return request.params?.id ?? request.query?.institutionId ?? null;
  return request.user?.institutionId ?? null;
}

export async function registerAiAdminRoutes(app: FastifyInstance) {
  async function assertScope(request: any, reply: any, id: string): Promise<string | null> {
    const scoped = scopeInstitutionId(request);
    if (!scoped || (request.user.role !== "superadmin" && scoped !== id)) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return null;
    }
    return scoped;
  }

  // -------- config (institution_admin) --------
  app.put("/institutions/:id/ai-config", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await assertScope(request, reply, id);
    if (!scoped) return;
    const parsed = aiConfigSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    const cfg = await setInstitutionAiConfig(id, parsed.data);
    reply.send({ aiConfig: cfg });
  });

  app.get("/institutions/:id/ai-config", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await assertScope(request, reply, id);
    if (!scoped) return;
    const cfg = await getInstitutionAiConfig(id);
    reply.send({ aiConfig: cfg });
  });

  // -------- usage write (learn:ai_tutor caller) --------
  app.post("/institutions/:id/ai/usage", { preHandler: [requireAuth, requirePermission("learn:ai_tutor")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await assertScope(request, reply, id);
    if (!scoped) return;
    const parsed = aiUsageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    // enforcement gate: if the tenant disabled the tutor, refuse the record
    const cfg = sanitizeAiConfig((await getInstitutionAiConfig(id)) as unknown);
    if (!cfg.enabled) return reply.code(403).send({ error: "AI tutor disabled for this institution" });
    await recordAiUsage({
      institutionId: id,
      userId: request.user.sub,
      provider: parsed.data.provider as AiProvider | string,
      model: parsed.data.model,
      purpose: parsed.data.purpose,
      promptTokens: parsed.data.promptTokens,
      completionTokens: parsed.data.completionTokens,
      costZar: parsed.data.costZar ? parsed.data.costZar * cfg.costMultiplier : undefined,
    });
    reply.code(201).send({ ok: true });
  });

  // -------- usage read (analytics:institution) --------
  app.get("/institutions/:id/ai/usage", { preHandler: [requireAuth, requirePermission("analytics:institution")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await assertScope(request, reply, id);
    if (!scoped) return;
    const days = parseDays(request);
    const ai = await getInstitutionAiUsage(id, days);
    reply.send({ institutionId: id, windowDays: days, ai });
  });
}

function parseDays(request: any): number {
  const n = Number(request.query?.days);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.floor(n) : 30;
}