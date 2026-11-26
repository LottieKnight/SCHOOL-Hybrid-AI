import { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getOrCreateReferralCode, getReferralStats } from "../db/referrals.js";
import { config } from "../config.js";

function buildShareUrl(code: string): string {
  const base = config.corsOrigin.split(",")[0]?.trim().replace(/\/+$/, "") ?? "https://school.ac.za";
  return `${base}/auth?ref=${encodeURIComponent(code)}`;
}

export async function registerReferralRoutes(app: FastifyInstance) {
  app.get("/referrals/my-code", { preHandler: requireAuth }, async (request, reply) => {
    const code = await getOrCreateReferralCode(request.user.sub);
    reply.send({ code, shareUrl: buildShareUrl(code) });
  });

  app.get("/referrals/stats", { preHandler: requireAuth }, async (request, reply) => {
    const stats = await getReferralStats(request.user.sub);
    reply.send(stats);
  });
}
