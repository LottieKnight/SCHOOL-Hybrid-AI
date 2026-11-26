# QUICK WIN 2 — Per-Request CSP Middleware (Nonce-Based)
**Confidence:** HIGH · **Risk:** LOW (additive) · **Effort:** S (½ day) · **Closes audit item P0-3 (corrected)**
**Files:** `apps/web/middleware.ts` (NEW), `apps/web/next.config.mjs` (refine), `apps/web/app/layout.tsx` (inject nonce into <head> or script)
**Verified current state (2026-08-25):**
- `next.config.mjs` DOES set static security headers: `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, conditional `Strict-Transport-Security`. → The "no CSP at all" claim is FALSE; headers exist.
- BUT `next.config.mjs` comment says: *"Content-Security-Policy is set per-request by the middleware (proxy.ts) with a per-request nonce"* — and **`proxy.ts` does not exist**. So the referenced nonce-CSP middleware is missing. The gap is: no `Content-Security-Policy` header is actually emitted, and there is no `middleware.ts`.
- Scripts are rendered by Next; without a nonce + `strict-dynamic`, any injected script runs. For a minors-facing platform this matters for POPIA s19 "appropriate technical measures".

## Why this wins
A proper CSP with a per-request nonce + `strict-dynamic` converts "any XSS = account takeover" into "script won't execute without the nonce". It's the single highest-leverage security control and is additive (won't break existing functionality if scoped conservatively). Differentiates on *trust* — something the giants take for granted but SA EdTech rarely gets right.

## Implementation
1. Create `apps/web/middleware.ts`:
   ```ts
   import { NextResponse, type NextRequest } from "next/server";
   import { randomBytes } from "crypto";

   export function middleware(req: NextRequest) {
     const nonce = randomBytes(16).toString("base64");
     const isDev = process.env.NODE_ENV !== "production";
     // In dev, allow 'unsafe-eval' for Next's HMR; tighten in prod.
     const csp = [
       "default-src 'self'",
       `script-src 'self' 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : "'strict-dynamic'"}`,
       "style-src 'self' 'nonce-${nonce}' 'unsafe-inline'",
       "img-src 'self' data: https: blob:",
       "font-src 'self' data:",
       "connect-src 'self' https: wss:",
       "frame-ancestors 'none'",
       "base-uri 'self'",
       "form-action 'self'",
     ].join("; ");
     const res = NextResponse.next();
     res.headers.set("Content-Security-Policy", csp);
     res.headers.set("X-Frame-Options", "DENY");
     res.headers.set("X-Content-Type-Options", "nosniff");
     res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
     res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
     // Pass nonce to the app so inline <script> tags can use it.
     res.headers.set("x-nonce", nonce);
     return res;
   }
   export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"] };
   ```
2. Consume the nonce in `app/layout.tsx` (read `x-nonce` from response headers is NOT possible in RSC directly; instead generate the nonce in a `next/headers` `headers()` call inside a server component, OR inject via a small inline script that reads `document` — simplest: set `csp` in middleware and let Next hoist; for inline scripts you DO need the nonce in markup). Recommended: move nonce generation into a Server Component in `layout.tsx` using `headers()` after middleware sets it, and pass to a `<NonceScript>` that renders inline scripts with `nonce={nonce}`.
3. Keep the static headers in `next.config.mjs` as a fallback (they don't conflict; middleware overrides per-request). Optionally remove the `proxy.ts` reference comment.

## Acceptance criteria
- [ ] `Content-Security-Policy` header present on page responses (verify via `curl -I`).
- [ ] Inline scripts in markup carry `nonce="..."` and match the header nonce.
- [ ] App still loads in prod build (no blocked legitimate scripts — watch for third-party widgets that need `'self'` allowlisting; add `img-src`/`connect-src` exceptions as needed).
- [ ] `X-Frame-Options: DENY` + `frame-ancestors 'none'` (prevents clickjacking of a minors app).

## Note
This is the CORRECTED version of the audit's P0-3. The audit said "CSP doesn't exist" — partially true (the nonce middleware is missing, but static headers do exist). This win completes it properly.
