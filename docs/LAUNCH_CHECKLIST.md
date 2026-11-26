# SCHOOL — Official Launch Checklist (Living Document)

**Compiled:** 2026-08-26 · **Operator:** Ditshego Ventures (Pty) Ltd t/a SCHOOL (CIPC 2026/349873/07)
**IR IO reg:** 2026-018785 (issued 2026-08-26) · **Bank:** FNB business account (2026-08-26)

Legend: `[x]` done · `[ ]` open · `[~]` partial / in progress · `ON HOLD`

---

## A. COMPANY & TAX
- [x] CIPC registration — 2026/349873/07 (2026-05-04)
- [x] FNB business account registered (2026-08-26)
- [x] SARS Income Tax — auto-registered at CIPC (NOT threshold-based; mandatory for all Pty Ltd)
- [x] VAT — not required (2026 compulsory threshold R2.3m; well under)
- [ ] CONFIRM auto-generated IT number on eFiling + register company profile to transact
- [ ] Railway ToS opt-out letter sent (30 days from accepting Railway ToS)
- [ ] SARS PAYE — only when staff hired (defer)

## B. POPIA / PRIVACY COMPLIANCE
- [x] Information Officer registered with IR — reg 2026-018785 (2026-08-26)
- [x] PAIA Manual cites IR reg number
- [x] Privacy Policy cites IR reg number
- [x] PAIA Manual published live at /legal/paia (route added 2026-08-26)
- [x] ECTA s43 footer live on every page — reg no + address + phone added to SiteFooter (2026-08-26)
- [ ] OpenAI Data Processing Agreement signed (POPIA s21 operator)
- [ ] Railway DPA reviewed/signed (cross-border transfer)
- [ ] Fill blank legal-doc fields across all docs: [DOMAIN]→school.ditshego-ventures.co.za, physical address, phone, IO name+email, IR ref, launch/effective date, Stripe ZA country, analytics/cookie details, tutor payout cycle
- [ ] ECTA s43 footer live on every page (legal name, reg no, address, phone, email, ToS/Privacy/Refund/Cookie links)
- [ ] In-product consent flows: registration ToS+Privacy checkbox (no pre-tick), minor parental consent, cookie banner, separate marketing opt-in, wallet top-up disclosure

## C. DMCA
- [ ] Register DMCA agent, US Copyright Office, ~$6/yr — **ON HOLD (bootstrapped)**
  Risk: no DMCA safe harbour for US-hosted platform until registered. Acceptable known risk; revisit when funded.

## D. PAYMENTS
- [ ] Stripe South Africa account — confirm ZA entity processing for ZAR (CPA refund compliance)
- [ ] Confirm webhook/idempotency path live for wallet topups + plan entitlement

## E. ANDROID / GOOGLE PLAY — CURRENT VERDICT: 🔴 NO-GO
- [ ] T0-1 Rotate leaked Android upload keystore (in git history) + purge via git-filter-repo
- [~] T0-2 TWA source now targets `school.ditshego-ventures.co.za` with package `za.co.ditshego.school`; run `npm run security:android-release` and complete an Android release build.
- [~] T0-3 Source asset links now contain a non-placeholder fingerprint; verify it matches the Play App Signing certificate and redeploy the web app.
- [x] T0-4 Resolved committed `.gitignore` merge-conflict markers; the release guard now prevents recurrence.
- [x] T0-5 Enforce POPIA §35 age-gate (FIXED 2026-08-26 — DOB mandatory, under-13 block, parental consent)
- [ ] Store listing assets: screenshots, privacy-policy URL, content-rating questionnaire
- [!] TREE DRIFT: local tree ahead (commit de26cbbc TWA rebrand) — GitHub deploy source still stale. Reconcile before release. See docs/engineering/PLAY_TWA_FIX_SHEET.md

## F. PLATFORM INFRA LAUNCH GATE (target: 1,500 concurrent)
- [ ] Prod uses POOLED Postgres (not direct connection)
- [ ] plannerDb resolves POSTGRES_URL before direct URL
- [ ] Pool sizing intentional for launch traffic
- [ ] Redis enabled + reachable from web and API
- [ ] Session-lookup caching active
- [ ] AI routes return 429 + Retry-After on per-user limit
- [ ] Global API rate limit confirmed
- [ ] Hot DB indexes live (user_quests, user_notifications)
- [ ] Health checks pass (API /health + web shell)
- [ ] Sentry receiving events from web + API
- [ ] Real load test passes (login, dashboard, learn, messages, growth reads)
- [ ] No pool exhaustion / 5xx spike / timeout cascade
- [ ] First-run journey works on low-end Android, iPhone, tablet
- [ ] No broken links / empty critical states on key flows

## G. SECURITY HARDENING (minors' data)
- [x] T1-6 Real CSP with nonce — DONE (apps/web/middleware.ts: per-request nonce + strict-dynamic CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). August audit was stale.
- [x] T1-7 Phone encryption at rest — DONE (apps/api/src/lib/phoneEncryption.ts: AES-256-GCM, null fallback when key unset — NOT plaintext). Residual: SET `PHONE_ENCRYPTION_KEY` (64-hex) in prod env.
- [~] T1-8 Message-body encryption at rest — IMPLEMENTED in the API with AES-256-GCM envelopes (`apps/api/src/lib/messageEncryption.ts`, migration `112_message_body_encryption.sql`). Provision a unique `MESSAGE_ENCRYPTION_KEY` in every production environment, run `npm run messages:encrypt-backfill -w apps/api`, and verify zero plaintext rows. This is server-side encryption at rest, not end-to-end encryption.
- [~] T1-9 HSTS for prod domain — code present, gated on `HSTS_ENABLED=true`. SET the flag ON for school.ditshego-ventures.co.za (config task).
- [ ] T1-10 Move GitHub credential to SSH / credential helper (account hygiene)

## H. CONTENT READINESS
- [ ] Lesson quality pipeline: 147/15,760 validated (8,058 ungenerated) — top up + regen to usable CAPS coverage
- [ ] Missing-subject coverage (Life Orientation, Geography FET, History FET, African languages)
- [ ] Past-paper → feedback → targeted-practice loop
- [ ] Multi-language content (Afrikaans/Zulu/Sotho/Xhosa/Tswana)

## I. POST-LAUNCH (enhancements, NOT blockers)
Visual education (KaTeX, diagrams, charts, images, TTS), AI intelligence (RAG tutor, spaced repetition, exam-readiness), integrations (MCP, LMS connectors, SSO), UX polish, referral/subscription tiers.

---

## MINIMUM BAR FOR "OFFICIALLY LAUNCHED"
1. Close Section E fully — OR launch web-only first, ship Play later.
2. Confirm Section B (IO done; DPAs, doc fields, ECTA footer, consent flows).
3. Pass Section F infra launch gate (load test at 1,500 concurrent).
4. Close Section G minors-data security (CSP, phone+message encryption, HSTS).
5. Section D: Stripe ZA live for paid flows.
6. Section H: agree + hit a minimum lesson-coverage bar.
7. Section C: accept DMCA on-hold risk in writing, or fund $6.

**Fastest credible path:** web-only soft launch once B + F + G + content floor are met; Play Store stays NO-GO until E closed.

*Last updated 2026-08-26.*
