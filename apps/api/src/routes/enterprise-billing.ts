// apps/api/src/routes/enterprise-billing.ts
//
// Enterprise tier catalogue, quoting, and institutional billing endpoints.
//
//   GET   /enterprise/tiers                public tier catalogue
//   POST  /enterprise/quote                compute an ROI quote (sales tool /
//                                           institution admin)
//   GET   /institutions/:id/billing        current billing for an institution
//   PUT   /institutions/:id/billing        set/reset tier+cycle+seats+contract
//
// Guarded: catalogue is public; quoting requires auth; billing management is
// institution_admin or superadmin.

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { tierCatalog, buildQuote, initQuote, EnterpriseTier } from "../lib/enterprise-billing.js";

const quoteSchema = z.object({
  tier: z.enum(["E1", "E2", "E3", "U1", "U2", "U3", "G1"]),
  learners: z.number().int().min(1).default(500),
  educators: z.number().int().min(0).optional(),
  cycle: z.enum(["monthly", "annual", "multi_year"]).default("annual"),
  years: z.number().int().min(1).max(3).default(1),
  currentAnnualCostZar: z.number().min(0).optional(),
  eligibleForEd: z.boolean().optional(),
});

const setBillingSchema = z.object({
  tier: z.enum(["E1", "E2", "E3", "U1", "U2", "U3", "G1"]),
  billingCycle: z.enum(["monthly", "semi_annual", "annual", "multi_year", "custom"]).default("annual"),
  licenseSeats: z.number().int().min(0).optional(),
  contractStartsAt: z.string().datetime().optional(),
  contractEndsAt: z.string().datetime().optional(),
  learners: z.number().int().min(0).optional(),
});

function scopeInstitutionId(request: any, fallback?: string): string | null {
  if (request.user?.role === "superadmin") return fallback ?? request.query?.institutionId ?? null;
  return request.user?.institutionId ?? null;
}

export async function registerEnterpriseBillingRoutes(app: FastifyInstance) {
  // GET /enterprise/tiers — public catalogue
  app.get("/enterprise/tiers", async (_request, reply) => {
    reply.send({ tiers: tierCatalog() });
  });

  // POST /enterprise/quote — compute quote + ROI
  app.post("/enterprise/quote", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = quoteSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    reply.send({ quote: buildQuote(parsed.data) });
  });

  // GET /institutions/:id/billing
  app.get("/institutions/:id/billing", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const result = await pool.query(
      `SELECT institution_id::text, tier, license_seats, billing_cycle, contract_starts_at, contract_ends_at, feature_flags
       FROM institution_settings WHERE institution_id = $1`,
      [id]
    );
    const row = result.rows[0];
    const tier = (row?.tier ?? "E1") as EnterpriseTier;
    reply.send({
      billing: {
        ...row,
        pricing: initQuote({ tier, cycle: row?.billing_cycle === "annual" ? "annual" : "monthly" }),
      },
    });
  });

  // PUT /institutions/:id/billing — set tier + cycle + seats + contract window
  app.put("/institutions/:id/billing", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const parsed = setBillingSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const pricing = initQuote({ tier: d.tier, cycle: d.billingCycle === "annual" ? "annual" : "monthly", years: 1 });
    await pool.query(
      `INSERT INTO institution_settings (institution_id) VALUES ($1)
       ON CONFLICT (institution_id) DO NOTHING`,
      [id]
    );
    const result = await pool.query(
      `UPDATE institution_settings
       SET tier = $2,
           billing_cycle = $3,
           license_seats = COALESCE($4, license_seats),
           contract_starts_at = COALESCE($5::timestamptz, contract_starts_at, NOW()),
           contract_ends_at = COALESCE($6::timestamptz, contract_ends_at),
           feature_flags = jsonb_set(feature_flags, '{annual_value_zar}', to_jsonb($7::numeric), true),
           updated_at = NOW()
       WHERE institution_id = $1
       RETURNING institution_id::text, tier, license_seats, billing_cycle, contract_starts_at, contract_ends_at`,
      [id, d.tier, d.billingCycle, d.licenseSeats ?? null, d.contractStartsAt ?? null, d.contractEndsAt ?? null, pricing.priceZar]
    );
    reply.send({ billing: result.rows[0], pricing });
  });
}
