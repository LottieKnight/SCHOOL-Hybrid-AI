// apps/api/src/routes/api-keys.ts
//
// REST endpoints for institution API key management.
//
//   GET  /api-keys                     list keys for the caller's institution
//   POST /api-keys                     create a key (returns raw key once)
//   POST /api-keys/:id/revoke          revoke a key
//   POST /api-keys/:id/rotate          rotate a key (returns new raw key)
//
// All endpoints require an authenticated principal with
// `api_keys:manage` permission (institution_admin or superadmin).

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  ApiKeyScope,
} from "../lib/api-keys.js";

const createKeySchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum([
    "read:users",
    "write:users",
    "read:learners",
    "write:learners",
    "read:analytics",
    "read:content",
    "write:content",
    "read:webhooks",
    "write:webhooks",
    "read:institution",
    "write:institution",
  ])).min(1).default(["read:analytics"]),
  rateLimit: z.number().int().min(1).max(10000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export async function registerApiKeyRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requirePermission("api_keys:manage")];

  // Subject the caller to an institution scope. Superadmin may pass institutionId.
  function resolveInstitutionId(request: any): string | null {
    const claimed = request.query?.institutionId;
    if (claimed) {
      return request.user.role === "superadmin" ? String(claimed) : null;
    }
    return request.user.institutionId ?? request.user.sub;
  }

  app.get("/api-keys", { preHandler: guard }, async (request, reply) => {
    const institutionId = resolveInstitutionId(request);
    if (!institutionId) {
      reply.code(400).send({ error: "institutionId required for superadmin, or user must belong to an institution" });
      return;
    }
    const keys = await listApiKeys(institutionId);
    reply.send({ keys: keys.map((k) => ({ ...k, key_hash: undefined })) });
  });

  app.post("/api-keys", { preHandler: guard }, async (request, reply) => {
    const parsed = createKeySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const institutionId = resolveInstitutionId(request);
    if (!institutionId) {
      reply.code(400).send({ error: "institutionId required for superadmin, or user must belong to an institution" });
      return;
    }
    const { record, rawKey } = await createApiKey({
      institutionId,
      name: parsed.data.name,
      scopes: parsed.data.scopes as ApiKeyScope[],
      rateLimit: parsed.data.rateLimit,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    reply.code(201).send({
      key: { ...record, key_hash: undefined },
      rawKey, // shown once — not persisted
      message: "Store this key now; it will not be shown again.",
    });
  });

  app.post("/api-keys/:id/revoke", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const institutionId = resolveInstitutionId(request);
    if (!institutionId) {
      reply.code(400).send({ error: "institutionId required for superadmin, or user must belong to an institution" });
      return;
    }
    const ok = await revokeApiKey(id, institutionId);
    if (!ok) {
      reply.code(404).send({ error: "Key not found or already revoked" });
      return;
    }
    reply.send({ ok: true });
  });

  app.post("/api-keys/:id/rotate", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const institutionId = resolveInstitutionId(request);
    if (!institutionId) {
      reply.code(400).send({ error: "institutionId required for superadmin, or user must belong to an institution" });
      return;
    }
    const result = await rotateApiKey(id, institutionId);
    if (!result) {
      reply.code(404).send({ error: "Key not found or not active" });
      return;
    }
    reply.send({
      key: { ...result.record, key_hash: undefined },
      rawKey: result.rawKey,
      message: "Old key revoked. Store this new key now.",
    });
  });
}
