import "server-only";

import type { NextRequest } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/server/cookieAuth";

export type BackendSession = {
  user?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    planType?: string;
    planStatus?: string;
  };
  csrfToken?: string;
};

type SessionUser = NonNullable<BackendSession["user"]>;

async function sessionFromToken(token: string | undefined | null): Promise<BackendSession | null> {
  if (!token) return null;

  const payload = await verifyToken(token).catch(() => null);
  if (!payload?.sub) return null;

  const user: SessionUser = {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role,
    planType: payload.planType,
    planStatus: payload.planStatus,
  };

  return { user };
}

export async function getBackendSessionFromCookieHeader(
  cookieHeader: string
): Promise<BackendSession | null> {
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)saedu_session=([^;]+)/);
  return sessionFromToken(match?.[1]);
}

export async function getBackendSessionFromRequest(
  request: NextRequest
): Promise<BackendSession | null> {
  // Cookie-based (web)
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;
  // Bearer-based (mobile)
  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  return sessionFromToken(cookieToken ?? bearerToken);
}
