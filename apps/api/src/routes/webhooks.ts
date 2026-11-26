// apps/api/src/routes/webhooks.ts
//
// Institution webhook endpoint management.
//
//   GET    /webhooks             list endpoints (institution-scoped)
//   POST   /webhooks             register an endpoint (secret returned once)
//   PUT    /webhooks/:id         update url / events / active / rotate secret
//   DELETE /webhooks/:id         remove an endpoint
//   POST   /webhooks/test        send a test delivery to an endpoint
//
// Guarded by requireRole("institution_admin"). The caller's institution is
// taken from the JWT (set by the tenant middleware) or an explicit id for
// superadmins.

import { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { enqueueWebhooks } from "../lib/webhooks.js";

const createEndpointSchema = z.object({
  url: z.string().url("Must be a valid https URL"),
  events: z.array(z.string().max(80)).min(1).max(20).default(["+"]),
});
const updateEndpointSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().max(80)).min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});

function scopeInstitutionId(request: any, bodyInstitutionId?: string): string | null {
  if (request.user.role === "superadmin" && bodyInstitutionId) return bodyInstitutionId;
  return request.user.institutionId ?? null;
}

export async function registerWebhookRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requireRole("institution_admin")];

  // GET /webhooks
  app.get("/webhooks", { preHandler: guard }, async (request, reply) => {
    const institutionId = scopeInstitutionId(request);
    if (!institutionId) {
      reply.send({ webhooks: [] });
      return;
    }
    const result = await pool.query(
      `SELECT id::text, url, events, is_active, last_delivered_at, last_status_code, created_at
       FROM webhook_endpoints
       WHERE institution_id = $1
       ORDER BY created_at DESC`,
      [institutionId]
    );
    reply.send({ webhooks: result.rows });
  });

  // POST /webhooks
  app.post("/webhooks", { preHandler: guard }, async (request, reply) => {
    const body = request.body as { url?: string; events?: string[]; institutionId?: string };
    const parsed = createEndpointSchema.safeParse(body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const institutionId = scopeInstitutionId(request, body.institutionId);
    if (!institutionId) {
      reply.code(400).send({ error: "No institution scoped to this account" });
      return;
    }
    const secret = crypto.randomBytes(32).toString("hex");
    const result = await pool.query(
      `INSERT INTO webhook_endpoints (institution_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, url, events, is_active, created_at`,
      [institutionId, parsed.data.url, secret, parsed.data.events]
    );
    reply.code(201).send({
      webhook: result.rows[0],
      secret, // shown once
      signingHeader: "X-SCHOOL-Hmac-SHA256",
      signatureExample: "HMAC-SHA256 over the raw request body",
    });
  });

  // PUT /webhooks/:id
  app.put("/webhooks/:id", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateEndpointSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const institutionId = scopeInstitutionId(request);
    const existing = await pool.query(
      `SELECT id FROM webhook_endpoints WHERE id = $1 AND institution_id = $2`,
      [id, institutionId]
    );
    if (!existing.rows[0]) {
      reply.code(404).send({ error: "Webhook endpoint not found" });
      return;
    }
    const d = parsed.data as any;
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (d.url !== undefined) { sets.push(`url = $${idx}`); values.push(d.url); idx++; }
    if (d.events !== undefined) { sets.push(`events = $${idx}`); values.push(d.events); idx++; }
    if (d.isActive !== undefined) { sets.push(`is_active = $${idx}`); values.push(d.isActive); idx++; }
    if (d.rotateSecret) { sets.push(`secret = $${idx}`); values.push(crypto.randomBytes(32).toString("hex")); idx++; }
    if (sets.length) {
      values.push(id);
      await pool.query(
        `UPDATE webhook_endpoints SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx}`,
        values
      );
    }
    const result = await pool.query(
      `SELECT id::text, url, events, is_active, last_delivered_at, last_status_code, created_at
       FROM webhook_endpoints WHERE id = $1`,
      [id]
    );
    reply.send({ webhook: result.rows[0] });
  });

  // DELETE /webhooks/:id
  app.delete("/webhooks/:id", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const institutionId = scopeInstitutionId(request);
    await pool.query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND institution_id = $2`,
      [id, institutionId]
    );
    reply.send({ ok: true });
  });

  // POST /webhooks/test — send a test ping to one endpoint
  app.post("/webhooks/:id/test", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const institutionId = scopeInstitutionId(request);
    const row = await pool.query(
      `SELECT id::text, institution_id::text FROM webhook_endpoints WHERE id = $1 AND institution_id = $2 AND is_active = TRUE`,
      [id, institutionId]
    );
    if (!row.rows[0]) {
      reply.code(404).send({ error: "Webhook endpoint not found or inactive" });
      return;
    }
    await enqueueWebhooks({
      institutionId: row.rows[0].institution_id,
      event: "custom",
      payload: { ping: true, ts: new Date().toISOString() },
    });
    reply.send({ ok: true, message: "Test delivery enqueued" });
  });
}
