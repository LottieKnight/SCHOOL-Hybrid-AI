import { FastifyReply } from "fastify";
import { config } from "../../config.js";

export function setAuthCookies(reply: FastifyReply, token: string, csrfToken: string) {
  const maxAge = 60 * 60 * 24 * 7;
  reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge,
  });

  reply.setCookie(config.csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
    maxAge,
  });
}

export function getClientIp(
  request: { headers: Record<string, string | string[] | undefined>; ip?: string }
): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.ip ?? null;
}

export function handleAuthServiceError(reply: FastifyReply, error: unknown, context: string) {
  reply.log.error(
    { err: error instanceof Error ? error.message : String(error), context },
    `[auth] ${context} failed`
  );
  reply.code(503).send({ error: "Authentication service temporarily unavailable. Please try again." });
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function inferInstitutionShortName(name: string | null | undefined): string | null {
  const tokens = (name ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (tokens.length === 0) return null;
  const acronym = tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
  return acronym.length >= 2 ? acronym : null;
}
