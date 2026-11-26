// apps/api/src/routes/lti.ts
//
// LTI 1.3 Tool endpoints (Phase 2.3) — SCHOOL as the Tool, institutional LMS as
// the Platform.
//
//   GET  /lti/login_initiation   Platform-initiated login (browser redirect; open)
//                                ?iss & ?client_id & ?login_hint & ?target_link_uri ...
//   POST /lti/launch              Resource-link launch (form id_token + state; open,
//                                authenticity = signed JWT + one-time nonce)
//   GET  /lti/registrations       list an institution's LTI registrations (admin)
//   PUT  /lti/registrations/:_    create/update a registration (institution_admin)
//   DELETE /lti/registrations/:_  remove a registration (institution_admin)

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { config } from "../config.js";
import { findUserByEmail, createUser, touchLastActiveAt } from "../db/users.js";
import {
  listLtiRegistrations,
  buildLtiLoginInitiation,
  ltiVerifyState,
  verifyLtiLaunch,
} from "../lib/lti.js";
import { writeAuditLog } from "../db/audit-log.js";

const regSchema = z.object({
  issuer: z.string().url(),
  clientId: z.string().min(1),
  platformName: z.string().min(1).default("LMS"),
  authLoginUrl: z.string().url(),
  authTokenUrl: z.string().url(),
  jwksUrl: z.string().url(),
  deploymentId: z.string().optional(),
  toolContext: z.string().default("lesson"),
  claimNonceTtlSec: z.number().int().min(60).max(3600).default(600),
});

function scopeInstitutionId(request: any): string | null {
  if (request.user?.role === "superadmin") return request.query?.institutionId ?? null;
  return request.user?.institutionId ?? null;
}

export async function registerLtiRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { iss?: string; client_id?: string; login_hint?: string; target_link_uri?: string; lti_message_hint?: string } }>(
    "/lti/login_initiation",
    async (request, reply) => {
      const { iss, client_id: clientId, login_hint: loginHint, target_link_uri: targetUri, lti_message_hint: ltiHint } = request.query;
      if (!iss || !clientId || !loginHint || !targetUri) {
        reply.code(400).send({ error: "Missing required LTI login parameters" });
        return;
      }
      // resolve the registration across institutions keyed on (iss, client_id)
      const regs = await pool.query(
        `SELECT id::text, institution_id::text, issuer, client_id, platform_name, auth_login_url,
                auth_token_url, jwks_url, deployment_id, tool_context, claim_nonce_ttl_sec
         FROM lti_registrations WHERE issuer = $1 AND client_id = $2 LIMIT 1`,
        [iss, clientId]
      );
      const reg = regs.rows[0] ?? null;
      if (!reg) { reply.code(401).send({ error: "Unknown LTI platform/client" }); return; }
      try {
        const { url } = await buildLtiLoginInitiation(reg, {
          iss, login_hint: loginHint, target_link_uri: targetUri, client_id: clientId, lti_message_hint: ltiHint,
        });
        await writeAuditLog({
          userId: null,
          actorId: null,
          action: "admin.action",
          resourceType: "lti",
          resourceId: reg.id,
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"] ?? null,
          metadata: { op: "login_initiation", issuer: iss, client_id: clientId, institutionId: String(reg.institution_id) },
        });
        reply.redirect(url);
      } catch (e: any) {
        reply.code(400).send({ error: "LTI login initiation failed", detail: e.message });
      }
    }
  );

  // ---------- Resource-link launch ----------
  app.post<{ Body: { id_token?: string; state?: string } }>("/lti/launch", async (request, reply) => {
    const { id_token: idToken, state } = request.body ?? {};
    if (!idToken || !state) { reply.code(400).send({ error: "Missing id_token/state" }); return; }

    const st = ltiVerifyState(state);
    if (!st?.reg) { reply.code(401).send({ error: "Invalid launch state" }); return; }
    const reg = (await pool.query(
      `SELECT id::text, institution_id::text, issuer, client_id, platform_name, auth_login_url,
              auth_token_url, jwks_url, deployment_id, tool_context, claim_nonce_ttl_sec
       FROM lti_registrations WHERE id = $1`, [st.reg]
    )).rows[0] ?? null;
    if (!reg) { reply.code(401).send({ error: "Registration not found" }); return; }

    try {
      const launch = await verifyLtiLaunch(reg, idToken, state, {
        azp: undefined,
        deployment_id: reg.deployment_id ?? undefined,
      });
      // provision the user in the institution
      let user = await findUserByEmail(launch.userEmail);
      if (!user) {
        user = await createUser(launch.userEmail, "", launch.firstName, launch.lastName, "", launch.role, null);
        await pool.query(
          `UPDATE users SET institution_id = $2, is_email_verified = TRUE, password_hash = gen_random_uuid()::text
           WHERE id = $1`, [user.id, launch.institutionId]
        );
      } else if (user.institution_id !== launch.institutionId) {
        throw new Error("LTI: email already belongs to another institution");
      }
      await touchLastActiveAt(user.id);

      await pool.query(
        `INSERT INTO lti_launch_events (institution_id, registration_id, user_id, issuer, client_id, deployment_id, resource_link_id, context_title, roles_lis)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [launch.institutionId, reg.id, user.id, reg.issuer, reg.client_id, launch.deploymentId, launch.resourceLinkId, launch.contextTitle, launch.role]
      );

      // success: redirect to the tool surface (per-institution branding ready)
      const target = `${config.appUrl}/lti/${reg.tool_context ?? "lesson"}?user=${user.id}&institution=${launch.institutionId}`;
      reply.redirect(target);
    } catch (e: any) {
      reply.code(401).send({ error: "LTI launch rejected", detail: e.message });
    }
  });

  // ---------- Registration admin CRUD (institution_admin) ----------
  app.get("/lti/registrations", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const inst = scopeInstitutionId(request);
    if (!inst) return reply.code(403).send({ error: "Unknown institution" });
    reply.send({ registrations: await listLtiRegistrations(inst) });
  });

  app.put("/lti/registrations", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const inst = scopeInstitutionId(request);
    if (!inst) return reply.code(403).send({ error: "Unknown institution" });
    const parsed = regSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    const d = parsed.data;
    const result = await pool.query(
      `INSERT INTO lti_registrations (institution_id, issuer, client_id, platform_name, auth_login_url, auth_token_url, jwks_url, deployment_id, tool_context, claim_nonce_ttl_sec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (institution_id, issuer, client_id) DO UPDATE SET
         platform_name = EXCLUDED.platform_name,
         auth_login_url = EXCLUDED.auth_login_url,
         auth_token_url = EXCLUDED.auth_token_url,
         jwks_url = EXCLUDED.jwks_url,
         deployment_id = EXCLUDED.deployment_id,
         tool_context = EXCLUDED.tool_context,
         updated_at = NOW()
       RETURNING id::text, platform_name`,
      [inst, d.issuer, d.clientId, d.platformName, d.authLoginUrl, d.authTokenUrl, d.jwksUrl, d.deploymentId ?? null, d.toolContext, d.claimNonceTtlSec]
    );
    reply.send({ registration: result.rows[0] });
  });

  app.delete("/lti/registrations/:id", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const inst = scopeInstitutionId(request);
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM lti_registrations WHERE id = $1 AND institution_id = $2`, [id, inst]);
    reply.send({ ok: true });
  });
}