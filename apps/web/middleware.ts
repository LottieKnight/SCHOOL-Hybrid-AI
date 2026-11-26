import { NextResponse, type NextRequest } from "next/server";

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

  // script-src-elem is separate so reCAPTCHA Enterprise can load from Google
  // even when script-src uses strict-dynamic (which ignores host allowlists).
  const recaptchaScripts =
    "https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://recaptcha.google.com";
  const recaptchaFrames =
    "https://www.google.com https://www.google.com/recaptcha/ https://recaptcha.google.com https://recaptcha.google.com/recaptcha/ https://www.recaptcha.net";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : "'strict-dynamic'"} 'unsafe-inline'`,
    `script-src-elem 'self' 'nonce-${nonce}' 'unsafe-inline' ${recaptchaScripts}`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'; style-src-attr 'unsafe-inline'`,
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "media-src 'self' https: blob:",
    `frame-src 'self' ${recaptchaFrames}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
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
