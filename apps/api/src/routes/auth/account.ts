import { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserById, softDeleteUser } from "../../db/users.js";
import { revokeAllSessionsForUser } from "../../db/auth-sessions.js";
import { writeAuditLog } from "../../db/audit-log.js";
import { config } from "../../config.js";
import { requireAuth } from "../../middleware/auth.js";
import { getClientIp } from "./utils.js";

export async function registerAccountRoutes(app: FastifyInstance) {
  app.delete("/auth/account", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = z.object({ password: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Current password is required to delete your account." });
      return;
    }

    const user = await findUserById(request.user.sub);
    if (!user) { reply.code(404).send({ error: "User not found." }); return; }

    const passwordMatch = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!passwordMatch) {
      reply.code(403).send({ error: "Incorrect password. Your account has not been deleted." });
      return;
    }

    void writeAuditLog({
      userId: user.id,
      actorId: user.id,
      action: "auth.account_deleted",
      ipAddress: getClientIp(request),
      userAgent: request.headers["user-agent"] ?? null,
    });

    const anonymisedEmail = `deleted_${user.id}@deleted.invalid`;
    const unguessableHash = await bcrypt.hash(randomUUID(), 12);
    await softDeleteUser(user.id, anonymisedEmail, unguessableHash);
    await revokeAllSessionsForUser(user.id);

    reply
      .clearCookie(config.cookieName, { path: "/" })
      .clearCookie(config.csrfCookieName, { path: "/" })
      .send({ ok: true, message: "Account deleted. You have been signed out." });
  });
}
