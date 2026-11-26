import { NextRequest } from "next/server";

const allowMissingOrigin = process.env.NODE_ENV !== "production";
const DEFAULT_CSRF_COOKIE_NAME = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || "saedu_csrf";

export function isSameOrigin(request: NextRequest) {
  const expected = request.nextUrl.origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expected;

  const referer = request.headers.get("referer");
  if (referer) return referer.startsWith(expected);

  return allowMissingOrigin;
}

export function isValidCsrfToken(request: NextRequest, cookieName = DEFAULT_CSRF_COOKIE_NAME) {
  const headerToken = request.headers.get("x-csrf-token") || request.headers.get("x-csrf");
  if (!headerToken) return false;

  const cookieToken = request.cookies.get(cookieName)?.value || null;
  if (!cookieToken) return false;

  return headerToken === cookieToken;
}
