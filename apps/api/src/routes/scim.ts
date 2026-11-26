// apps/api/src/routes/scim.ts
//
// SCIM 2.0 (RFC 7643/7644) server endpoints for enterprise identity
// provisioning. Authenticated by a per-institution SCIM API key presented as
// `Authorization: Bearer schl_...` (scope `scim:provisioning`).
//
// Discoverable endpoints (Azure AD / Okta / Google auto-discover these):
//   GET  /scim/v2/ServiceProviderConfig
//   GET  /scim/v2/ResourceTypes[/:name]
//   GET  /scim/v2/Schemas[/:id]
// Users:
//   GET  /scim/v2/Users[/:id]      (list + filter userName/externalId)
//   POST /scim/v2/Users            (create)
//   PUT  /scim/v2/Users/:id        (replace)
//   PATCH /scim/v2/Users/:id       (patch active / name / emails)
//   DELETE /scim/v2/Users/:id      (de-provision)
// Groups:
//   GET /scim/v2/Groups[/:id]
//   POST /scim/v2/Groups
//   PUT /scim/v2/Groups/:id
//   DELETE /scim/v2/Groups/:id

import { FastifyInstance } from "fastify";
import { authenticateApiKey } from "../lib/api-keys.js";
import {
  SCIM_USER_SCHEMA,
  SCIM_GROUP_SCHEMA,
  SCIM_RESOURCE,
  SCIM_LIST,
  SCIM_ERROR,
  schoolToScimUser,
  provisionUser,
  deprovisionUser,
  getScimGroup,
  listScimGroups,
  upsertScimGroup,
  groupMembers,
  logScimEvent,
  ScimUserResource,
  ScimGroupResource,
  scimError,
} from "../lib/scim.js";
import { pool } from "../db/pool.js";
import { findUserByExternalId } from "../db/users.js";

const SCIM_BASE = "/scim/v2";

/**
 * Resolve the SCIM tenant principal from the Authorization header. Requires a
 * valid `scim:provisioning` API key; returns the institution uuid scope.
 */
async function resolveScimPrincipal(request: any): Promise<{ institutionId: string } | null> {
  const auth = request.headers.authorization as string | undefined;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const rawKey = auth.slice("Bearer ".length).trim();
  if (!rawKey.startsWith("schl_")) return null;
  const principal = await authenticateApiKey(rawKey);
  if (!principal || !principal.institutionId) return null;
  if (!principal.permissions.includes("institution:manage_users")) return null;
  return { institutionId: principal.institutionId };
}

function scimErrReply(reply: any, err: any) {
  const status = err?.status ?? 500;
  reply.code(status);
  return {
    schemas: [SCIM_ERROR],
    status: String(status),
    detail: err?.message ?? "SCIM operation failed",
    ...(err?.scimType ? { scimType: err.scimType } : {}),
  };
}

