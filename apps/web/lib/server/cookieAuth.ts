import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

export const COOKIE_NAME = "saedu_session";
export const CSRF_COOKIE_NAME = "saedu_csrf";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type JwtPayload = {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  planType?: string;
  planStatus?: string;
};

function getJwtKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

export function normalizeSessionToken(token: string) {
  if (!token.startsWith("s:")) return token;

  // Fastify's signed cookies are serialized as `s:<value>.<signature>`.
  // The JWT itself is the `<value>` portion, so strip the signature suffix
  // and let jose validate the actual token signature.
  const unsigned = token.slice(2);
  const lastDot = unsigned.lastIndexOf(".");
  if (lastDot <= 0) return token;
  return unsigned.slice(0, lastDot);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtKey());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(normalizeSessionToken(token), getJwtKey());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export function generateCsrfToken() {
  return randomUUID();
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
