# Security Policy

## Reporting
If you find a security issue, please email the maintainers with:
- A clear description of the issue and impact.
- Steps to reproduce.
- Any relevant logs, screenshots, or PoC code.

Please avoid public disclosure until a fix is available.

## Production Checklist

Before every production deployment, verify:

| Check | Expected value |
|-------|---------------|
| `ALLOW_FAKE_PHONE_VERIFY` | `false` (enforced by config — overriding to `true` in production is blocked) |
| `ALLOW_DEMO_AUTH` | `false` (enforced by config — overriding to `true` in production is blocked) |
| `JWT_SECRET` | Strong random secret (min 32 chars), stored in secret manager |
| `COOKIE_SECRET` | Strong random secret (min 32 chars), stored in secret manager |
| `RESEND_API_KEY` | Set to production Resend key so verification/reset emails are sent |
| `HSTS_ENABLED` | `true` only once domain is HTTPS-only and HSTS preload is confirmed |
| CSRF enforcement | All `POST`/`PUT`/`DELETE` routes behind `requireAuth` enforce the `x-csrf-token` header |
| Webhook idempotency | Wallet debit and referral processing use idempotency keys |
| Session revocation on logout | `revokeSessionById` called on every logout |

Run this before deploying:
```
npm run security:all
```

## Content Security Policy (CSP)

The CSP header (`Content-Security-Policy`) is **enforced per-request** by the Next.js middleware (`apps/web/proxy.ts`). A fresh nonce is generated for every request and forwarded to the root layout via the `x-nonce` request header.

Current `script-src` directive:
```
script-src 'self' 'nonce-{nonce}' 'strict-dynamic' 'unsafe-inline'
```

- `'nonce-{nonce}'` — modern browsers trust only scripts with the matching nonce attribute.
- `'strict-dynamic'` — scripts loaded by nonce-trusted scripts are also trusted; `unsafe-inline` is ignored by browsers that understand `strict-dynamic`.
- `'unsafe-inline'` — retained as a fallback for browsers that don't support nonces (effectively ignored by modern browsers when `strict-dynamic` is present).
- `'unsafe-eval'` — **removed** in production. Dev mode retains it for Next.js HMR.

To further tighten: collect CSP violation reports via Sentry, then remove `'unsafe-inline'` entirely once all legacy browser traffic is confirmed to support nonces.

## Local Security Checks
Run these from the repo root:

1. Dependency audit
```
npm run security:audit
```

2. Static analysis (Semgrep)
```
npm run security:sast:local
```

3. Secret scanning (gitleaks)
```
npm run security:secrets:local
```

4. Filesystem scan (Trivy)
```
npm run security:trivy:local
```

5. Check security headers config
```
npm run security:headers-check
```

Run everything:
```
npm run security:all
```

Notes:
- `security:sast:local` uses `npx` (no Docker).
- `security:secrets:local` requires `gitleaks` installed:
  - Chocolatey: `choco install gitleaks`
  - Scoop: `scoop install gitleaks`
- `security:trivy:local` requires `trivy` installed:
  - Chocolatey: `choco install trivy`
  - Scoop: `scoop install trivy`

## Before Release Checklist
1. `npm run security:all`
1. Verify `apps/web` builds and starts:
   - `npm run build -w apps/web`
   - `npm run dev -w apps/web`
1. Confirm all items in the Production Checklist table above.
1. If enabling HSTS, set `HSTS_ENABLED=true` and confirm domain is HTTPS-only.

## TODO (Tracked Remediations)
- Rotate any secrets in `.env` and ensure real credentials are stored only in `.env.local` or your secret manager. Then delete `.env` from version control history if it was committed.
- Integrate a real SMS/OTP provider (Twilio or AWS SNS) to replace the `ALLOW_FAKE_PHONE_VERIFY` stub — see `apps/api/src/routes/auth.ts` `/auth/verify-phone/*`.
- Implement nonce-based CSP to remove `unsafe-inline`/`unsafe-eval` from `script-src`.
- Add two-factor authentication (TOTP) for admin accounts.
