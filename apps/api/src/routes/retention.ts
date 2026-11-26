// apps/api/src/routes/retention.ts
//
// POPIA §14 data-retention policy manifest. Superadmin reads and overrides the
// retention windows enforced by the data-retention cron; every override is audit-logged.
//
//   GET /admin/retention/policies             list policy manifest
//   PUT /admin/retention/policies/:key        override years

import { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { listRetentionPolicies, setRetentionYears, RETENTION_DEFAULTS, type RetentionKey } from "../lib/retention.js";
import { writeAuditLog } from "../db/audit-log.js";

export async function registerRetentionRoutes(app: FastifyInstance) {
  // GET /admin/retention/policies
  app.get("/admin/retention/policies", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const rows = await listRetentionPolicies();
    reply.send({ defaults: RETENTION_DEFAULTS, policies: rows });
  });

  // PUT /admin/retention/policies/:key
  app.put("/admin/retention/policies/:key", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = (request.body ?? {}) as { years?: number };
    const actor = request.user.sub;

    if (!(key in RETENTION_DEFAULTS)) {
      return reply.code(400).send({ error: "Unknown retention policy key." });
    }
    const years = body.years;
    if (typeof years !== "number" || !Number.isFinite(years) || years < 0 || years > 50) {
      return reply.code(400).send({ error: "years must be between 0 and 50." });
    }

    const policy = await setRetentionYears({ policyKey: key as RetentionKey, years, updatedBy: actor });
    if (!policy) return reply.code(404).send({ error: "Policy not found." });

    writeAuditLog({ userId: null, actorId: actor, action: "admin.action", resourceType: "retention_policy", resourceId: key, metadata: { action: "retention.set", years }, ipAddress: request.ip });
    reply.send({ policy });
  });
}