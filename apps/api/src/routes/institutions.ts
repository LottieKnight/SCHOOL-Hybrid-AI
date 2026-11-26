// apps/api/src/routes/institutions.ts
//
// Institution management CRUD + enterprise settings.
//
//   GET    /institutions                  list institutions (superadmin: all;
//                                         institution_admin: own)
//   POST   /institutions                  create an institution (superadmin)
//   GET    /institutions/:id              get institution + settings
//   PUT    /institutions/:id              update institution + settings
//   DELETE /institutions/:id              deactivate an institution
//   GET    /institutions/:id/users        list institution-scoped users
//
// Access control:
//   - superadmin: any institution
//   - institution_admin: own institution only

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { sanitizeBranding } from "../lib/branding.js";

const createInstitutionSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().max(50).optional(),
  domain: z.string().max(200).optional(),
  type: z.enum(["school", "university", "government", "seta", "corporate"]).default("school"),
  province: z.string().max(100).optional(),
  country: z.string().max(10).default("ZA"),
});

const updateInstitutionSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  shortName: z.string().max(50).optional(),
  domain: z.string().max(200).optional(),
  province: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

const updateSettingsSchema = z.object({
  tier: z.enum(["E1", "E2", "E3", "U1", "U2", "U3", "G1"]).optional(),
  ssoEnabled: z.boolean().optional(),
  ssoProvider: z.enum(["saml", "oauth", "oidc", "ldap"]).nullable().optional(),
  ssoConfig: z.record(z.unknown()).optional(),
  branding: z.record(z.unknown()).optional(),
  featureFlags: z.record(z.unknown()).optional(),
  licenseSeats: z.number().int().min(0).optional(),
  billingCycle: z.enum(["monthly", "semi_annual", "annual", "multi_year", "custom"]).optional(),
});

export async function registerInstitutionRoutes(app: FastifyInstance) {
  const institutionAdminGuard = [
    requireAuth,
    requireRole("institution_admin"),
  ];

  // Determine the institution scope for the caller. Returns null if unset.
  function scopeInstitutionId(request: any): string | null {
    if (request.user.role === "superadmin") {
      const q = request.query?.institutionId || request.params?.id;
      return q ? String(q) : null;
    }
    return request.user.institutionId ?? request.user.sub;
  }

  // GET /institutions
  app.get("/institutions", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    if (request.user.role === "superadmin") {
      const result = await pool.query(
        `SELECT i.*, s.tier, s.license_seats, s.billing_cycle
         FROM institutions i
         LEFT JOIN institution_settings s ON s.institution_id = i.id
         ORDER BY i.name`
      );
      reply.send({ institutions: result.rows });
      return;
    }
    const institutionId = request.user.institutionId;
    if (!institutionId) {
      reply.send({ institutions: [] });
      return;
    }
    const result = await pool.query(
      `SELECT i.*, s.tier, s.license_seats, s.billing_cycle
       FROM institutions i
       LEFT JOIN institution_settings s ON s.institution_id = i.id
       WHERE i.id = $1`,
      [institutionId]
    );
    reply.send({ institutions: result.rows });
  });

  // POST /institutions  (superadmin only)
  app.post("/institutions", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const parsed = createInstitutionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const result = await pool.query(
      `INSERT INTO institutions (name, short_name, domain, type, province, country)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (domain) DO NOTHING
       RETURNING *`,
      [
        parsed.data.name,
        parsed.data.shortName ?? null,
        parsed.data.domain ?? null,
        parsed.data.type,
        parsed.data.province ?? null,
        parsed.data.country,
      ]
    );
    if (!result.rows[0]) {
      reply.code(409).send({ error: "An institution with this domain already exists" });
      return;
    }
    // default enterprise settings
    await pool.query(
      `INSERT INTO institution_settings (institution_id, tier, license_seats, billing_cycle)
       VALUES ($1, 'E1', 0, 'annual')
       ON CONFLICT (institution_id) DO NOTHING`,
      [result.rows[0].id]
    );
    reply.code(201).send({ institution: result.rows[0] });
  });

  // GET /institutions/:id
  app.get("/institutions/:id", { preHandler: institutionAdminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const result = await pool.query(
      `SELECT i.*, s.*
       FROM institutions i
       LEFT JOIN institution_settings s ON s.institution_id = i.id
       WHERE i.id = $1`,
      [id]
    );
    if (!result.rows[0]) {
      reply.code(404).send({ error: "Institution not found" });
      return;
    }
    reply.send({ institution: result.rows[0] });
  });

  // PUT /institutions/:id
  app.put("/institutions/:id", { preHandler: institutionAdminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const parsed = updateInstitutionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      name: "name",
      shortName: "short_name",
      domain: "domain",
      province: "province",
      isActive: "is_active",
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (parsed.data as any)[k];
      if (v !== undefined) {
        fields.push(`${col} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length) {
      values.push(id);
      await pool.query(
        `UPDATE institutions SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
        values
      );
    }
    const result = await pool.query("SELECT * FROM institutions WHERE id = $1", [id]);
    reply.send({ institution: result.rows[0] });
  });

  // DELETE /institutions/:id  (soft deactivate)
  app.delete("/institutions/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query("UPDATE institutions SET is_active = FALSE, updated_at = NOW() WHERE id = $1", [id]);
    reply.send({ ok: true });
  });

  // PUT /institutions/:id/settings  (enterprise settings)
  app.put("/institutions/:id/settings", { preHandler: institutionAdminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data as any;
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const map: Record<string, [string, (v: any) => any]> = {
      tier: ["tier", (v) => v],
      ssoEnabled: ["sso_enabled", (v) => v],
      ssoProvider: ["sso_provider", (v) => v],
      ssoConfig: ["sso_config", (v) => JSON.stringify(v ?? {})],
      branding: ["branding", (v) => JSON.stringify(sanitizeBranding(v))],
      featureFlags: ["feature_flags", (v) => JSON.stringify(v ?? {})],
      licenseSeats: ["license_seats", (v) => v],
      billingCycle: ["billing_cycle", (v) => v],
    };
    for (const [k, [col, trans]] of Object.entries(map)) {
      const v = d[k];
      if (v !== undefined) {
        sets.push(`${col} = $${idx}`);
        values.push(trans(v));
        idx++;
      }
    }
    if (sets.length) {
      values.push(id);
      await pool.query(
        `INSERT INTO institution_settings (institution_id) VALUES ($2)
         ON CONFLICT (institution_id) DO NOTHING`,
        [null, id]
      ).catch(() => {});
      await pool.query(
        `UPDATE institution_settings SET ${sets.join(", ")}, updated_at = NOW() WHERE institution_id = $${idx}`,
        values
      );
    }
    const result = await pool.query(
      "SELECT * FROM institution_settings WHERE institution_id = $1",
      [id]
    );
    reply.send({ settings: result.rows[0] ?? null });
  });

  // GET /institutions/:id/users — list institution-scoped users
  app.get("/institutions/:id/users", { preHandler: institutionAdminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const parsedQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100), offset: z.coerce.number().int().min(0).default(0) }).safeParse(request.query);
    const q = parsedQuery.success ? parsedQuery.data : { limit: 100, offset: 0 };
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, institution_id, plan_type, plan_status, last_active_at, created_at
       FROM users
       WHERE institution_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, q.limit, q.offset]
    );
    reply.send({ users: result.rows });
  });
}