export async function registerScimRoutes(app: FastifyInstance) {
  async function scimAuthHook(request: any, reply: any) {
    const principal = await resolveScimPrincipal(request);
    if (!principal) {
      reply.code(401);
      return reply.send({
        schemas: [SCIM_ERROR],
        status: "401",
        detail: "Unauthorized - valid SCIM API key required",
      });
    }
    request.scimInstitutionId = principal.institutionId;
  }

  // ---------- Discovery ----------
  app.get(`${SCIM_BASE}/ServiceProviderConfig`, { preHandler: scimAuthHook }, async (_request, reply) => {
    reply.send({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      documentationUri: "https://school.ac.za/docs/scim",
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: true },
      authenticationSchemes: [
        { name: "OAuth Bearer Token", description: "SCIM token in Authorization Bearer header", specUri: "", type: "oauthbearertoken", primary: true },
      ],
    });
  });

  // ResourceTypes — the two we support
  app.get(`${SCIM_BASE}/ResourceTypes`, { preHandler: scimAuthHook }, async (_request, reply) => {
    reply.send({
      schemas: [SCIM_RESOURCE],
      totalResults: 2,
      Resources: [
        {
          schemas: [SCIM_RESOURCE],
          id: "User", name: "User", endpoint: `${SCIM_BASE}/Users`,
          schema: SCIM_USER_SCHEMA,
          meta: { resourceType: "ResourceType", location: `${SCIM_BASE}/ResourceTypes/User` },
        },
        {
          schemas: [SCIM_RESOURCE],
          id: "Group", name: "Group", endpoint: `${SCIM_BASE}/Groups`,
          schema: SCIM_GROUP_SCHEMA,
          meta: { resourceType: "ResourceType", location: `${SCIM_BASE}/ResourceTypes/Group` },
        },
      ],
    });
  });

  app.get(`${SCIM_BASE}/ResourceTypes/:name`, { preHandler: scimAuthHook }, async (request, reply) => {
    const name = (request.params as any).name;
    const map: any = {
      User: { id: "User", name: "User", endpoint: `${SCIM_BASE}/Users`, schema: SCIM_USER_SCHEMA },
      Group: { id: "Group", name: "Group", endpoint: `${SCIM_BASE}/Groups`, schema: SCIM_GROUP_SCHEMA },
    };
    const r = map[name];
    if (!r) return reply.code(404).send(scimErrReply(reply, scimError(404, "ResourceType not found")));
    reply.send({ schemas: [SCIM_RESOURCE], ...r, meta: { resourceType: "ResourceType" } });
  });

  app.get(`${SCIM_BASE}/Schemas`, { preHandler: scimAuthHook }, async (_request, reply) => {
    reply.send({
      schemas: [SCIM_RESOURCE],
      totalResults: 2,
      Resources: [
        { schemas: [SCIM_USER_SCHEMA], id: SCIM_USER_SCHEMA, name: "User", attributes: [{ name: "id", type: "string" }, { name: "userName", type: "string" }, { name: "active", type: "boolean" }] },
        { schemas: [SCIM_GROUP_SCHEMA], id: SCIM_GROUP_SCHEMA, name: "Group", attributes: [{ name: "id", type: "string" }, { name: "displayName", type: "string" }] },
      ],
    });
  });

  // ---------- Users ----------
  app.get(`${SCIM_BASE}/Users`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { filter } = request.query as { filter?: string };
    let sql = `SELECT ${userCols()} FROM users WHERE institution_id = $1 AND external_id IS NOT NULL`;
    const params: any[] = [inst];
    if (filter) {
      const m = filter.match(/userName eq "([^"]+)"/i);
      if (m) { params.push(m[1]); sql += ` AND email = $${params.length}`; }
    }
    const result = await pool.query(sql + " ORDER BY created_at ASC LIMIT 200", params);
    const Resources = result.rows.map((r) => schoolToScimUser(r));
    reply.send({ schemas: [SCIM_LIST], totalResults: Resources.length, itemsPerPage: Resources.length, startIndex: 1, Resources });
  });

  app.get(`${SCIM_BASE}/Users/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    const user = await findUserByExternalId(inst, id);
    if (!user) return reply.code(404).send(scimErrReply(reply, scimError(404, "User not found")));
    reply.send(schoolToScimUser(user as any));
  });

  app.post(`${SCIM_BASE}/Users`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const resource = request.body as ScimUserResource;
    try {
      const { user, created } = await provisionUser(inst, resource);
      reply.code(created ? 201 : 200).send(schoolToScimUser(user));
    } catch (e: any) {
      reply.status(e?.status ?? 400);
      return scimErrReply(reply, e);
    }
  });

  app.put(`${SCIM_BASE}/Users/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    const resource = request.body as ScimUserResource;
    resource.externalId = resource.externalId || id;
    const existing = await findUserByExternalId(inst, resource.externalId);
    if (!existing && resource.externalId !== id) {
      const byId = await findUserByExternalId(inst, id);
      if (!byId) return reply.code(404).send(scimErrReply(reply, scimError(404, "User not found")));
    }
    try {
      const { user } = await provisionUser(inst, resource);
      reply.send(schoolToScimUser(user));
    } catch (e: any) {
      reply.status(e?.status ?? 400);
      return scimErrReply(reply, e);
    }
  });

  app.patch(`${SCIM_BASE}/Users/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    const user = await findUserByExternalId(inst, id);
    if (!user) return reply.code(404).send(scimErrReply(reply, scimError(404, "User not found")));
    const op = request.body as { schemas: string[]; Operations: Array<{ op: string; path?: string; value: any }> };
    const needed: Partial<{ email: string; firstName: string; lastName: string; active: boolean }> = {};
    for (const o of op?.Operations ?? []) {
      const path = (o.path ?? "").toLowerCase();
      if (o.op.toLowerCase() === "replace") {
        if (path === "name.givenname") needed.firstName = o.value;
        else if (path === "name.familyname") needed.lastName = o.value;
        else if (path === "emails") needed.email = Array.isArray(o.value) ? o.value[0]?.value : o.value?.value;
        else if (o.value?.givenName !== undefined) needed.firstName = o.value.givenName;
        else if (o.value?.familyName !== undefined) needed.lastName = o.value.familyName;
        else if (o.value?.userName !== undefined) needed.email = o.value.userName;
        else if (o.value !== undefined && typeof o.value === "object") {
          // merge-op style object
          if (o.value.name?.givenName) needed.firstName = o.value.name.givenName;
          if (o.value.name?.familyName) needed.lastName = o.value.name.familyName;
        }
        if (path === "active") {
          if (o.value === false) {
            await deprovisionUser(inst, id);
            reply.send({ schemas: [SCIM_USER_SCHEMA], id, externalId: id, active: false, meta: { resourceType: "User" } });
            return;
          }
          needed.active = true;
        }
      }
    }
    if (needed.email || needed.firstName || needed.lastName) {
      await pool.query(
        `UPDATE users SET email = COALESCE($2, email), first_name = COALESCE($3, first_name),
                last_name = COALESCE($4, last_name)
         WHERE id = $1`,
        [user.id, needed.email ?? null, needed.firstName ?? null, needed.lastName ?? null]
      );
      await logScimEvent(inst, "patchUser", "User", id, user.id, op as any);
    }
    const updated = await findUserByExternalId(inst, id);
    reply.send(schoolToScimUser(updated as any));
  });

  app.delete(`${SCIM_BASE}/Users/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    await deprovisionUser(inst, id);
    reply.code(204).send();
  });

  // ---------- Groups ----------
  app.get(`${SCIM_BASE}/Groups`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const groups = await listScimGroups(inst);
    const Records: ScimGroupResource[] = [];
    for (const g of groups) {
      const members = await groupMembers(inst, g.id);
      Records.push({
        schemas: [SCIM_GROUP_SCHEMA],
        id: g.external_id,
        externalId: g.external_id,
        displayName: g.display_name,
        members,
        meta: { resourceType: "Group" },
      });
    }
    reply.send({ schemas: [SCIM_LIST], totalResults: Records.length, itemsPerPage: Records.length, startIndex: 1, Resources: Records });
  });

  app.get(`${SCIM_BASE}/Groups/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    const g = await getScimGroup(inst, id);
    if (!g) return reply.code(404).send(scimErrReply(reply, scimError(404, "Group not found")));
    reply.send({
      schemas: [SCIM_GROUP_SCHEMA],
      id: g.external_id,
      externalId: g.external_id,
      displayName: g.display_name,
      members: await groupMembers(inst, g.id),
      meta: { resourceType: "Group" },
    });
  });

  app.post(`${SCIM_BASE}/Groups`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const resource = request.body as ScimGroupResource;
    if (!resource.externalId || !resource.displayName) {
      return reply.code(400).send(scimErrReply(reply, scimError(400, "externalId and displayName required")));
    }
    await upsertScimGroup(inst, resource.externalId, resource.displayName);
    await logScimEvent(inst, "createGroup", "Group", resource.externalId, null, resource as any);
    reply.send({
      schemas: [SCIM_GROUP_SCHEMA],
      id: resource.externalId, externalId: resource.externalId, displayName: resource.displayName,
      members: resource.members ?? [],
      meta: { resourceType: "Group" },
    } as any);
  });

  app.delete(`${SCIM_BASE}/Groups/:id`, { preHandler: scimAuthHook }, async (request, reply) => {
    const inst = (request as any).scimInstitutionId;
    const { id } = request.params as { id: string };
    await pool.query(
      `DELETE FROM scim_groups WHERE institution_id = $1 AND external_id = $2`,
      [inst, id]
    );
    reply.code(204).send();
  });
}

function userCols(): string {
  return "id, email, first_name, last_name, role, external_id, institution_id";
}