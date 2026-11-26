# Company & Compliance — Evidence Vault

Verification snapshot: **2026-09-14**. Source of truth for operator agreements and legal docs.

## Entity facts (verified)

| Fact | Value | Evidence |
|---|---|---|
| Entity | **Ditshego Ventures (Pty) Ltd** | CIPC |
| CIPC registration | **2026/349873/07** — PTY, In Business since **05/04/2026** | CIPC search + ToS legalContent.ts (`apps/web/lib/legalContent.ts`) |
| Director | Moloti Ditshego | CIPC |
| Income Tax no. | **9420490238** | SARS correspondence |
| B-BBEE | Level 1 contributor (135% EME) | B-BBEE certificate |
| IO certificate | **2026-018785**, issued **26/08/2026**, autonomous & independent (IO = Moloti Ditshego, appointed 05/04/2026) | `evidence/IO_Certificate_2026-018785.pdf` |

## Evidence files

| File | Location | Verif. |
|---|---|---|
| IO Certificate 2026-018785 | `docs/legal/operator-agreements/evidence/IO_Certificate_2026-018785.pdf` (in-repo) | 2026-09-14 |
| CIPC search printout | not in repo — re-fetch from CIPC for any legal use (files not stored) | — |
| B-BBEE Level 1 cert | not in repo — re-fetch before distributing | — |
| Tax clearance | not in repo — re-fetch from SARS < 90 days old before tenders | — |

## Operator contracts

Supabase · Vercel · PayFast · Stripe · Zoho · Resend · OpenAI · Twilio · NVIDIA · Sentry · AWS S3.
Each operator folder's status is tracked in `docs/legal/operator-agreements/README.md`.

## Notes / caveats

- No company bank account or VAT registration is on file yet (VAT once turnover threshold met).
- CIPC annual returns: file Feb/Mar when due (first 6 months after 05/04/2026).
- IO certificate legal proof-of-existence: print/store a copy for any tender or tax clearing —
  PDF is in-repo but do not upload evidence PDFs to public repos; this repo is private.