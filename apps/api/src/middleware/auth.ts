import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { isAdminPrincipal } from "../lib/admin-access.js";
import { getActiveUserSuspension } from "../db/platform.js";
import { authenticateApiKey } from "../lib/api-keys.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  // 1. Attempt API key authentication (institution machine-to-machine).
  //    API-key-authenticated requests are exempt from the CSRF requirement
  //    (they are not browser-initiated).
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const principal = await authenticateApiKey(apiKey, request.log);
    if (!principal) {
      reply.code(401).send({ error: "Invalid API key" });
      return;
    }
    request.user = {
      sub: principal.userId,
      role: "institution_admin",
      institutionId: principal.institutionId,
      permissions: principal.permissions,
      email: principal.email,
      firstName: "",
      lastName: "",
      planType: "",
      planStatus: "",
      isEmailVerified: false,
      isPhoneVerified: false,
      verificationLevel: "",
    } as any;
    request.apiKeyPrincipal = principal;
    return;
  }

  // 2. JWT session authentication.
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }

  const activeSuspension = await getActiveUserSuspension(request.user.sub).catch((err) => {
    request.log.error({ err }, "suspension lookup failed — allowing request to proceed");
    return null;
  });
  if (activeSuspension) {
    reply.code(403).send({
      error: "Account suspended",
      suspension: {
        reason: activeSuspension.reason,
        endsAt: activeSuspension.ends_at,
      },
    });
    return;
  }

  const authorization = request.headers.authorization;
  const hasBearerAuth =
    typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ");

  if (!SAFE_METHODS.has(request.method) && !hasBearerAuth) {
    const csrfHeader = request.headers["x-csrf-token"];
    const csrfCookie = request.cookies[config.csrfCookieName];

    if (!csrfHeader || typeof csrfHeader !== "string" || csrfHeader !== csrfCookie) {
      reply.code(403).send({ error: "Invalid CSRF token" });
      return;
    }
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (!isAdminPrincipal({ role: request.user.role, email: request.user.email })) {
    reply.code(403).send({ error: "Admin access required" });
  }
}

function extractApiKey(request: FastifyRequest): string | null {
  const header = request.headers["x-api-key"];
  if (typeof header === "string" && header.trim().length > 0) return header.trim();

  const authorization = request.headers.authorization;
  if (typeof authorization === "string") {
    if (/^APikey\s+/i.test(authorization)) return authorization.replace(/^apikey\s+/i, "").trim();
    if (/^ApiKey\s+/i.test(authorization)) return authorization.replace(/^ApiKey\s+/i, "").trim();
  }
  return null;
}

declare module "fastify" {
  interface FastifyRequest {
    apiKeyPrincipal?: {
      keyId: string;
      institutionId: string;
      userId: string;
      email: string;
      permissions: string[];
      rateLimit: number;
    };
  }
}

export function registerAuthGuards(_app: FastifyInstance) {
  // placeholder for future guard helpers
}
