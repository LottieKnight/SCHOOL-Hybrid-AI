import { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { isAdminPrincipal } from "../../lib/admin-access.js";
import { generateTotpSecret, buildTotpUri, verifyTotp } from "../../lib/totp.js";
import { writeAuditLog } from "../../db/audit-log.js";
import { pool } from "../../db/pool.js";
import { getClientIp } from "./utils.js";

export async function registerTotpRoutes(app: FastifyInstance) {
  /**
   * GET /auth/totp/setup
   * Admin only. Generates a new TOTP secret and returns the otpauth URI.
   * The secret is stored in pending state (totp_enabled = false) until confirmed.
   */
  app.get(
    "/auth/totp/setup",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      if (!isAdminPrincipal({ role: request.user.role, email: request.user.email })) {
        reply.code(403).send({ error: "Admin access required" });
        return;
      }

      const secret = generateTotpSecret();
      const uri = buildTotpUri(secret, request.user.email ?? "admin");

      await pool.query(`UPDATE users SET totp_secret = $1, totp_enabled = false WHERE id = $2`, [secret, request.user.sub]);

      reply.send({ secret, uri });
    }
  );

  /**
   * POST /auth/totp/confirm
   * Admin only. Confirms TOTP enrollment by verifying a code from the authenticator app.
   */
  app.post(
    "/auth/totp/confirm",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      if (!isAdminPrincipal({ role: request.user.role, email: request.user.email })) {
        reply.code(403).send({ error: "Admin access required" });
        return;
      }

      const parsed = z.object({ code: z.string().length(6) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid code format" }); return; }

      const row = await pool.query<{ totp_secret: string | null }>(
        `SELECT totp_secret FROM users WHERE id = $1`,
        [request.user.sub]
      );
      const secret = row.rows[0]?.totp_secret;
      if (!secret) { reply.code(400).send({ error: "No pending TOTP setup. Call /auth/totp/setup first." }); return; }

      if (!verifyTotp(secret, parsed.data.code)) {
        reply.code(400).send({ error: "Incorrect code. Try again." });
        return;
      }

      await pool.query(`UPDATE users SET totp_enabled = true WHERE id = $1`, [request.user.sub]);
      void writeAuditLog({
        userId: request.user.sub,
        actorId: request.user.sub,
        action: "auth.totp_enabled",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  /**
   * DELETE /auth/totp
   * Admin only. Disables TOTP for the current admin account.
   */
  app.delete(
    "/auth/totp",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      if (!isAdminPrincipal({ role: request.user.role, email: request.user.email })) {
        reply.code(403).send({ error: "Admin access required" });
        return;
      }

      await pool.query(`UPDATE users SET totp_secret = NULL, totp_enabled = false WHERE id = $1`, [request.user.sub]);
      void writeAuditLog({
        userId: request.user.sub,
        actorId: request.user.sub,
        action: "auth.totp_disabled",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  /**
   * POST /auth/totp/verify
   * Used post-login to satisfy TOTP challenge. The frontend calls this after a
   * successful password login when totp_enabled = true for the user.
   * A separate "totp_verified" claim is issued in the JWT on success.
   */
  app.post(
    "/auth/totp/verify",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 10, timeWindow: "5 minutes" } },
    },
    async (request, reply) => {
      const parsed = z.object({ code: z.string().length(6) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid code format" }); return; }

      const row = await pool.query<{ totp_secret: string | null; totp_enabled: boolean }>(
        `SELECT totp_secret, totp_enabled FROM users WHERE id = $1`,
        [request.user.sub]
      );
      const user = row.rows[0];
      if (!user?.totp_enabled || !user.totp_secret) {
        reply.send({ ok: true, totpRequired: false });
        return;
      }

      if (!verifyTotp(user.totp_secret, parsed.data.code)) {
        reply.code(401).send({ error: "Incorrect TOTP code." });
        return;
      }

      void writeAuditLog({
        userId: request.user.sub,
        actorId: request.user.sub,
        action: "auth.totp_verified",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true, totpRequired: false });
    }
  );
}
