import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { findUserById, findUserByEmail } from "../../db/users.js";
import { createAuthToken, consumeAuthToken } from "../../db/auth-tokens.js";
import { updateVerification } from "../../db/users.js";
import { revokeAllSessionsForUser } from "../../db/auth-sessions.js";
import { writeAuditLog } from "../../db/audit-log.js";
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail, buildParentalConsentEmail } from "../../lib/email.js";
import { config } from "../../config.js";
import { requireAuth } from "../../middleware/auth.js";
import { getClientIp } from "./utils.js";
import { pool } from "../../db/pool.js";

export async function sendVerificationEmail(
  logger: { error: (obj: object, msg: string) => void },
  userId: string,
  email: string,
  firstName: string
): Promise<void> {
  try {
    const raw = await createAuthToken(userId, "email_verification");
    const verifyUrl = `${config.siteUrl}/verify-email?token=${raw}`;
    const { subject, html } = buildVerificationEmail(firstName, verifyUrl);
    await sendEmail({ to: email, subject, html });
    await writeAuditLog({ userId, action: "auth.email_verification_sent" });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[auth] send verification email failed");
  }
}

export async function sendParentalConsentEmail(
  logger: { error: (obj: object, msg: string) => void },
  userId: string,
  minorFirstName: string,
  parentEmail: string
): Promise<void> {
  try {
    const raw = await createAuthToken(userId, "parental_consent");
    const consentUrl = `${config.siteUrl}/api/auth/parental-consent?token=${raw}`;
    const { subject, html } = buildParentalConsentEmail(minorFirstName, consentUrl);
    await sendEmail({ to: parentEmail, subject, html });
    await writeAuditLog({ userId, action: "auth.parental_consent_email_sent", metadata: { parentEmail } });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[auth] send parental consent email failed");
  }
}

