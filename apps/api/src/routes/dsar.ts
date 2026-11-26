// apps/api/src/routes/dsar.ts
//
// POPIA §§23–24 Subject Access Request endpoints.
//
// Data subject (self-service):
//   POST /dsar/access     lodge a §23 access (copy of data) request
//   POST /dsar/erasure    lodge a §24 erasure (delete data) request
//   GET  /dsar/mine       list my pending/fulfilled requests
//
// Operator (superadmin / DPO):
//   GET    /admin/dsar                     list requests (SLA-sorted)
//   GET    /admin/dsar/:id                 one request
//   POST   /admin/dsar/:id/fulfill        mark access fulfilled (attach snapshot)
//   POST   /admin/dsar/:id/reject         reject with reason
//   POST   /admin/dsar/:id/erasure        execute §24 erasure on the subject
//   GET    /admin/dsar/export             JSON line-list export (SLA / closure ledger)

import { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  lodgeSubjectAccessRequest,
  listOwnSubjectAccessRequests,
  listAllSubjectAccessRequests,
  fulfillSubjectAccessRequest,
  rejectSubjectAccessRequest,
  eraseSubjectData,
  getSubjectAccessRequest,
  requireRequestorUser,
  DSAR_SLA_DAYS,
} from "../lib/dsar.js";
import { writeAuditLog } from "../db/audit-log.js";
import { sendEmail, buildDsarLodgedEmail } from "../lib/email.js";
import { config } from "../config.js";

// Fire-and-forget: alert the operator (DPO) that a request was lodged so the
// 30-day SLA clock is never missed because nobody saw it. Non-fatal on failure.
function notifyDpoOfDsar(input: {
  requestType: "access" | "erasure";
  requestorUserId: string;
  details?: string | null;
}) {
  if (!config.adminEmails.length) return;
  const { subject, html } = buildDsarLodgedEmail({
    requestType: input.requestType,
    requestorUserId: input.requestorUserId,
    details: input.details ?? null,
    siteUrl: config.siteUrl || config.appUrl,
  });
  void Promise.all(config.adminEmails.map((to) => sendEmail({ to, subject, html }))).catch(() => {});
}

export async function registerDsarRoutes(app: FastifyInstance) {
  // POST /dsar/access
  app.post("/dsar/access", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const body = (request.body ?? {}) as { details?: string };
    const user = await requireRequestorUser(userId);
    if (!user) return reply.code(404).send({ error: "User not found." });

    const record = await lodgeSubjectAccessRequest({
      requestorUserId: userId,
      institutionId: user.institution_id,
      requestType: "access",
      details: body.details ?? null,
      channel: "self-service",
    });
    writeAuditLog({ userId, actorId: userId, action: "admin.action", resourceType: "dsar", resourceId: record.id, metadata: { action: "dsar.lodge_access", slaDays: DSAR_SLA_DAYS } });
    notifyDpoOfDsar({ requestType: "access", requestorUserId: userId, details: body.details ?? null });
    reply.code(201).send({ record });
  });

  // POST /dsar/erasure
  app.post("/dsar/erasure", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const body = (request.body ?? {}) as { details?: string };
    const user = await requireRequestorUser(userId);
    if (!user) return reply.code(404).send({ error: "User not found." });

    const record = await lodgeSubjectAccessRequest({
      requestorUserId: userId,
      institutionId: user.institution_id,
      requestType: "erasure",
      details: body.details ?? null,
      channel: "self-service",
    });
    writeAuditLog({ userId, actorId: userId, action: "admin.action", resourceType: "dsar", resourceId: record.id, metadata: { action: "dsar.lodge_erasure", slaDays: DSAR_SLA_DAYS } });
    notifyDpoOfDsar({ requestType: "erasure", requestorUserId: userId, details: body.details ?? null });
    reply.code(201).send({ record });
  });

  // GET /dsar/mine
  app.get("/dsar/mine", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const records = await listOwnSubjectAccessRequests(userId);
    reply.send({ records });
  });

  // GET /admin/dsar
  app.get("/admin/dsar", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const query = (request.query ?? {}) as { status?: string; limit?: string; offset?: string };
    const result = await listAllSubjectAccessRequests({
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });
    reply.send(result);
  });

  // GET /admin/dsar/:id
  app.get("/admin/dsar/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await getSubjectAccessRequest(id);
    if (!record) return reply.code(404).send({ error: "Request not found." });
    reply.send({ record });
  });

  // POST /admin/dsar/:id/fulfill
  app.post("/admin/dsar/:id/fulfill", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user.sub;
    const body = (request.body ?? {}) as { snapshotPath?: string; notes?: string };

    const existing = await getSubjectAccessRequest(id);
    if (!existing) return reply.code(404).send({ error: "Request not found." });
    if (existing.request_type !== "access") return reply.code(400).send({ error: "Only access requests can be fulfilled this way." });

    const record = await fulfillSubjectAccessRequest({ id, fulfilledBy: actor, snapshotPath: body.snapshotPath ?? null, notes: body.notes ?? null });
    writeAuditLog({ userId: existing.requestor_user_id, actorId: actor, action: "admin.action", resourceType: "dsar", resourceId: id, metadata: { action: "dsar.fulfill_access", snapshot: body.snapshotPath ?? null } });
    reply.send({ record });
  });

  // POST /admin/dsar/:id/reject
  app.post("/admin/dsar/:id/reject", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user.sub;
    const body = (request.body ?? {}) as { notes?: string };

    const existing = await getSubjectAccessRequest(id);
    if (!existing) return reply.code(404).send({ error: "Request not found." });

    const record = await rejectSubjectAccessRequest({ id, fulfilledBy: actor, notes: body.notes ?? null });
    writeAuditLog({ userId: existing.requestor_user_id, actorId: actor, action: "admin.action", resourceType: "dsar", resourceId: id, metadata: { action: "dsar.reject" } });
    reply.send({ record });
  });

  // POST /admin/dsar/:id/erasure
  app.post("/admin/dsar/:id/erasure", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user.sub;
    const body = (request.body ?? {}) as { notes?: string };

    const existing = await getSubjectAccessRequest(id);
    if (!existing) return reply.code(404).send({ error: "Request not found." });
    if (existing.request_type !== "erasure") return reply.code(400).send({ error: "Only erasure requests can be erased this way." });

    const record = await eraseSubjectData({ id, userId: existing.requestor_user_id, erasedBy: actor, notes: body.notes ?? null });
    writeAuditLog({ userId: existing.requestor_user_id, actorId: actor, action: "admin.action", resourceType: "dsar", resourceId: id, metadata: { action: "dsar.erase" } });
    reply.send({ record });
  });

  // GET /admin/dsar/export — JSON line-list for the DPO / regulator.
  app.get("/admin/dsar/export", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const { rows } = await listAllSubjectAccessRequests({ limit: 10000 });
    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="dsar-ledger-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.send({ exportedAt: new Date().toISOString(), slaDays: DSAR_SLA_DAYS, requests: rows });
  });
}