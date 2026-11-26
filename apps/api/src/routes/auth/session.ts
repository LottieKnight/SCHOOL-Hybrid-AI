import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, findUserById, touchLastActiveAt } from "../../db/users.js";
import { getProfile } from "../../db/profile.js";
import { getAccessStatus } from "../../lib/access.js";
import {
  listActiveSessionsForUser,
  revokeAllSessionsForUser,
  revokeSessionById,
  upsertActiveSession,
} from "../../db/auth-sessions.js";
import { listAuthLoginAlerts, markAuthLoginAlertsRead } from "../../db/platform.js";
import { writeAuditLog } from "../../db/audit-log.js";
import { recordDailyUsage } from "../../lib/usage.js";
import { isLoginLocked, recordLoginFailure, clearLoginFailures } from "../../lib/login-lockout.js";
import { config } from "../../config.js";
import { requireAuth } from "../../middleware/auth.js";
import {
  setAuthCookies,
  getClientIp,
  handleAuthServiceError,
  asRecord,
  inferInstitutionShortName,
} from "./utils.js";
import { maybeCreateSuspiciousLoginAlert } from "./registration.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const securityAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function registerSessionRoutes(app: FastifyInstance) {
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const parsed = authSchema.safeParse(request.body);
        if (!parsed.success) {
          reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
          return;
        }

        const email = parsed.data.email.toLowerCase();
        const ipAddress = getClientIp(request);
        const userAgent = request.headers["user-agent"] ?? null;

        if (await isLoginLocked(email)) {
          reply.code(429).send({ error: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes." });
          return;
        }

        const user = await findUserByEmail(email);

        if (!user) {
          await recordLoginFailure(email);
          void writeAuditLog({ action: "auth.login_failed", metadata: { email }, ipAddress, userAgent });
          reply.code(401).send({ error: "Invalid credentials", code: "AUTH_EMAIL_NOT_FOUND" });
          return;
        }

        const match = await bcrypt.compare(parsed.data.password, user.password_hash);
        if (!match) {
          await recordLoginFailure(email);
          void writeAuditLog({ userId: user.id, action: "auth.login_failed", ipAddress, userAgent });
          reply.code(401).send({ error: "Invalid credentials", code: "AUTH_WRONG_PASSWORD" });
          return;
        }

        await clearLoginFailures(email);

        const token = await reply.jwtSign({
          sub: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          planType: user.plan_type,
          planStatus: user.plan_status,
          isEmailVerified: user.is_email_verified,
          isPhoneVerified: user.is_phone_verified,
          verificationLevel: user.verification_level,
          isMinor: user.is_minor,
          institutionId: user.institution_id,
          permissions: user.permissions,
        });
        const csrfToken = randomUUID();
        setAuthCookies(reply, token, csrfToken);

        await maybeCreateSuspiciousLoginAlert({ userId: user.id, sessionId: csrfToken, ipAddress, userAgent });
        await upsertActiveSession({ userId: user.id, sessionId: csrfToken, userAgent, ipAddress });
        touchLastActiveAt(user.id);
        if (user.institution_id) {
          void recordDailyUsage(user.institution_id, { activeUsers: 1, logins: 1, sessions: 1 }).catch(() => {});
        }

        void writeAuditLog({ userId: user.id, actorId: user.id, action: "auth.login", ipAddress, userAgent });

        const access = getAccessStatus(user);
        reply.send({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            isEmailVerified: user.is_email_verified,
            isPhoneVerified: user.is_phone_verified,
            verificationLevel: user.verification_level,
          },
          access,
          csrfToken,
          token,
        });
      } catch (error) {
        handleAuthServiceError(reply, error, "login");
      }
    }
  );

  app.post("/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const sessionId = request.cookies[config.csrfCookieName];
    if (sessionId) {
      await revokeSessionById({ userId: request.user.sub, sessionId });
    }
    void writeAuditLog({
      userId: request.user.sub,
      actorId: request.user.sub,
      action: "auth.logout",
      ipAddress: getClientIp(request),
      userAgent: request.headers["user-agent"] ?? null,
    });
    reply.clearCookie(config.cookieName, { path: "/" });
    reply.clearCookie(config.csrfCookieName, { path: "/" });
    reply.send({ ok: true });
  });

  app.get("/auth/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const sessions = await listActiveSessionsForUser(request.user.sub);
    reply.send({ sessions });
  });

  app.delete("/auth/sessions/:sessionId", { preHandler: requireAuth }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    await revokeSessionById({ userId: request.user.sub, sessionId });
    reply.send({ ok: true });
  });

  app.post("/auth/sessions/revoke-all", { preHandler: requireAuth }, async (request, reply) => {
    await revokeAllSessionsForUser(request.user.sub);
    void writeAuditLog({
      userId: request.user.sub,
      actorId: request.user.sub,
      action: "auth.sessions_revoked",
      ipAddress: getClientIp(request),
      userAgent: request.headers["user-agent"] ?? null,
    });
    reply.clearCookie(config.cookieName, { path: "/" });
    reply.clearCookie(config.csrfCookieName, { path: "/" });
    reply.send({ ok: true });
  });

  app.get("/auth/session", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const user = await findUserById(request.user.sub);
      if (!user) { reply.code(401).send({ error: "Unauthorized" }); return; }

      const profile = await getProfile(user.id).catch(() => null);
      const academics = asRecord(asRecord(profile?.app_preferences).academics);
      const institutionName =
        typeof academics.institution === "string" && academics.institution.trim().length > 0
          ? academics.institution.trim()
          : null;
      const access = getAccessStatus(user);
      reply.send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          studyType:
            academics.studyType === "school" || academics.studyType === "university"
              ? academics.studyType
              : null,
          grade: academics.studyType === "school" ? academics.grade ?? null : null,
          phase: academics.studyType === "school" ? academics.phase ?? null : null,
          institutionName,
          institutionShortName: inferInstitutionShortName(institutionName),
          course:
            academics.studyType === "university" && typeof academics.course === "string"
              ? academics.course
              : null,
          isEmailVerified: user.is_email_verified,
          isPhoneVerified: user.is_phone_verified,
          verificationLevel: user.verification_level,
        },
        access,
        csrfToken: request.cookies[config.csrfCookieName] ?? "",
        token:
          typeof request.headers.authorization === "string" &&
          request.headers.authorization.toLowerCase().startsWith("bearer ")
            ? request.headers.authorization.slice(7).trim()
            : null,
      });
    } catch (error) {
      handleAuthServiceError(reply, error, "session");
    }
  });

  app.get("/auth/security-alerts", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = securityAlertsQuerySchema.safeParse(request.query);
    if (!parsed.success) { reply.code(400).send({ error: "Invalid query", details: parsed.error.flatten() }); return; }
    const alerts = await listAuthLoginAlerts(request.user.sub, parsed.data.limit ?? 30);
    reply.send({ alerts });
  });

  app.post("/auth/security-alerts/read-all", { preHandler: requireAuth }, async (request, reply) => {
    await markAuthLoginAlertsRead(request.user.sub);
    reply.send({ ok: true });
  });
}