export async function registerTokenRoutes(app: FastifyInstance) {
  app.post(
    "/auth/verify-email",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const user = await findUserById(request.user.sub);
      if (!user) { reply.code(404).send({ error: "User not found" }); return; }
      if (user.is_email_verified) { reply.send({ ok: true, alreadyVerified: true }); return; }
      void sendVerificationEmail(request.log, user.id, user.email, user.first_name);
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/verify-email/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = z.object({ token: z.string().min(10) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid token" }); return; }

      const result = await consumeAuthToken(parsed.data.token, "email_verification");
      if (!result) { reply.code(400).send({ error: "Token is invalid or has expired" }); return; }

      const user = await findUserById(result.userId);
      if (!user) { reply.code(404).send({ error: "User not found" }); return; }

      await updateVerification(result.userId, {
        is_email_verified: true,
        verification_level: user.is_phone_verified ? "verified" : "basic",
      });
      void writeAuditLog({
        userId: result.userId,
        actorId: result.userId,
        action: "auth.email_verified",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const parsed = z.object({ email: z.string().email() }).safeParse(request.body);
      if (!parsed.success) { reply.send({ ok: true }); return; }

      try {
        const email = parsed.data.email.toLowerCase();
        const user = await findUserByEmail(email);
        if (user) {
          const raw = await createAuthToken(user.id, "password_reset");
          const resetUrl = `${config.siteUrl}/reset-password?token=${raw}`;
          const { subject, html } = buildPasswordResetEmail(user.first_name, resetUrl);
          await sendEmail({ to: user.email, subject, html });
          void writeAuditLog({
            userId: user.id,
            actorId: user.id,
            action: "auth.password_reset_requested",
            ipAddress: getClientIp(request),
            userAgent: request.headers["user-agent"] ?? null,
          });
        }
      } catch (err) {
        request.log.error({ err: err instanceof Error ? err.message : String(err) }, "[auth] forgot-password failed");
      }
      reply.send({ ok: true });
    }
  );

  // Canonical password-reset endpoint (consumes a `password_reset` auth token
  // and sets a new password). The web client at /auth/reset-password posts
  // `{ token, email, password }` here and inspects `body.code === "RESET_INVALID"`
  // to show an expired/invalid-link message.
  app.post(
    "/auth/reset-password",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const parsed = z
        .object({ token: z.string().min(10), email: z.string().email(), password: z.string().min(8) })
        .safeParse(request.body);
      if (!parsed.success) {
        reply
          .code(400)
          .send({ error: "Invalid input", code: "RESET_INVALID", details: parsed.error.flatten() });
        return;
      }

      const result = await consumeAuthToken(parsed.data.token, "password_reset");
      if (!result) {
        reply.code(400).send({ code: "RESET_INVALID", error: "Token is invalid or has expired" });
        return;
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, result.userId]);
      await revokeAllSessionsForUser(result.userId);
      void writeAuditLog({
        userId: result.userId,
        actorId: result.userId,
        action: "auth.password_reset",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/reset-password/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (request, reply) => {
      const parsed = z
        .object({ token: z.string().min(10), password: z.string().min(8) })
        .safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() }); return; }

      const result = await consumeAuthToken(parsed.data.token, "password_reset");
      if (!result) { reply.code(400).send({ error: "Token is invalid or has expired" }); return; }

      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, result.userId]);
      await revokeAllSessionsForUser(result.userId);
      void writeAuditLog({
        userId: result.userId,
        actorId: result.userId,
        action: "auth.password_reset",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.put(
    "/auth/password",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const parsed = z
        .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
        .safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() }); return; }

      const user = await findUserById(request.user.sub);
      if (!user) { reply.code(404).send({ error: "User not found" }); return; }

      const match = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
      if (!match) { reply.code(401).send({ error: "Current password is incorrect" }); return; }

      const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, user.id]);

      void writeAuditLog({
        userId: user.id,
        actorId: user.id,
        action: "auth.password_changed",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/change-email",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 3, timeWindow: "10 minutes" } },
    },
    async (request, reply) => {
      const parsed = z.object({ newEmail: z.string().email().max(254) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid email address" }); return; }

      const newEmail = parsed.data.newEmail.toLowerCase();
      const existing = await findUserByEmail(newEmail);
      if (existing) { reply.code(409).send({ error: "That email address is already in use" }); return; }

      const raw = await createAuthToken(request.user.sub, "email_change", newEmail);
      const confirmUrl = `${config.siteUrl}/confirm-email-change?token=${raw}`;
      const { subject, html } = buildVerificationEmail(request.user.firstName ?? "there", confirmUrl);
      await sendEmail({ to: newEmail, subject: `Confirm your new email — ${subject}`, html });

      void writeAuditLog({
        userId: request.user.sub,
        actorId: request.user.sub,
        action: "auth.email_change_requested",
        metadata: { newEmail },
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/change-email/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = z.object({ token: z.string().min(10) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid token" }); return; }

      const result = await consumeAuthToken(parsed.data.token, "email_change");
      if (!result) { reply.code(400).send({ error: "Token is invalid or has expired" }); return; }

      const newEmail = result.metadata as string | undefined;
      if (!newEmail) { reply.code(400).send({ error: "Token is missing email payload" }); return; }

      await pool.query(
        `UPDATE users SET email = $1, is_email_verified = true WHERE id = $2`,
        [newEmail, result.userId]
      );
      void writeAuditLog({
        userId: result.userId,
        actorId: result.userId,
        action: "auth.email_changed",
        metadata: { newEmail },
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );

  app.post(
    "/auth/parental-consent/confirm",
    { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } },
    async (request, reply) => {
      const parsed = z.object({ token: z.string().min(10) }).safeParse(request.body);
      if (!parsed.success) { reply.code(400).send({ error: "Invalid token" }); return; }

      const result = await consumeAuthToken(parsed.data.token, "parental_consent");
      if (!result) { reply.code(400).send({ error: "Consent link is invalid or has expired" }); return; }

      await pool.query(
        `UPDATE users SET parental_consent_given_at = NOW() WHERE id = $1 AND parental_consent_given_at IS NULL`,
        [result.userId]
      );
      void writeAuditLog({
        userId: result.userId,
        action: "auth.parental_consent_given",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
      });
      reply.send({ ok: true });
    }
  );
}
