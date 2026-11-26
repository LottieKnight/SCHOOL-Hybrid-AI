// apps/api/src/routes/audit-export.ts
//
// PopIA §6 accountability evidence: operator export of the audit log for
// regulators / external auditors. Superadmin only. Supports JSON and CSV formats.
//
//   GET /admin/audit-log/export?format=csv|json&from=&to=&action=&userId=
//
// Every export action is itself written to the audit log (auditable trail of access).

import { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { exportAuditLog, auditLogRowsToCsv, writeAuditLog } from "../db/audit-log.js";

export async function registerAuditExportRoutes(app: FastifyInstance) {
  app.get("/admin/audit-log/export", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const query = (request.query ?? {}) as {
      format?: string;
      from?: string;
      to?: string;
      action?: string;
      userId?: string;
      limit?: string;
    };
    const format = query.format === "csv" ? "csv" : "json";

    // Bounded window sanity: enforce from/to for large extraction, never allow a
    // silent full-table crawl without explicit date boundaries beyond the default.
    const { rows, exportedAt } = await exportAuditLog({
      from: query.from,
      to: query.to,
      action: query.action,
      userId: query.userId,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });

    const actor = request.user.sub;
    void writeAuditLog({
      userId: null, actorId: actor, action: "audit.export",
      resourceType: "audit_log", metadata: { format, from: query.from ?? null, to: query.to ?? null, rows: rows.length, exportedAt }, ipAddress: request.ip,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="audit-log-${stamp}.csv"`);
      return reply.send(auditLogRowsToCsv(rows));
    }

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="audit-log-${stamp}.json"`);
    return reply.send({ exportedAt, rows });
  });
}