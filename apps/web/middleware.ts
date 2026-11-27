import { NextResponse, type NextRequest } from "next/server";
import { crossOriginOpenerPolicyForPath } from "./lib/coopPolicy";
import { buildContentSecurityPolicy } from "./lib/contentSecurityPolicy";
import { loginRedirectForMissingBackendCookie } from "./lib/sessionGate";

/**
 * Per-request Content-Security-Policy with a fresh nonce.
 * - Sets the `Content-Security-Policy` response header (strict-dynamic + nonce).
 * - Forwards a request header `x-nonce` so Server Components (app/layout.tsx)
 *   can stamp inline <script> tags with the matching nonce.
 * - Keeps the static headers in next.config.mjs as a fallback; this overrides
 *   per-request for paths matched below.
 *
 * Note: in dev, 'unsafe-eval' is allowed so Next's HMR runtime works. Prod tightens.
 */
export function middleware(req: NextRequest) {
  const raw = new Uint8Array(16);
  globalThis.crypto.getRandomValues(raw);
  const nonce = Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  const isDev = process.env.NODE_ENV !== "production";

  // script-src-elem stays explicit so reCAPTCHA and the Google sign-in
  // client can load even when script-src uses strict-dynamic.
  const csp = buildContentSecurityPolicy(nonce, isDev);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  const legacyBounce = loginRedirectForMissingBackendCookie({
    pathname: req.nextUrl.pathname,
    hasBackendSessionCookie: /(?:^|;\s*)saedu_session=/.test(req.headers.get("cookie") || ""),
    // The server cannot see Firebase Auth. A missing legacy cookie must not
    // send a Google-signed-in learner back to /login.
    enforceLegacyCookie: false,
  });
  if (legacyBounce) {
    return NextResponse.redirect(new URL(legacyBounce, req.url));
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Cross-Origin-Opener-Policy", crossOriginOpenerPolicyForPath(req.nextUrl.pathname));
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );
  return res;
}

export const config = {
  // Apply everywhere except Next static assets, image optimizer, favicon, and API routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
