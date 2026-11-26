// apps/api/src/routes/analytics/institution.ts
//
// Institutional usage dashboard endpoints (Phase 3.1) — the analytics surface a
// contract holder (institution_admin/educator) or a `read:analytics` API key can
// view, scoped to one institution. Time-series, headline totals, AI spend and
// seat utilisation.
//
//   GET /institutions/:id/analytics/summary       headline totals (30d)
//   GET /institutions/:id/analytics/usage         daily time-series (30d)
//   GET /institutions/:id/analytics/ai            AI token/cost breakdown
//   GET /institutions/:id/analytics/seats         licence seat utilisation

import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import {
  getInstitutionUsage,
  getInstitutionUsageTotals,
  getInstitutionAiUsage,
  getSeatUtilisation,
} from "../../lib/usage.js";

function scopeInstitutionId(request: any): string | null {
  // a read:analytics API key principal (set by tenant middleware) is honoured
  if (request.apiKeyPrincipal?.institutionId && request.apiKeyPrincipal.permissions?.includes("analytics:institution")) {
    return request.apiKeyPrincipal.institutionId;
  }
  if (request.user?.role === "superadmin") return request.query?.institutionId ?? request.params?.id ?? null;
  return request.user?.institutionId ?? null;
}

export async function registerInstitutionAnalyticsRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requirePermission("analytics:institution")];

  // Resolve + verify the requested institution is the caller's scope.
  async function resolveScope(request: any, reply: any, id: string): Promise<string | null> {
    const scoped = scopeInstitutionId(request);
    if (!scoped || (request.user?.role !== "superadmin" && scoped !== id)) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return null;
    }
    return scoped;
  }

  app.get("/institutions/:id/analytics/summary", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await resolveScope(request, reply, id);
    if (!scoped) return;
    const days = parseDays(request);
    const [totals, ai, seats] = await Promise.all([
      getInstitutionUsageTotals(id, days),
      getInstitutionAiUsage(id, days),
      getSeatUtilisation(id),
    ]);
    reply.send({ institutionId: id, windowDays: days, totals, ai, seats });
  });

  app.get("/institutions/:id/analytics/usage", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await resolveScope(request, reply, id);
    if (!scoped) return;
    const days = parseDays(request);
    const series = await getInstitutionUsage(id, days);
    reply.send({ institutionId: id, windowDays: days, series });
  });

  app.get("/institutions/:id/analytics/ai", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await resolveScope(request, reply, id);
    if (!scoped) return;
    const days = parseDays(request);
    const ai = await getInstitutionAiUsage(id, days);
    reply.send({ institutionId: id, windowDays: days, ai });
  });

  app.get("/institutions/:id/analytics/seats", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = await resolveScope(request, reply, id);
    if (!scoped) return;
    const seats = await getSeatUtilisation(id);
    reply.send({ institutionId: id, seats });
  });
}

function parseDays(request: any): number {
  const raw = request.query?.days;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 365) return Math.floor(n);
  return 30;
}