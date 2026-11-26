// apps/api/src/routes/public-branding.ts
//
// Public, unauthenticated white-label theme endpoints (Phase 2.3).
//
// The web login page must restyle itself *before* a visitor authenticates, so
// these endpoints resolve a tenant from the request host (custom_domain or
// subdomain) or an explicit institution id and return the sanitised branding.
// No auth: the response is intentionally non-sensitive theme metadata only.

import { FastifyInstance } from "fastify";
import { pool } from "../db/pool.js";
import { resolveInstitutionByHost, getInstitutionBranding, DEFAULT_BRANDING } from "../lib/branding.js";

export async function registerPublicBrandingRoutes(app: FastifyInstance) {
  // GET /public/branding            resolve tenant from host (default fallback)
  // GET /public/branding/:id        resolve by explicit institution id
  app.get("/public/branding", async (request, reply) => {
    const q = request.query as { institutionId?: string; force?: string };
    let institutionId: string | null = typeof q.institutionId === "string" && q.institutionId ? q.institutionId : null;
    let institution: { id: string; name: string } | null = null;

    if (!institutionId) {
      const host = request.headers?.host ?? "";
      institution = await resolveInstitutionByHost(host);
      institutionId = institution?.id ?? null;
    }

    if (!institution) {
      // try explicit id lookup shared with getInstitutionBranding
      if (institutionId) {
        const row = await pool.query(
          `SELECT i.id::text, i.name FROM institutions i WHERE i.id = $1 AND i.is_active = TRUE`,
          [institutionId]
        );
        institution = row.rows[0] ?? null;
      }
      if (!institution) {
        reply.send({ institution: null, branding: DEFAULT_BRANDING });
        return;
      }
    }

    const branding = await getInstitutionBranding(institution.id);
    reply.send({ institution, branding: branding ?? DEFAULT_BRANDING });
  });

  app.get("/public/branding/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await pool.query(
      `SELECT i.id::text, i.name FROM institutions i WHERE i.id = $1 AND i.is_active = TRUE`,
      [id]
    );
    if (!row.rows[0]) {
      reply.code(404).send({ error: "Institution not found" });
      return;
    }
    const branding = await getInstitutionBranding(id);
    reply.send({ institution: row.rows[0], branding: branding ?? DEFAULT_BRANDING });
  });
}